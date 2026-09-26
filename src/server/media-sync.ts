

import { join, resolve } from "path";
import { readdir, stat } from "fs/promises";
import { sql } from "./db";
import { STORAGE, UPLOADS, storage } from "./storage";
import { mediaEntry, mediaKey, mediaRecord, parseKey, contentType } from "./media";

const from = process.argv[2] ?? UPLOADS;

const copy = STORAGE === "cloudflare" || resolve(from) !== resolve(UPLOADS);
const PARALLEL = 16;
const KINDS = ["avatars", "thumbnails", "icons", "catalog", "badges", "gamepasses", "blog", "groups", "places", "assets"];


const inBucket = copy ? await storage.list() : null;
const sizes = new Map((await sql`SELECT kind, id, size FROM media`).map((r: any) => [`${r.kind}/${r.id}`, Number(r.size)]));

const there = async (kind: string, id: number, ext: string, size: number) => {
    const key = mediaKey(kind, id, ext);
    if (inBucket) {
        return inBucket.get(key) === size;
    }
    if (copy) {
        const s = await stat(join(UPLOADS, key)).catch(() => null);
        return s?.size === size;
    }
    return true;
};

type Job = {
    kind: string;
    id: number;
    ext: string;
    path: string;
    size: number;
};

const jobs: Job[] = [];
let skipped = 0;
for (const kind of KINDS) {
    const dir = join(from, kind);
    for (const name of await readdir(dir).catch(() => [] as string[])) {
        const parsed = parseKey(`${kind}/${name}`);
        if (!parsed) {
            continue;
        }
        const path = join(dir, name);
        const size = (await stat(path)).size;
        const known = await mediaEntry(parsed.kind, parsed.id);
        if (known && known.ext === parsed.ext && sizes.get(`${parsed.kind}/${parsed.id}`) === size && await there(parsed.kind, parsed.id, parsed.ext, size)) {
            skipped++;
            continue;
        }
        jobs.push({
            ...parsed,
            path,
            size
        });
    }
}

let done = 0;
let pushed = 0;
let failed = 0;
const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
        try {
            if (copy) {
                await storage.put(mediaKey(job.kind, job.id, job.ext), Bun.file(job.path), contentType(job.ext));
                pushed++;
            }
            await mediaRecord(job.kind, job.id, job.ext, job.size);
            done++;
            if (done % 50 === 0) {
                console.log(`${done} done, ${jobs.length} to go`);
            }
        } catch (err) {
            failed++;
            console.error(`${job.kind}/${job.id}.${job.ext}: ${err instanceof Error ? err.message : err}`);
        }
    }
};

console.log(`${jobs.length} to sync, ${skipped} already there`);
await Promise.all(Array.from({ length: PARALLEL }, worker));
console.log(`done: ${done} recorded, ${pushed} copied, ${failed} failed`);
await sql.close();
