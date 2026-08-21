// The scholar's mind, in two tiers.
//
// Tier 1 (default, always available): the question banks and keyed rubrics in
// tree.js. No download, no WebGPU, works the instant the page paints.
//
// Tier 2 (opt-in): WebLLM, running a model in-page over WebGPU -- same approach
// as web/ask.html. It writes questions that quote the visitor's own notes back
// at them and judges in prose. It costs a multi-gigabyte download, so it is
// never started without an explicit click.
//
// Every tier-2 path falls back to tier 1 on failure. The scholar always has
// something to ask.

import { gradeAgainstRubric, contextFor, PASS_SCORE } from "./tree.js";

// Smaller than the 8B used elsewhere in this site: the scholar asks and grades
// short answers, and a ~2GB download is the difference between a visitor
// waiting and a visitor leaving.
const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

const PERSONA =
    "You are Al-Katib, an elderly Muslim scholar in an oasis masjid, examining a student " +
    "on Islamic knowledge. You are exacting but warm, and you never flatter. You speak " +
    "plainly, in two or three sentences at most. Do not invent hadith, verse numbers, or " +
    "attributions; if you are unsure of a citation, describe it without numbering it.";

let engine = null;
let loading = null;

export function isAwake() {
    return engine !== null;
}

export function isLoading() {
    return loading !== null;
}

/**
 * Download and start the model. Safe to call repeatedly -- concurrent callers
 * share one download. Resolves false if WebGPU or the network says no, and the
 * caller simply stays on the rubric.
 */
export function awaken(onProgress) {
    if (engine) return Promise.resolve(true);
    if (loading) return loading;

    loading = (async () => {
        try {
            onProgress && onProgress("Sending for the scholar's books...");
            const webllm = await import("https://esm.run/@mlc-ai/web-llm");
            engine = await webllm.CreateMLCEngine(MODEL_ID, {
                initProgressCallback: (report) => onProgress && onProgress(report.text)
            });
            onProgress && onProgress("He has his books. Ask him anything now.");
            return true;
        } catch (err) {
            console.warn("[atelier] WebLLM unavailable, staying on the rubric:", err);
            engine = null;
            onProgress && onProgress(
                "The books did not arrive — this needs WebGPU (recent Chrome or Edge) and a few GB of space. " +
                "He will examine you from memory instead."
            );
            return false;
        } finally {
            loading = null;
        }
    })();

    return loading;
}

async function complete(messages, maxTokens) {
    const result = await engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: maxTokens || 320
    });
    return (result.choices[0].message.content || "").trim();
}

/** Models wrap JSON in prose and fences no matter how firmly you ask them not to. */
function extractJson(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : text;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(body.slice(start, end + 1));
    } catch (err) {
        return null;
    }
}

/**
 * A question for this node. With the model awake it is written fresh from the
 * node's material and the visitor's own scrolls; otherwise it comes from the
 * bank. The returned object always carries `source` so the UI can say which.
 */
export async function composeQuestion(state, node, bankQuestion) {
    if (!engine || !bankQuestion) {
        return { text: bankQuestion ? bankQuestion.q : "", question: bankQuestion, source: "bank" };
    }
    try {
        const text = await complete([
            { role: "system", content: PERSONA },
            {
                role: "user", content:
                    "Examine the student on this topic. Ask ONE question that forces them to recall and " +
                    "reconstruct, not to recognise. Do not answer it. Do not preamble. Output the question only.\n\n" +
                    contextFor(state, node) +
                    "\n\nA question of this kind was asked before, for calibration: " + bankQuestion.q
            }
        ], 180);
        const cleaned = text.replace(/^["“]|["”]$/g, "").trim();
        if (cleaned.length < 20) throw new Error("model returned nothing usable");
        return { text: cleaned, question: bankQuestion, source: "model" };
    } catch (err) {
        console.warn("[atelier] question generation failed, using the bank:", err);
        return { text: bankQuestion.q, question: bankQuestion, source: "bank" };
    }
}

function rubricFeedback(grade, passed) {
    if (passed && !grade.missed.length) {
        return "Complete. You left nothing out that I was listening for.";
    }
    if (passed) {
        return "That holds. You did not mention " + grade.missed.slice(0, 2).join(", nor ") +
               " — go back to it before you teach it to anyone.";
    }
    if (!grade.hit.length) {
        return "No. Nothing in that answer touched what I asked for. Read it again and come back.";
    }
    return "Not yet. You had " + grade.hit.slice(0, 2).join(" and ") +
           ", but you passed over " + grade.missed.slice(0, 3).join(", ") + ".";
}

/**
 * Judge an answer. The rubric always runs -- it is what produces the itemised
 * "you missed this" list. The model, when awake, supplies the score and the
 * spoken verdict on top of it.
 */
export async function judge(state, node, questionText, bankQuestion, answer) {
    const grade = gradeAgainstRubric(bankQuestion, answer);
    const rubricResult = {
        score: grade.score,
        missed: grade.missed,
        hit: grade.hit,
        feedback: rubricFeedback(grade, grade.score >= PASS_SCORE),
        source: "rubric"
    };

    // A near-empty answer needs no model to adjudicate.
    if (answer.trim().length < 12) {
        return {
            score: 0, missed: grade.missed, hit: [],
            feedback: "That is not an answer. Sit with the question.",
            source: "rubric"
        };
    }

    if (!engine) return rubricResult;

    try {
        const expected = (bankQuestion.rubric || []).map(r => "- " + r.label).join("\n");
        const raw = await complete([
            { role: "system", content: PERSONA },
            {
                role: "user", content:
                    "Judge the student's answer. Reply with JSON only, in this exact shape:\n" +
                    '{"score": <0-100>, "verdict": "<two or three sentences, spoken to the student>", ' +
                    '"missed": ["<point they omitted>", "..."]}\n\n' +
                    "Score on substance recalled, not on eloquence or length. Be strict: a vague gesture at " +
                    "the right area is not recall.\n\n" +
                    "QUESTION: " + questionText + "\n\n" +
                    (expected ? "POINTS A FULL ANSWER WOULD COVER:\n" + expected + "\n\n" : "") +
                    "STUDENT'S ANSWER:\n" + answer
            }
        ], 400);

        const parsed = extractJson(raw);
        if (!parsed || typeof parsed.score !== "number") throw new Error("unparseable verdict");

        const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
        return {
            score,
            // Blend: keep the rubric's misses when the model doesn't name any, so
            // the "what to study next" list is never empty on a failed attempt.
            missed: Array.isArray(parsed.missed) && parsed.missed.length ? parsed.missed : grade.missed,
            hit: grade.hit,
            feedback: (parsed.verdict || rubricResult.feedback).trim(),
            source: "model"
        };
    } catch (err) {
        console.warn("[atelier] judging failed, using the rubric:", err);
        return rubricResult;
    }
}

/**
 * Self-graded recall, for material the visitor dictated. There is no rubric for
 * their own notes, so with the model asleep they compare against their own words
 * and grade honestly; with it awake, it compares for them.
 */
export async function judgeAgainstScroll(node, questionText, answer, original) {
    if (!engine) return null;   // caller falls back to the self-grade buttons
    try {
        const raw = await complete([
            { role: "system", content: PERSONA },
            {
                role: "user", content:
                    "The student earlier dictated the passage below to you. They have now tried to " +
                    "reconstruct it from memory. Judge how much of the substance they recovered. " +
                    'Reply with JSON only: {"score": <0-100>, "verdict": "<two or three sentences>", ' +
                    '"missed": ["<what they lost>", "..."]}\n\n' +
                    "THEIR ORIGINAL PASSAGE:\n" + original.slice(0, 2000) + "\n\n" +
                    "WHAT THEY RECALLED:\n" + answer
            }
        ], 400);
        const parsed = extractJson(raw);
        if (!parsed || typeof parsed.score !== "number") return null;
        return {
            score: Math.max(0, Math.min(100, Math.round(parsed.score))),
            missed: Array.isArray(parsed.missed) ? parsed.missed : [],
            hit: [],
            feedback: (parsed.verdict || "").trim(),
            source: "model"
        };
    } catch (err) {
        console.warn("[atelier] scroll judging failed:", err);
        return null;
    }
}

/**
 * A line of dialogue in character -- greetings, reactions to being fed material.
 * Falls back to the supplied fixed line whenever the model is asleep or slow.
 */
export async function speak(prompt, fallback) {
    if (!engine) return fallback;
    try {
        const text = await complete([
            { role: "system", content: PERSONA },
            { role: "user", content: prompt + "\n\nReply with the spoken line only, no quotation marks." }
        ], 150);
        const cleaned = text.replace(/^["“]|["”]$/g, "").trim();
        return cleaned.length > 8 ? cleaned : fallback;
    } catch (err) {
        return fallback;
    }
}

export const BRAIN_MODEL = MODEL_ID;
