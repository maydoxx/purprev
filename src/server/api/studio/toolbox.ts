import { join } from "path";
import { mkdir } from "fs/promises";
import { sql } from "../../db";
import { UPLOADS } from "../../storage";
import { mediaStream } from "../../media";
import { SITE_URL } from "../../site";

// roblox's toolbox too, the asset proxy fetches them
const ROBLOX = process.env.TOOLBOX_ROBLOX !== "0";
const OWN_IDS = 3000000000;
const THUMB_DIR = join(UPLOADS, "assetcache");
const TYPE_IDS: Record<string, number> = {
    Model: 10,
    Decal: 13
};

export type ToolboxItem = {
    AssetId: number;
    AssetVersionId: number;
    Name: string;
    CreatorName: string;
    CreatedUtc: string;
    UpdatedUtc: string;
    FavoritedCount: number;
    Thumbnail: {
        Final: boolean;
        Url: string;
        RetryUrl: null;
    };
};

const stamp = (t: number | string) => new Date(Number(t) * 1000).toISOString();

export const thumbUrl = (id: number) => `${SITE_URL}/Game/Tools/ThumbnailAsset.ashx?aid=${id}&fmt=png&wd=100&ht=100`;

const item = (id: number, name: string, creator: string, created: string, updated = created): ToolboxItem => ({
    AssetId: id,
    AssetVersionId: id,
    Name: name,
    CreatorName: creator,
    CreatedUtc: created,
    UpdatedUtc: updated,
    FavoritedCount: 0,
    Thumbnail: {
        Final: true,
        Url: thumbUrl(id),
        RetryUrl: null
    }
});

export const searchOwn = async (kind: "Model" | "Decal", q: string, page: number, per: number, userId: number | null) => {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const where = userId === null
        ? sql`a.type = ${kind} AND a.parent_id IS NULL AND a.name LIKE ${like}`
        : sql`a.type = ${kind} AND a.parent_id IS NULL AND a.creator_id = ${userId} AND a.name LIKE ${like}`;
    const [count] = await sql`SELECT COUNT(*) AS n FROM assets a WHERE ${where}`;
    const rows = await sql`
        SELECT a.id, a.name, a.created_at, users.username FROM assets a
        LEFT JOIN users ON users.id = a.creator_id
        WHERE ${where}
        ORDER BY a.id DESC LIMIT ${per} OFFSET ${(page - 1) * per}
    `;
    return {
        total: Number(count?.n ?? 0),
        items: rows.map((r: any) => item(Number(r.id), r.name, r.username ?? "NoneRev", stamp(r.created_at)))
    };
};

const get = async (url: string) => {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 NoneRev"
        },
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
        throw new Error(`${url} -> ${res.status}`);
    }
    return res.json() as Promise<any>;
};

export const searchRoblox = async (kind: "Model" | "Decal", q: string, page: number, per: number) => {
    if (!ROBLOX) {
        return {
            total: 0,
            items: [] as ToolboxItem[]
        };
    }
    try {
        const found = await get(`https://apis.roblox.com/toolbox-service/v1/marketplace/${TYPE_IDS[kind]}?limit=${per}&pageNumber=${page - 1}&keyword=${encodeURIComponent(q)}`);
        const ids: number[] = (found.data ?? []).map((d: any) => Number(d.id)).filter((n: number) => n > 0);
        if (!ids.length) {
            return {
                total: 0,
                items: [] as ToolboxItem[]
            };
        }
        const details = await get(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${ids.join(",")}`);
        const byId = new Map<number, any>((details.data ?? []).map((d: any) => [Number(d.asset?.id), d]));
        return {
            total: Number(found.totalResults ?? ids.length),
            items: ids.map(id => {
                const d = byId.get(id);
                return item(id, d?.asset?.name ?? `Asset ${id}`, d?.creator?.name ?? "Roblox", d?.asset?.createdUtc ?? "", d?.asset?.updatedUtc ?? "");
            })
        };
    } catch (err) {
        console.warn("toolbox: roblox search failed:", err instanceof Error ? err.message : err);
        return {
            total: 0,
            items: [] as ToolboxItem[]
        };
    }
};

// own stuff first
export const searchFree = async (kind: "Model" | "Decal", q: string, page: number, per: number) => {
    const own = await searchOwn(kind, q, page, per, null);
    if (own.items.length >= per) {
        return own;
    }
    const roblox = await searchRoblox(kind, q, page, per - own.items.length);
    return {
        total: own.total + roblox.total,
        items: [...own.items, ...roblox.items]
    };
};

const notFound = () =>
    new Response("no thumbnail", {
        status: 404,
        headers: {
            "Cache-Control": "private, max-age=600"
        }
    });

const png = (file: Bun.BunFile | Uint8Array<ArrayBuffer>) =>
    new Response(file, {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400"
        }
    });

// roblox ones are cached on disk
export const thumbnail = async (id: number, placeholder: string, wanted = 150) => {
    const size = wanted >= 420 ? 420 : 150;
    if (id < 1000000) {
        const [game] = await sql`SELECT id FROM games WHERE id = ${id}`;
        if (game) {
            return (await mediaStream("thumbnails", id, "public, max-age=3600")) ?? png(Bun.file(placeholder));
        }
        const [item] = await sql`SELECT id FROM catalog_items WHERE id = ${id}`;
        if (item) {
            return (await mediaStream("catalog", id, "public, max-age=3600")) ?? png(Bun.file(placeholder));
        }
    }
    if (id >= OWN_IDS) {
        const [asset] = await sql`SELECT type FROM assets WHERE id = ${id}`;
        if (asset?.type === "Decal" || asset?.type === "Image") {
            return (await mediaStream("assets", id, "public, max-age=86400")) ?? png(Bun.file(placeholder));
        }
        // catalog items made here have their own rendered picture
        const [item] = await sql`SELECT id FROM catalog_items WHERE asset_id = ${id}`;
        if (item) {
            return (await mediaStream("catalog", Number(item.id), "public, max-age=86400")) ?? png(Bun.file(placeholder));
        }
        return png(Bun.file(placeholder));
    }

    const cached = Bun.file(join(THUMB_DIR, `thumb-${id}-${size}.png`));
    if (await cached.exists()) {
        return png(cached);
    }
    if (!ROBLOX) {
        return notFound();
    }
    try {
        const info = await get(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=${size}x${size}&format=Png`);
        const url = info.data?.[0]?.imageUrl;
        if (!url) {
            return notFound();
        }
        const res = await fetch(url, {
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) {
            return notFound();
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        await mkdir(THUMB_DIR, {
            recursive: true
        });
        await Bun.write(cached, bytes);
        return png(bytes);
    } catch {
        return notFound();
    }
};
