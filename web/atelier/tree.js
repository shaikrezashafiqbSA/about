// The skill tree: the NPC's scroll and the visitor's progress are the same data.
//
// Every node carries its own question bank with a keyed rubric, so the scholar
// can test you the moment the page loads -- no model download required. When
// WebLLM is awakened (see brain.js) it writes fresher questions and judges in
// prose instead, but the rubric stays as the offline floor.
//
// Domain scope for v1 is Islamic knowledge only. The positions below are
// standard, widely-taught Sunni textbook material; they are memory prompts,
// not fatwa. See DISCLAIMER.

export const DISCLAIMER =
    "These prompts follow standard, widely-taught positions and exist to exercise recall. " +
    "They are not fatwa — verify anything you intend to act on with a qualified scholar.";

export const STATIONS = {
    musalla: { label: "the prayer place", verb: "praying at" },
    kutub:   { label: "the bookshelf",    verb: "reading at" },
    maktab:  { label: "the writing desk", verb: "writing at" },
    sabil:   { label: "the fountain",     verb: "resting by" }
};

// status: locked | available | contested | verified | mastered
export const NODES = [
    {
        id: "aqidah_tawhid", tier: 0, requires: [], station: "kutub",
        title: "Tawḥīd", arabic: "التوحيد",
        blurb: "The shahādah: what it negates, what it affirms, and its three-fold division.",
        questions: [
            {
                q: "Lā ilāha illa’Llāh — tell me what the sentence denies and what it establishes, and why neither half survives without the other.",
                rubric: [
                    { label: "the negation (nafy) of every object of worship besides Allah", any: ["negat", "nafy", "denies", "deny", "rejects", "no god", "no deity", "none worthy"] },
                    { label: "the affirmation (ithbāt) of Allah alone", any: ["affirm", "ithbat", "establish", "except allah", "but allah", "allah alone", "only allah"] },
                    { label: "that worship (ʿibādah), not mere belief, is what is being restricted", any: ["worship", "ibadah", "ibadat", "devotion", "directed to"] },
                    { label: "shirk as the thing the negation is aimed at", any: ["shirk", "associat", "partner", "idol"] },
                    { label: "that negation alone is emptiness and affirmation alone is not exclusive", any: ["both", "either half", "without the other", "alone is not", "incomplete", "not enough"] }
                ]
            },
            {
                q: "Divide tawḥīd into its three categories, and name the one the Quraysh already conceded before the Prophet ṣallā Allāhu ʿalayhi wa sallam ever addressed them.",
                rubric: [
                    { label: "rubūbiyyah — lordship, creating, sustaining, disposing of affairs", any: ["rububiyyah", "lordship", "creat", "sustain", "provide", "controls"] },
                    { label: "ulūhiyyah — the right to be worshipped", any: ["uluhiyyah", "ilahiyyah", "worship", "godhood", "divinity", "ibadah"] },
                    { label: "al-asmāʾ wa’l-ṣifāt — names and attributes affirmed as they came", any: ["asma", "sifat", "names", "attribut"] },
                    { label: "that the Quraysh affirmed rubūbiyyah yet refused ulūhiyyah", any: ["quraysh affirm", "they affirmed", "already accept", "conceded", "29 61", "who created"] }
                ]
            }
        ]
    },
    {
        id: "taharah", tier: 0, requires: [], station: "musalla",
        title: "Ṭahārah", arabic: "الطهارة",
        blurb: "Purification: the farāʾiḍ of wuḍūʾ, ḥadath versus najāsah, and tayammum.",
        questions: [
            {
                q: "Name the obligatory acts of wuḍūʾ as the verse itself lists them, then tell me what replaces it and under what circumstance.",
                rubric: [
                    { label: "washing the face", any: ["face", "wajh"] },
                    { label: "the arms including the elbows", any: ["arm", "elbow", "hands to"] },
                    { label: "wiping the head (masḥ)", any: ["head", "mash", "masah", "wipe"] },
                    { label: "the feet to the ankles", any: ["feet", "foot", "ankle", "rijl"] },
                    { label: "tayammum with clean earth as the substitute", any: ["tayammum", "dust", "earth", "soil", "sand", "dry ablution"] },
                    { label: "the condition: water absent, or its use harmful", any: ["no water", "without water", "unavail", "absent", "cannot find", "ill", "sick", "harm", "injur"] }
                ]
            },
            {
                q: "Separate ḥadath from najāsah for me. Give one example of each and say precisely how each is lifted.",
                rubric: [
                    { label: "ḥadath as a ritual state, not a substance on the body", any: ["state", "ritual", "invisible", "not a substance", "condition", "hadath is"] },
                    { label: "minor ḥadath lifted by wuḍūʾ", any: ["wudu", "minor", "asghar"] },
                    { label: "major ḥadath / janābah lifted by ghusl", any: ["ghusl", "janabah", "major", "akbar", "bath"] },
                    { label: "najāsah as a physical impurity — urine, blood, droppings", any: ["urine", "blood", "faec", "fec", "stool", "droppings", "substance", "filth", "physical"] },
                    { label: "najāsah removed by washing the affected spot or garment", any: ["wash", "remov", "clean the spot", "the place", "garment", "until it goes"] }
                ]
            }
        ]
    },
    {
        id: "salah", tier: 1, requires: ["taharah"], station: "musalla",
        title: "Ṣalāh", arabic: "الصلاة",
        blurb: "Conditions before the prayer, pillars inside it, and the repair of forgetfulness.",
        questions: [
            {
                q: "Draw the line between the shurūṭ that must hold before you say Allāhu akbar and the arkān that live inside the prayer itself. Name what you can of each.",
                rubric: [
                    { label: "the time of the prayer having entered", any: ["time", "waqt", "entered"] },
                    { label: "purity from ḥadath and najāsah", any: ["purity", "pure", "wudu", "tahar", "clean", "hadath", "najasah"] },
                    { label: "covering the ʿawrah", any: ["awrah", "cover", "clothing", "dress"] },
                    { label: "facing the qiblah", any: ["qibla", "facing", "direction", "kaaba", "kabah"] },
                    { label: "the intention (niyyah)", any: ["niyyah", "niyya", "intent"] },
                    { label: "takbīrat al-iḥrām as the opening pillar", any: ["takbir", "allahu akbar", "ihram"] },
                    { label: "recitation of al-Fātiḥah", any: ["fatiha", "fatihah", "opening chapter", "umm al"] },
                    { label: "rukūʿ and sujūd", any: ["ruku", "bow", "sujud", "sajd", "prostrat"] },
                    { label: "the final tashahhud and the taslīm", any: ["tashahhud", "taslim", "salam", "final sitting"] }
                ]
            },
            {
                q: "A man forgets. Tell me the difference between forgetting a pillar and forgetting a wājib, describe sujūd al-sahw, and say how doubt is settled.",
                rubric: [
                    { label: "a forgotten pillar must be performed — return to it or repeat the rakʿah", any: ["return", "repeat", "must perform", "cannot be replaced", "redo", "go back", "invalid until"] },
                    { label: "a forgotten wājib is compensated by the prostration", any: ["wajib", "compensat", "made up by", "obligatory act", "suffices"] },
                    { label: "sujūd al-sahw is two prostrations", any: ["two prostrat", "two sujud", "twice"] },
                    { label: "performed before or after the taslīm depending on the case", any: ["before the salam", "after the salam", "before taslim", "after taslim", "either"] },
                    { label: "on doubt, build on what is certain — the lesser number", any: ["certain", "lesser", "fewer", "least", "build on", "yaqin", "sure of"] }
                ]
            }
        ]
    },
    {
        id: "sawm", tier: 1, requires: ["taharah"], station: "musalla",
        title: "Ṣawm", arabic: "الصيام",
        blurb: "What breaks the fast, what merely hollows it, and who is excused.",
        questions: [
            {
                q: "Tell me what nullifies a fast outright, what only drains its reward, and what the one who eats in forgetfulness must do.",
                rubric: [
                    { label: "deliberate eating or drinking nullifies", any: ["eat", "drink", "food", "water"] },
                    { label: "intercourse in Ramaḍān — and its kaffārah", any: ["intercourse", "sexual", "jima", "kaffarah", "expiation"] },
                    { label: "deliberately inducing vomiting", any: ["vomit", "throw up"] },
                    { label: "menstruation or postnatal bleeding", any: ["mens", "hayd", "period", "nifas", "postnatal", "bleeding"] },
                    { label: "forgetful eating does not break it — he completes the fast", any: ["forget", "forgot", "unintention", "does not break", "continue", "complete"] },
                    { label: "backbiting, lying, quarrelling drain the reward without breaking it", any: ["backbit", "ghibah", "lying", "lie", "quarrel", "argu", "reward", "vain speech", "false speech"] },
                    { label: "the missed days are made up (qaḍāʾ)", any: ["qada", "make up", "makeup", "later", "replace the day"] }
                ]
            },
            {
                q: "Who is excused from the fast of Ramaḍān, and what does each of them owe in its place?",
                rubric: [
                    { label: "the traveller — makes the days up", any: ["travel", "journey", "musafir", "safar"] },
                    { label: "the temporarily ill — makes the days up", any: ["ill", "sick", "marid", "disease"] },
                    { label: "the menstruating or postnatal woman — makes the days up", any: ["mens", "hayd", "period", "nifas", "postnatal"] },
                    { label: "the chronically ill and the aged — fidyah, feeding a poor person per day", any: ["fidya", "feed", "elder", "old", "chronic", "permanent", "incurable", "poor person"] },
                    { label: "the pregnant or nursing woman", any: ["pregnan", "nurs", "breastfeed", "expecting"] },
                    { label: "the distinction between qaḍāʾ and fidyah", any: ["qada", "make up", "makeup", "fidya", "feed"] }
                ]
            }
        ]
    },
    {
        id: "seerah_makkah", tier: 1, requires: ["aqidah_tawhid"], station: "maktab",
        title: "Sīrah — Makkah", arabic: "السيرة المكية",
        blurb: "Thirteen years: revelation, persecution, exodus, and the pledges.",
        questions: [
            {
                q: "Walk the Makkan years from Ḥirāʾ to the hijrah. Name three turning points and tell me what each one actually changed.",
                rubric: [
                    { label: "the first revelation in the cave of Ḥirāʾ — Iqraʾ", any: ["hira", "iqra", "cave", "first revelation", "610", "read"] },
                    { label: "the years of private call, then the public summons", any: ["secret", "private", "three year", "public", "safa", "26 214", "warn your"] },
                    { label: "the persecution of the defenceless — Bilāl, Sumayyah, Yāsir", any: ["bilal", "sumayy", "yasir", "ammar", "tortur", "persecut", "slave"] },
                    { label: "the migration to Abyssinia and the Najāshī", any: ["abyssin", "habash", "najashi", "negus", "ethiop"] },
                    { label: "the boycott of Banū Hāshim in the shiʿb", any: ["boycott", "shib", "banu hashim", "valley"] },
                    { label: "ʿĀm al-Ḥuzn — Khadījah and Abū Ṭālib die", any: ["year of sorrow", "am al huzn", "khadij", "abu talib", "grief"] },
                    { label: "Ṭāʾif, and the Isrāʾ wa’l-Miʿrāj", any: ["taif", "isra", "miraj", "night journey", "ascension"] },
                    { label: "the pledges of ʿAqabah opening Yathrib", any: ["aqabah", "aqaba", "pledge", "yathrib", "ansar"] }
                ]
            },
            {
                q: "What did the Makkan revelation spend itself on, and why does that ordering matter for anyone who wants to teach today?",
                rubric: [
                    { label: "tawḥīd and the rejection of idolatry above all", any: ["tawhid", "oneness", "idol", "shirk", "monothe"] },
                    { label: "the resurrection, judgement, the ākhirah", any: ["resurrect", "judgement", "judgment", "akhirah", "hereafter", "afterlife", "accountab"] },
                    { label: "character, and ṣabr under pressure", any: ["character", "akhlaq", "moral", "patien", "sabr", "endur"] },
                    { label: "detailed legislation arriving later, in Madīnah", any: ["madinah", "medina", "later", "legislat", "law came", "rulings came"] },
                    { label: "gradualism (tadarruj) — the staged prohibition of khamr as the classic case", any: ["gradual", "tadarruj", "stages", "step", "khamr", "wine", "alcohol"] },
                    { label: "conviction precedes obligation", any: ["convict", "belief first", "foundation", "before obligation", "iman first", "faith first", "roots"] }
                ]
            }
        ]
    },
    {
        id: "usul_intro", tier: 1, requires: ["aqidah_tawhid"], station: "kutub",
        title: "Uṣūl al-Fiqh", arabic: "أصول الفقه",
        blurb: "The sources, their order, and how general wording meets specific.",
        questions: [
            {
                q: "Name the sources the jurists agree upon, in their order, and tell me what work each one does that the one before it could not.",
                rubric: [
                    { label: "the Qurʾān", any: ["quran", "qur an", "book of allah", "kitab"] },
                    { label: "the Sunnah", any: ["sunnah", "hadith", "prophetic"] },
                    { label: "ijmāʿ — consensus", any: ["ijma", "consensus", "agreement of the scholars"] },
                    { label: "qiyās — analogy", any: ["qiyas", "analog"] },
                    { label: "that the order is a hierarchy, not a list", any: ["order", "hierarch", "rank", "only if", "priority", "sequence", "first"] },
                    { label: "the disputed sources: istiḥsān, maṣlaḥah, ʿurf, and others", any: ["istihsan", "maslah", "urf", "custom", "istishab", "disputed", "contested", "not agreed"] }
                ]
            },
            {
                q: "Distinguish ʿāmm from khāṣṣ, and muṭlaq from muqayyad. Give me one worked example.",
                rubric: [
                    { label: "ʿāmm — wording covering every instance at once", any: ["amm", "general", "covers all", "everyone", "all of"] },
                    { label: "khāṣṣ — wording confined to a specific instance", any: ["khass", "specific", "particular", "restricted to"] },
                    { label: "takhṣīṣ — specification narrowing the general", any: ["takhsis", "specif", "narrow", "carve out", "exception"] },
                    { label: "muṭlaq — unqualified", any: ["mutlaq", "unqualif", "unrestrict", "absolute", "no condition"] },
                    { label: "muqayyad — the same word bearing an added attribute", any: ["muqayyad", "qualif", "restrict", "attribute", "condition attached"] },
                    { label: "a real example — e.g. raqabah freed, qualified elsewhere as muʿminah", any: ["raqaba", "slave", "mumina", "believing", "example", "for instance", "such as"] }
                ]
            }
        ]
    },
    {
        id: "zakah", tier: 2, requires: ["salah"], station: "musalla",
        title: "Zakāh", arabic: "الزكاة",
        blurb: "Threshold, year, rate — and the eight who may receive it.",
        questions: [
            {
                q: "Explain niṣāb and ḥawl, then state the rate on money, and say why crops do not share that rate.",
                rubric: [
                    { label: "niṣāb — the minimum threshold below which nothing is due", any: ["nisab", "threshold", "minimum", "below which"] },
                    { label: "the threshold measured against gold or silver", any: ["gold", "silver", "85", "595", "dinar", "dirham", "gram", "tola"] },
                    { label: "ḥawl — a full lunar year of possession", any: ["hawl", "lunar year", "one year", "full year", "twelve month", "hijri year"] },
                    { label: "2.5% — a quarter of a tenth — on monetary wealth", any: ["2 5", "two and a half", "quarter of a tenth", "one fortieth", "1 40", "fortieth"] },
                    { label: "crops taken at 10% or 5% by irrigation, and at harvest not at year's end", any: ["10", "ten percent", "5", "five percent", "irrigat", "rain", "harvest", "ushr"] }
                ]
            },
            {
                q: "Sūrat al-Tawbah fixes the recipients. Name as many of the eight as your memory holds.",
                rubric: [
                    { label: "the fuqarāʾ — the poor", any: ["fuqara", "faqir", "poor"] },
                    { label: "the masākīn — the needy", any: ["masakin", "miskin", "needy", "destitute"] },
                    { label: "the ʿāmilūn — those employed to collect it", any: ["amil", "collect", "administer", "workers", "officials"] },
                    { label: "al-muʾallafah qulūbuhum — hearts to be reconciled", any: ["muallaf", "hearts", "reconcil", "inclined", "new muslim"] },
                    { label: "fī’l-riqāb — freeing necks", any: ["riqab", "slave", "captive", "free", "bondage"] },
                    { label: "al-ghārimūn — the indebted", any: ["gharim", "debt", "indebted"] },
                    { label: "fī sabīl Allāh", any: ["sabil", "way of allah", "cause of allah", "path of allah"] },
                    { label: "ibn al-sabīl — the stranded traveller", any: ["ibn al sabil", "wayfarer", "traveller", "traveler", "stranded"] }
                ]
            }
        ]
    },
    {
        id: "seerah_madinah", tier: 2, requires: ["seerah_makkah"], station: "maktab",
        title: "Sīrah — Madīnah", arabic: "السيرة المدنية",
        blurb: "A community built from nothing, and a treaty that read like a defeat.",
        questions: [
            {
                q: "Name the first things the Prophet ṣallā Allāhu ʿalayhi wa sallam established on reaching Madīnah, and tell me what problem each one solved.",
                rubric: [
                    { label: "the masjid — Qubāʾ, then the Prophet's masjid", any: ["masjid", "mosque", "quba"] },
                    { label: "the masjid as centre of governance, teaching and assembly, not only prayer", any: ["centre", "center", "school", "govern", "assembly", "court", "shelter", "council", "more than prayer"] },
                    { label: "the muʾākhāh — pairing Muhājirūn with Anṣār", any: ["muakhah", "brotherhood", "pair", "muhajir", "ansar", "twin"] },
                    { label: "brotherhood as the answer to destitute refugees", any: ["poverty", "destitute", "refugee", "left everything", "property", "housing", "economic", "no wealth"] },
                    { label: "the Ṣaḥīfah — the Madīnah covenant with the Jewish tribes", any: ["sahifa", "constitution", "covenant", "charter", "treaty", "jewish", "yahud", "document"] },
                    { label: "one ummah, mutual defence, disputes referred upward", any: ["one ummah", "single community", "defen", "mutual", "dispute", "arbitrat", "referred"] }
                ]
            },
            {
                q: "Ḥudaybiyah is called a manifest victory, yet every clause reads as a concession. Reconcile that for me.",
                rubric: [
                    { label: "the terms that stung — the ten-year truce, returning those who fled to the Muslims, no ʿumrah that year", any: ["truce", "ten year", "return", "sent back", "no umrah", "next year", "turned back", "clause"] },
                    { label: "the Qurʾān naming it fatḥan mubīnā", any: ["fath", "clear victory", "manifest victory", "surah al fath", "mubin"] },
                    { label: "peace opened the way for open daʿwah", any: ["dawah", "preach", "spread", "invit", "call to islam", "freely"] },
                    { label: "the letters to the kings and rulers", any: ["letter", "king", "heraclius", "chosroes", "kisra", "negus", "muqawqis", "emperor"] },
                    { label: "mass entry into Islam in the following two years", any: ["mass", "thousand", "more people", "numbers", "grew", "convert", "entered islam"] },
                    { label: "Quraysh treating with them as a recognised party — and Khaybar, then the conquest", any: ["recogni", "as equals", "legitim", "party", "khaybar", "conquest of makkah", "fath makkah"] }
                ]
            }
        ]
    },
    {
        id: "usul_qiyas", tier: 2, requires: ["usul_intro"], station: "kutub",
        title: "Qiyās", arabic: "القياس",
        blurb: "The four pillars of analogy, and the limits past which it may not go.",
        questions: [
            {
                q: "State the four pillars of qiyās. Then run the wine case through them and name the ʿillah exactly.",
                rubric: [
                    { label: "al-aṣl — the original case carrying the text", any: ["asl", "original", "root case", "source case"] },
                    { label: "al-farʿ — the new case", any: ["far", "branch", "new case", "novel"] },
                    { label: "al-ḥukm — the ruling attached to the original", any: ["hukm", "ruling", "judgement", "judgment"] },
                    { label: "al-ʿillah — the effective cause shared by both", any: ["illah", "cause", "ratio", "reason", "common factor"] },
                    { label: "khamr as the aṣl with its prohibition", any: ["khamr", "wine", "grape", "prohibit", "haram", "forbidden"] },
                    { label: "iskār — intoxication — as the ʿillah, extending to every intoxicant", any: ["iskar", "intoxic", "clouds the mind", "drunk", "every intoxicant", "narcotic", "drug"] }
                ]
            },
            {
                q: "When may qiyās not be used at all? Tell me the conditions the ʿillah must satisfy before you lean on it.",
                rubric: [
                    { label: "no qiyās where an explicit text already governs", any: ["nass", "text", "explicit", "already covered", "no need", "clear text"] },
                    { label: "no qiyās in purely devotional matters — rakʿah counts, rites, fixed measures", any: ["taabbud", "devotional", "ritual", "rakah", "number of", "fixed", "quantit", "hajj rites"] },
                    { label: "the ʿillah must be apparent (ẓāhir), not hidden in intention", any: ["zahir", "apparent", "evident", "observ", "manifest", "not hidden"] },
                    { label: "it must be stable and measurable (munḍabiṭ)", any: ["mundabit", "stable", "consistent", "measur", "constant", "precise", "definite"] },
                    { label: "it must be suitable (munāsib) to the ruling", any: ["munasib", "suitab", "relevan", "appropriate", "connected", "fits"] },
                    { label: "the conclusion may not contradict the aṣl or an established text", any: ["contradict", "conflict", "cannot overturn", "against the text", "oppose"] }
                ]
            }
        ]
    },
    {
        id: "adab_ikhlas", tier: 3, requires: ["salah", "aqidah_tawhid"], station: "maktab",
        title: "Ikhlāṣ", arabic: "الإخلاص",
        blurb: "The synthesis: intention, riyāʾ, and sincerity inside public work.",
        synthesis: true,
        questions: [
            {
                q: "“Actions are but by intentions” — place the ḥadīth, then show me a case where the outward act is flawless and it is still returned to its owner.",
                rubric: [
                    { label: "the ḥadīth of ʿUmar, opening ṣaḥīḥ al-Bukhārī", any: ["umar", "bukhari", "first hadith", "innama", "nawawi", "forty"] },
                    { label: "riyāʾ — performing for the eyes of people — as the nullifier", any: ["riya", "show off", "showing off", "seen", "praise", "reputation", "ostentat", "audience"] },
                    { label: "the ḥadīth of the first three dragged into the Fire — the scholar, the fighter, the giver", any: ["three", "first to be", "fire", "scholar", "martyr", "fighter", "generous", "gave wealth", "recit"] },
                    { label: "that they are told: it was said of you, and so you already had it", any: ["it was said", "already been said", "you were called", "received your", "got what you wanted"] },
                    { label: "both conditions — sincerity and conformity to the Sunnah (mutābaʿah)", any: ["mutaba", "sunnah", "conform", "two condition", "both", "18 110", "righteous deed", "correct form"] }
                ]
            },
            {
                q: "Your work is public by its nature — you teach, you write, you are seen. How is sincerity guarded there without abandoning the work?",
                rubric: [
                    { label: "renewing the intention, repeatedly, during the act and not only before it", any: ["renew", "tajdid", "again", "check", "return to", "during", "repeatedly", "re examine"] },
                    { label: "keeping some deeds entirely hidden as ballast", any: ["secret", "hidden", "private", "conceal", "no one knows", "alone", "night prayer"] },
                    { label: "that abandoning public good for fear of riyāʾ is itself a trap of Shayṭān", any: ["abandon", "leaving the act", "quit", "stop doing", "itself a trap", "shaytan", "worse", "do not leave"] },
                    { label: "aiming at the benefit reaching others, not the impression made", any: ["benefit", "others", "serve", "useful", "help", "not the impression", "outcome"] },
                    { label: "duʿāʾ against shirk — the taught supplication", any: ["dua", "supplicat", "ask allah", "audhu", "seek refuge", "allahumma"] }
                ]
            }
        ]
    }
];

export const MAX_TIER = Math.max.apply(null, NODES.map(n => n.tier));
export const PASS_SCORE = 70;
export const MASTER_SCORE = 90;

// ---------------------------------------------------------------- persistence

const STORAGE_KEY = "atelier.islamic.v1";

function blankState() {
    return {
        version: 1,
        nodes: {},          // id -> { status, score, attempts, lastTested, feedback }
        scrolls: [],        // { id, label, text, at, nodeId } -- what the visitor fed him
        custom: [],         // visitor-created nodes, built from their own scrolls
        brain: "rubric",    // "rubric" | "webllm"
        seenIntro: false
    };
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return blankState();
        return Object.assign(blankState(), JSON.parse(raw));
    } catch (err) {
        console.warn("[atelier] could not read saved progress, starting fresh:", err);
        return blankState();
    }
}

export function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        // Private browsing or a full quota: progress just won't survive a reload.
        console.warn("[atelier] could not save progress:", err);
    }
}

export function resetState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* nothing to undo */ }
    return blankState();
}

export function exportState(state) {
    return JSON.stringify(state, null, 2);
}

// ------------------------------------------------------------------- querying

/** Every node the tree knows: the seeded ones plus whatever the visitor fed him. */
export function allNodes(state) {
    return NODES.concat((state.custom || []).map(c => Object.assign({ custom: true }, c)));
}

/**
 * Status is derived, never trusted from storage alone: a node is locked until
 * its prerequisites pass, so a hand-edited entry can't leave the tree in an
 * impossible shape.
 */
export function statusOf(state, node) {
    const rec = state.nodes[node.id];
    if (rec && (rec.status === "verified" || rec.status === "mastered")) return rec.status;
    const ready = (node.requires || []).every(req => {
        const r = state.nodes[req];
        return r && (r.status === "verified" || r.status === "mastered");
    });
    if (!ready) return "locked";
    if (rec && rec.status === "contested") return "contested";
    return "available";
}

/** What the scholar would test you on next, or null if he has nothing queued. */
export function nextTestable(state) {
    const pool = allNodes(state)
        .map(n => ({ node: n, status: statusOf(state, n) }))
        .filter(x => x.status === "available" || x.status === "contested");
    if (!pool.length) return null;
    // Retry what you stumbled on first, then work up the tiers.
    pool.sort((a, b) => {
        if (a.status !== b.status) return a.status === "contested" ? -1 : 1;
        return (a.node.tier || 0) - (b.node.tier || 0);
    });
    return pool[0].node;
}

export function summary(state) {
    const counts = { locked: 0, available: 0, contested: 0, verified: 0, mastered: 0 };
    const nodes = allNodes(state);
    nodes.forEach(n => { counts[statusOf(state, n)]++; });
    return { total: nodes.length, counts, scrolls: (state.scrolls || []).length };
}

// -------------------------------------------------------------------- scoring

/** Fold diacritics and punctuation so "Ṭahārah" and "taharah" compare equal. */
export function normalise(text) {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
        .trim();
}

/**
 * Rubric grading: each expectation is a set of synonyms, and hitting any one of
 * them scores the point. Crude next to a language model, but deterministic,
 * instant, and able to name exactly which points were missed -- which is the
 * part that actually teaches.
 */
export function gradeAgainstRubric(question, answer) {
    const hay = normalise(answer);
    const rubric = (question && question.rubric) || [];
    if (!rubric.length) return { score: 0, hit: [], missed: [] };
    const hit = [], missed = [];
    rubric.forEach(point => {
        const found = point.any.some(syn => hay.includes(normalise(syn)));
        (found ? hit : missed).push(point.label);
    });
    return { score: Math.round((hit.length / rubric.length) * 100), hit, missed };
}

export function verdictFor(score) {
    if (score >= MASTER_SCORE) return "mastered";
    if (score >= PASS_SCORE) return "verified";
    return "contested";
}

/** Record an attempt and return the stored record. */
export function recordAttempt(state, nodeId, result) {
    const prev = state.nodes[nodeId] || { attempts: 0, best: 0 };
    const status = verdictFor(result.score);
    const passedBefore = prev.status === "verified" || prev.status === "mastered";
    state.nodes[nodeId] = {
        // A pass is never demoted by a later weaker attempt. You cannot unlearn by
        // trying again, and a demotion would silently re-lock everything downstream.
        status: passedBefore ? (status === "mastered" ? "mastered" : prev.status) : status,
        score: result.score,
        best: Math.max(prev.best || 0, result.score),
        attempts: (prev.attempts || 0) + 1,
        lastTested: Date.now(),
        feedback: result.feedback || null,
        missed: result.missed || [],
        lastQuestion: result.question || null,
        lastAnswer: result.answer || null
    };
    saveState(state);
    return state.nodes[nodeId];
}

/** Pick a question for a node, rotating so a retry isn't the identical prompt. */
export function pickQuestion(state, node) {
    const bank = (node && node.questions) || [];
    if (!bank.length) return null;
    const attempts = (state.nodes[node.id] || {}).attempts || 0;
    return bank[attempts % bank.length];
}

// ------------------------------------------------------- visitor-fed material

function slugify(text) {
    return normalise(text).replace(/\s+/g, "_").slice(0, 40) || "scroll";
}

/**
 * Everything the visitor dictates lands here. It becomes a scroll (raw material
 * the model can quote back at them) and a custom tree node graded by self-report
 * against their own words -- which is what spaced recall actually is.
 */
export function addScroll(state, entry) {
    const trimmed = ((entry && entry.text) || "").trim();
    if (!trimmed) return null;
    const cleanLabel = ((entry && entry.label) || "").trim() || trimmed.split(/[.\n]/)[0].slice(0, 48);
    const id = "scroll_" + slugify(cleanLabel) + "_" + Date.now().toString(36);
    const scroll = { id, label: cleanLabel, text: trimmed, at: Date.now() };

    const nodeId = "custom_" + slugify(cleanLabel);
    let node = (state.custom || []).find(c => c.id === nodeId);
    if (node) {
        node.sources.push(id);
        node.text = trimmed;
    } else {
        node = {
            id: nodeId, tier: MAX_TIER + 1, requires: [], station: "maktab",
            title: cleanLabel, arabic: "", custom: true, sources: [id], text: trimmed,
            blurb: "From your own scrolls.",
            questions: [{
                q: "You dictated this to me under “" + cleanLabel + "”. Without looking back at it, " +
                   "put it in your own words — the claims, and what stands behind each one.",
                rubric: null,       // graded by self-report against the original
                selfGrade: true
            }]
        };
        state.custom.push(node);
    }
    scroll.nodeId = nodeId;
    state.scrolls.push(scroll);
    saveState(state);
    return { scroll, node };
}

export function scrollsFor(state, node) {
    const ids = (node && node.sources) || [];
    return (state.scrolls || []).filter(s => ids.includes(s.id));
}

/** Compact context handed to the model so its questions sound like it read your notes. */
export function contextFor(state, node) {
    const lines = [];
    if (node.blurb) lines.push("Topic: " + node.title + " — " + node.blurb);
    scrollsFor(state, node).slice(-3).forEach(s => {
        lines.push("The visitor's own notes: " + s.text.slice(0, 900));
    });
    const rec = state.nodes[node.id];
    if (rec && rec.missed && rec.missed.length) {
        lines.push("Last time they failed to mention: " + rec.missed.slice(0, 4).join("; "));
    }
    return lines.join("\n");
}
