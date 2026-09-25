import { join } from "path";
import { readFileSync } from "fs";

const LEET: Record<string, string> = {
    a: "[a4@]",
    e: "[e3]",
    i: "[i1!|]",
    o: "[o0]",
    s: "[s5$]",
    t: "[t7]",
    l: "[l1|]",
    g: "[g9]",
    b: "[b8]"
};

const escape = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");

// catches leet (sh1t) and split (s.h.i.t) spellings, whole words only
const pattern = (word: string) => {
    const body = [...word].map(ch => LEET[ch] ?? escape(ch)).join("[\\s.\\-_*]{0,2}");
    return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
};

const words = readFileSync(join(import.meta.dir, "..", "..", "static", "chatfilter-words.txt"), "utf8")
    .split("\n")
    .map(l => l.trim().toLowerCase())
    .filter(l => l !== "" && !l.startsWith("#"));

const PATTERNS = words.map(pattern);

// under 13 also loses links, emails and phone numbers
const EXTRA = [
    /https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|gg|io|co|xyz|me|tv|ru)(\/\S*)?/giu,
    /[\w.+-]+@[\w-]+\.[\w.]+/gu,
    /(?<!\d)(?:\d[\s.\-]?){7,}\d(?!\d)/gu,
    /(?<![\p{L}\p{N}])\d{4,}(?![\p{L}\p{N}])/gu
];

const mask = (m: string) => "#".repeat([...m].length);

export const black = (text: string) => PATTERNS.reduce((out, p) => out.replace(p, mask), text);

export const white = (text: string) => EXTRA.reduce((out, p) => out.replace(p, mask), black(text));
