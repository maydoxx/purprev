import { join } from "path";
import { stat } from "fs/promises";
import { sql, now } from "./db";
import { storage, STORAGE, UPLOADS } from "./storage";



export type MediaKind = "avatars" | "headshots" | "avatars3d" | "thumbnails" | "icons" | "catalog" | "badges" | "gamepasses" | "blog" | "groups" | "places" | "assets" | "ads" | "outfits" | "catalog3d";

export const TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tga: "image/x-tga",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    rbxl: "application/octet-stream",
    rbxm: "application/octet-stream",
    rbxmx: "application/octet-stream",
    json: "application/json"
};

export const contentType = (ext: string) => TYPES[ext.toLowerCase()] ?? "application/octet-stream";

// Roblox binary format magic bytes: <roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" ...
// Binary format starts with version byte (0x00) + length-prefixed strings
// XML format (.rbxmx) starts with "<roblox" or "<?xml"

const ROBLOX_BINARY_MAGIC = new Uint8Array([0x00]); // Simplified - actual format is more complex

function looksLikeRobloxBinary(bytes: Uint8Array): boolean {
    // Roblox binary format: first byte is version (usually 0), then length-prefixed strings
    // At minimum, check for reasonable structure
    if (bytes.length < 4) return false;
    // Check for XML declaration or roblox root element at start (for XML format)
    const header = new TextDecoder("ascii", { fatal: false }).decode(bytes.slice(0, 100));
    if (header.startsWith("<?xml") || header.startsWith("<roblox")) {
        return false; // This is XML format, not binary
    }
    // For binary, we can't easily validate without full parser
    // But we can check it doesn't look like malicious XML
    return true;
}

// Proper XXE-safe XML parsing - only for XML-based formats (.rbxmx)
export const unsafeXml = (bytes: Uint8Array, ext?: string): boolean => {
    // If it's a known binary format, do basic sanity check
    if (ext === "rbxl" || ext === "rbxm") {
        return !looksLikeRobloxBinary(bytes);
    }

    // For XML formats (.rbxmx, .xml), use proper parsing with XXE protection
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    // Quick heuristic: if it doesn't look like XML at all, skip deep parsing
    if (!text.includes("<") || !text.includes(">")) {
        return false;
    }

    try {
        // Use DOMParser with no external entity resolution
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");

        // Check for parser errors
        const parserError = doc.querySelector("parsererror");
        if (parserError) {
            // If it's not valid XML, fall back to regex check
            return /xmlns(:\w+)?\s*=\s*["']https?:\/\/www\.w3\.org\/(1999\/xhtml|2000\/svg)|<!(DOCTYPE|ENTITY)/i.test(text);
        }

        // Walk the DOM and check for dangerous constructs
        const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT_TYPE);
        let node: Node | null = walker.nextNode();
        while (node) {
            if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
                // DOCTYPE declaration - potential XXE vector
                return true;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                // Check for external entity references in attributes
                for (const attr of element.attributes) {
                    if (attr.value.includes("ENTITY") || attr.value.includes("SYSTEM") || attr.value.includes("PUBLIC")) {
                        return true;
                    }
                    // Check for dangerous xmlns
                    if (attr.name.startsWith("xmlns") && /^https?:\/\/www\.w3\.org\/(1999\/xhtml|2000\/svg)$/i.test(attr.value)) {
                        return true;
                    }
                }
            }
            node = walker.nextNode();
        }
        return false;
    } catch {
        // If parsing fails, fall back to regex
        return /xmlns(:\w+)?\s*=\s*["']https?:\/\/www\.w3\.org\/(1999\/xhtml|2000\/svg)|<!(DOCTYPE|ENTITY)/i.test(text);
    }
};

// headshots and 3d scenes live next to the image they belong to
const SUFFIX: Record<string, [string, string]> = {
    headshots: ["avatars", "-headshot"],
    avatars3d: ["avatars", "-3d"],
    catalog3d: ["catalog", "-3d"]
};

export const mediaKey = (kind: string, id: number, ext: string) =>
    SUFFIX[kind] ? `${SUFFIX[kind][0]}/${id}${SUFFIX[kind][1]}.${ext}` : `${kind}/${id}.${ext}`;


export const parseKey = (key: string) => {
    const m = /^([a-z]+)\/(\d+)(-headshot|-3d)?\.([a-z0-9]+)$/i.exec(key);
    if (!m) {
        return null;
    }
    const kind = m[3] ? Object.keys(SUFFIX).find(k => SUFFIX[k]![0] === m[1] && SUFFIX[k]![1] === m[3]) : m[1];
    if (!kind) {
        return null;
    }
    return {
        kind,
        id: Number(m[2]),
        ext: m[4]!.toLowerCase()
    };
};

type Entry = {
    ext: string;
    updated_at: number;
};

let cache: Map<string, Entry> | null = null;
let loadedAt = 0;


const load = async () => {
    if (!cache || Date.now() - loadedAt > 60000) {
        const rows = await sql`SELECT kind, id, ext, updated_at FROM media`;
        cache = new Map(rows.map((r: any) => [`${r.kind}/${r.id}`, {
            ext: r.ext,
            updated_at: Number(r.updated_at)
        }]));
        loadedAt = Date.now();
    }
    return cache;
};

const EXTS = ["png", "jpg", "jpeg", "gif", "webp", "rbxl", "rbxmx", "rbxm", "mp3", "ogg", "wav"];
const misses = new Map<string, number>();


const probe = async (kind: string, id: number) => {
    const k = `${kind}/${id}`;
    if (STORAGE !== "local" || (misses.get(k) ?? 0) > Date.now()) {
        return null;
    }
    for (const ext of EXTS) {
        const info = await stat(join(UPLOADS, mediaKey(kind, id, ext))).catch(() => null);
        if (info?.isFile()) {
            await mediaRecord(kind, id, ext, info.size);
            return (await load()).get(k) ?? null;
        }
    }
    misses.set(k, Date.now() + 30000);
    return null;
};

export const mediaEntry = async (kind: string, id: number) => (await load()).get(`${kind}/${id}`) ?? await probe(kind, id);

export const mediaHas = async (kind: string, id: number) => (await mediaEntry(kind, id)) !== null;


export const mediaUrl = async (kind: string, id: number) => {
    const e = await mediaEntry(kind, id);
    return e ? `${storage.publicUrl(mediaKey(kind, id, e.ext))}?v=${e.updated_at}` : "";
};


export const mediaRecord = async (kind: string, id: number, ext: string, size: number) => {
    // not mediaEntry, probe calls us
    const old = (await load()).get(`${kind}/${id}`);
    if (old && old.ext !== ext) {
        await storage.remove(mediaKey(kind, id, old.ext));
    }
    const at = now();
    await sql`
        INSERT INTO media (kind, id, ext, size, updated_at) VALUES (${kind}, ${id}, ${ext}, ${size}, ${at})
        ON CONFLICT (kind, id) DO UPDATE SET ext = ${ext}, size = ${size}, updated_at = ${at}
    `;
    (await load()).set(`${kind}/${id}`, {
        ext,
        updated_at: at
    });
};

export const mediaPut = async (kind: string, id: number, ext: string, data: Blob | Uint8Array | string) => {
    await storage.put(mediaKey(kind, id, ext), data, contentType(ext));
    const size = typeof data === "string" ? Buffer.byteLength(data) : data instanceof Blob ? data.size : data.byteLength;
    await mediaRecord(kind, id, ext, size);
    return mediaUrl(kind, id);
};

export const mediaRemove = async (kind: string, id: number) => {
    const e = await mediaEntry(kind, id);
    if (!e) {
        return;
    }
    await storage.remove(mediaKey(kind, id, e.ext));
    await sql`DELETE FROM media WHERE kind = ${kind} AND id = ${id}`;
    (await load()).delete(`${kind}/${id}`);
};

export const mediaCopy = async (from: string, to: string, id: number) => {
    const e = await mediaEntry(from, id);
    if (!e) {
        return "";
    }
    const old = await mediaEntry(to, id);
    if (old && old.ext !== e.ext) {
        await storage.remove(mediaKey(to, id, old.ext));
    }
    await storage.copy(mediaKey(from, id, e.ext), mediaKey(to, id, e.ext), contentType(e.ext));
    const [row] = await sql`SELECT size FROM media WHERE kind = ${from} AND id = ${id}`;
    await mediaRecord(to, id, e.ext, Number(row?.size ?? 0));
    return mediaUrl(to, id);
};


export const mediaStream = async (kind: string, id: number, cache = "no-cache") => {
    const e = await mediaEntry(kind, id);
    return e ? storage.stream(mediaKey(kind, id, e.ext), contentType(e.ext), cache) : null;
};
