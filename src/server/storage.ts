import { join, dirname } from "path";
import { mkdir, rename, unlink } from "fs/promises";



const env = process.env;
export const STORAGE = (env.STORAGE ?? "local").toLowerCase() === "cloudflare" ? "cloudflare" : "local";
export const UPLOADS = env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
export const CDN_URL = (env.CDN_URL ?? "").replace(/\/+$/, "");

const PREFIX = (env.R2_PREFIX ?? "").replace(/^\/+|\/+$/g, "");

const s3 = STORAGE === "cloudflare"
    ? new Bun.S3Client({
        accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
        bucket: env.R2_BUCKET ?? "",
        endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID ?? ""}.r2.cloudflarestorage.com`,
        region: "auto"
    })
    : null;

if (s3 && (!env.R2_BUCKET || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !CDN_URL)) {
    console.warn("STORAGE=cloudflare needs R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CDN_URL");
}

const objectKey = (key: string) => (PREFIX ? `${PREFIX}/${key}` : key);

type Data = Blob | Uint8Array | string;

export const storage = {

    put: async (key: string, data: Data, type: string) => {
        if (s3) {
            await s3.write(objectKey(key), data as any, {
                type
            });
            return;
        }
        const target = join(UPLOADS, key);
        await mkdir(dirname(target), {
            recursive: true
        });
        const temp = `${target}.incoming-${crypto.randomUUID().slice(0, 8)}`;
        await Bun.write(temp, data);
        try {
            await rename(temp, target);
        } catch (err) {
            await unlink(temp).catch(() => {});
            throw err;
        }
    },

    remove: async (key: string) => {
        if (s3) {
            await s3.delete(objectKey(key)).catch(() => {});
            return;
        }
        await unlink(join(UPLOADS, key)).catch(() => {});
    },


    open: async (key: string) => {
        if (s3) {
            const file = s3.file(objectKey(key));
            return await file.exists() ? file : null;
        }
        const file = Bun.file(join(UPLOADS, key));
        return await file.exists() ? file : null;
    },


    stream: async (key: string, type: string, cache = "no-cache") => {
        const file = await storage.open(key);
        if (!file) {
            return null;
        }
        return new Response(file.stream(), {
            headers: {
                "Content-Type": type,
                "Cache-Control": cache
            }
        });
    },

    copy: async (from: string, to: string, type: string) => {
        const file = await storage.open(from);
        if (!file) {
            return false;
        }
        await storage.put(to, new Uint8Array(await file.arrayBuffer()), type);
        return true;
    },


    list: async () => {
        if (!s3) {
            return null;
        }
        const out = new Map<string, number>();
        let token: string | undefined;
        do {
            const page = await s3.list({
                prefix: PREFIX ? `${PREFIX}/` : undefined,
                continuationToken: token,
                maxKeys: 1000
            });
            for (const o of page.contents ?? []) {
                out.set(PREFIX ? o.key.slice(PREFIX.length + 1) : o.key, o.size ?? 0);
            }
            token = page.isTruncated ? page.nextContinuationToken : undefined;
        } while (token);
        return out;
    },

    publicUrl: (key: string) => (s3 ? `${CDN_URL}/${key}` : `/uploads/${key}`)
};
