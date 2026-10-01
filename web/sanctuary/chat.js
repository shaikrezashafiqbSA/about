// What he knows about himself, and how he answers: in the first person, as Shaik.
//
// Two ways to get an answer:
//
//  1. PRESETS -- hand-written from the bio and CV. Instant, offline, no model.
//  2. A free question -- answered by a small on-device model (WebLLM over WebGPU,
//     or Chrome's built-in Gemini Nano), grounded only in the bio and CV text.
//     Nothing leaves the browser. The model is opt-in: it is a multi-gigabyte
//     download, so it is never started without a click.

export const PRESETS = [
    {
        q: "What do you do?",
        a: "I'm a Transformation Manager in Singapore with about six years of driving measurable change across statutory boards, GIC and technology firms. I lead digital and AI adoption: finding out why a system has stalled, redesigning the workflow around it, and carrying the people through the change. Unusually, I've built the production systems I now help organisations adopt."
    },
    {
        q: "Why did you move from quant to change management?",
        a: "I trained as a quantitative developer: an MSc in Quantitative Finance at SMU, then GIC, Alpha Stone Capital and Call Levels. What I learned is that a technical build lands better when it is paired with real human adoption, and I wanted to own both halves. So I moved into change management and AI-enabled workflow transformation."
    },
    {
        q: "What is your biggest measurable win?",
        a: "The National Heritage Board's Digital Asset Management System. It was technically live but stalled. In a twelve-month contract I grew active use from 30 officers across 8 divisions to 95 officers across all 15 divisions: three times the adoption, reversed through structured change management rather than a broadcast campaign."
    },
    {
        q: "What was the DAMS project at NHB?",
        a: "An enterprise rollout of Adobe Experience Manager that had plateaued in human adoption. I spent three months diagnosing it division by division before designing any intervention, then built the measurement behind it: an adoption index, a four-tier division classification, an annual survey with a 72.8% response rate, and a reproducible monthly analytics pipeline. The aim was governance and knowledge that outlast the contract."
    },
    {
        q: "What have you actually built?",
        a: "At EkkBaz AI, a RAG digitisation pipeline that cut a government client's itinerary workflow from about four days to two hours, roughly 48 times faster. At GIC, a parallelised factor-data ETL pipeline that took processing from four hours to forty-five minutes. Elsewhere: RAG chatbots, trading systems, and at NHB an analytics pipeline in Python and Jupyter."
    },
    {
        q: "What kind of role are you looking for?",
        a: "A long-term institutional role in transformation, digital adoption or AI enablement. After a deliberate stretch of building breadth across finance, consulting and the public sector, I want to consolidate it into durable capability and retained knowledge, rather than another short contract."
    },
    {
        q: "What shaped how you facilitate?",
        a: "Over ten years as a community educator with Mendaki. That is where I learned how adults resist, how to facilitate, and how behaviour actually changes. I apply the same skills now to enterprise change: peer champions, hands-on sessions, and Socratic rather than top-down teaching."
    },
    {
        q: "How do I reach you?",
        a: "My CV lists shaik.reza.shafiq@gmail.com, and I'm on LinkedIn at linkedin.com/in/shaikrezashafiq. The styled CV is in the menu on the right."
    }
];

export const GREETING =
    "Hi, I'm Shaik. Ask me about my work, my move from quant finance into change management, or what I'm looking for next. " +
    "Pick a question below, or type your own.";

export const NEEDS_MIND =
    "To answer a question of your own I need a small model running in your browser. It's a one-off download, and " +
    "nothing you ask leaves this page. Pick an engine below and I'll answer as soon as it's ready.";

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

export function createMind(onLog) {
    let engine = "webllm";
    let webllm = null;
    let chrome = null;
    let loading = null;
    let pitch = "";
    let resume = "";

    const log = (t, bad) => onLog && onLog(t, !!bad);

    async function loadText() {
        if (pitch) return;
        const get = async name => {
            const r = await fetch(new URL("../../content/" + name, import.meta.url));
            if (!r.ok) throw new Error("HTTP " + r.status);
            return (await r.text()).trim();
        };
        try {
            [pitch, resume] = await Promise.all([get("elevator_pitch.md"), get("Shaik_Reza_Shafiq_Resume.md")]);
        } catch (err) {
            const hint = location.protocol === "file:" ? " (opened via file:// — serve the folder over HTTP)" : "";
            throw new Error("could not load the bio: " + err.message + hint);
        }
    }

    function system() {
        return "You are Shaik Reza Shafiq, answering questions about your own career in the first person, in a plain, warm, professional voice. " +
            "Use ONLY the material below. Never invent facts, dates, employers or numbers. If the material does not cover the " +
            "question, say so plainly and suggest the visitor read your CV. Keep the answer under 110 words.";
    }

    function material(forChrome) {
        // Gemini Nano has a small context window: the bio alone. The larger model gets the CV too.
        return forChrome ? pitch : pitch + "\n\nCV EXCERPT:\n" + resume.slice(0, 5200);
    }

    function isReady() { return engine === "webllm" ? !!webllm : !!chrome; }
    function selected() { return engine; }
    function isLoading() { return loading !== null; }

    function select(next) {
        engine = next;
        log(isReady() ? "His mind is awake." : "His mind is asleep.");
    }

    async function initWebLLM() {
        log("Loading the WebLLM module...");
        const mod = await import("https://esm.run/@mlc-ai/web-llm");
        webllm = await mod.CreateMLCEngine(MODEL_ID, {
            initProgressCallback: r => log(r.text)
        });
        log("Awake. Running on your GPU; nothing leaves this page.");
    }

    async function initChrome() {
        const LM = typeof self !== "undefined" && "LanguageModel" in self ? self.LanguageModel : null;
        if (!LM) throw new Error("Chrome's built-in AI (LanguageModel) isn't available in this browser. Try WebLLM instead.");
        const avail = await LM.availability();
        if (avail === "unavailable") throw new Error("Gemini Nano reports 'unavailable' on this device. Try WebLLM instead.");
        log(avail === "downloadable" || avail === "downloading" ? "Downloading Gemini Nano on-device model..." : "Starting Gemini Nano...");
        chrome = await LM.create({
            monitor(m) { m.addEventListener("downloadprogress", e => log("Downloading Gemini Nano: " + Math.round(e.loaded * 100) + "%")); }
        });
        log("Awake. Running on-device in Chrome; nothing leaves this page.");
    }

    /** Resolves true when the chosen engine is ready; false (and logs why) when not. */
    function awaken() {
        if (isReady()) return Promise.resolve(true);
        if (loading) return loading;
        loading = (async () => {
            try {
                await loadText();
                if (engine === "webllm") await initWebLLM(); else await initChrome();
                return true;
            } catch (err) {
                log((engine === "webllm" ? "WebGPU or the download failed: " : "") + err.message +
                    (engine === "webllm" ? "\nUse a recent Chrome or Edge." : ""), true);
                return false;
            } finally {
                loading = null;
            }
        })();
        return loading;
    }

    async function ask(question) {
        await loadText();
        const content = system() + "\n\nMATERIAL:\n" + material(engine === "chromeai") + "\n\nQUESTION: " + question;
        if (engine === "webllm") {
            const r = await webllm.chat.completions.create({
                messages: [{ role: "user", content }], temperature: 0.6, max_tokens: 280
            });
            return (r.choices[0].message.content || "").trim();
        }
        try {
            return (await chrome.prompt(content)).trim();
        } catch (e) {
            if (e.name === "QuotaExceededError") {
                return "That question and my notes together are too long for Gemini Nano's memory. Try WebLLM, or ask something shorter.";
            }
            throw e;
        }
    }

    return { isReady, isLoading, selected, select, awaken, ask };
}
