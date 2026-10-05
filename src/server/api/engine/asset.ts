import { Elysia, t } from "elysia";
import { join } from "path";
import { mkdir, stat, utimes, writeFile } from "fs/promises";
import { characterMesh, characterMeshXml } from "../../rbxm";
import { sql } from "../../db";
import { UPLOADS } from "../../paths";
import { mediaHas, mediaStream } from "../../media";
import { SITE_URL, assetUrl } from "../../site";
import { session, type User } from "../../session";
import { isInternal } from "./internal";
import { text } from "./sign";



const CACHE_DIR = join(UPLOADS, "assetcache");
const MISS_TTL = 86400;
const cacheable = (id: number) => id >= 1000000 && id < 3000000000;

const missing = async (id: number) => {
    try {
        const s = await stat(join(CACHE_DIR, `missing-${id}`));
        return Date.now() - s.mtimeMs < MISS_TTL * 1000;
    } catch {
        return false;
    }
};

const rememberMissing = async (id: number) => {
    await mkdir(CACHE_DIR, {
        recursive: true
    });
    const file = join(CACHE_DIR, `missing-${id}`);
    await writeFile(file, "").catch(() => {});
    await utimes(file, new Date(), new Date()).catch(() => {});
};

const stored = (id: number) => Bun.file(join(CACHE_DIR, `${id}.bin`));

const remember = async (id: number, bytes: Uint8Array<ArrayBuffer> | string) => {
    await mkdir(CACHE_DIR, {
        recursive: true
    });
    await Bun.write(stored(id), bytes).catch(() => {});
};

const blob = (body: Uint8Array<ArrayBuffer> | string | Bun.BunFile) =>
    new Response(body, {
        headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "private, max-age=3600"
        }
    });

const forEngine = (bytes: Uint8Array<ArrayBuffer>) => {
    const cm = characterMesh(bytes);
    return cm ? characterMeshXml(cm) : bytes;
};

const unavailable = () =>
    new Response("asset unavailable", {
        status: 404,
        headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "private, max-age=3600"
        }
    });

const failed = () =>
    new Response("Upstream request failed\n", {
        status: 502,
        headers: {
            "Content-Type": "text/plain; charset=utf-8"
        }
    });


const proxy = async (id: number) => {
    const cookie = process.env.ROBLOX_COOKIE ?? "";
    if (!cookie) {
        return new Response("Asset proxy is not configured: set ROBLOX_COOKIE", {
            status: 500
        });
    }

    let res: Response;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
        res = await fetch(`https://assetdelivery.roblox.com/v1/asset?id=${id}`, {
            headers: {
                Cookie: `.ROBLOSECURITY=${cookie}`,
                "User-Agent": "Roblox/WinInet"
            },
            redirect: "follow",
            signal: AbortSignal.timeout(30000)
        });
        // a 401 is our cookie expiring, not the asset going away
        if (res.status === 401) {
            console.warn(`asset ${id} upstream: 401, check ROBLOX_COOKIE`);
            return failed();
        }
        if ([403, 404, 409].includes(res.status)) {
            if (cacheable(id)) {
                await rememberMissing(id);
            }
            return unavailable();
        }
        bytes = new Uint8Array(await res.arrayBuffer());
    } catch (err) {
        console.warn(`asset ${id} upstream: ${err instanceof Error ? err.message : err}`);
        return failed();
    }

    if (!res.ok) {
        return new Response(bytes, {
            status: res.status
        });
    }
    const body = forEngine(bytes);
    if (cacheable(id)) {
        await remember(id, body);
    }
    return blob(body);
};

const bodyColorsXml = async (userId: number) => {
    const [row] = await sql`SELECT * FROM user_avatar WHERE user_id = ${userId}`;
    const c = {
        head_color: 24,
        torso_color: 23,
        left_arm_color: 24,
        right_arm_color: 24,
        left_leg_color: 119,
        right_leg_color: 119,
        ...(row ?? {})
    };
    return `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
\t<External>null</External>
\t<External>nil</External>
\t<Item class="BodyColors" referent="RBX0">
\t\t<Properties>
\t\t\t<int name="HeadColor">${c.head_color}</int>
\t\t\t<int name="LeftArmColor">${c.left_arm_color}</int>
\t\t\t<int name="LeftLegColor">${c.left_leg_color}</int>
\t\t\t<string name="Name">Body Colors</string>
\t\t\t<int name="RightArmColor">${c.right_arm_color}</int>
\t\t\t<int name="RightLegColor">${c.right_leg_color}</int>
\t\t\t<int name="TorsoColor">${c.torso_color}</int>
\t\t</Properties>
\t</Item>
</roblox>
`;
};

// everyone else gets teto
const mayLoadPlace = async (id: number, user: User | null, request: Request, server: any) => {
    if (isInternal(request, server)) {
        return true;
    }
    const [game] = await sql`SELECT creator_id, copylocked FROM games WHERE id = ${id}`;
    if (!game) {
        return false;
    }
    if (Number(game.copylocked) === 0) {
        return true;
    }
    return !!user && (user.admin > 0 || user.id === Number(game.creator_id));
};

const TETO = join(import.meta.dir, "../../static/teto.mp4");

const teto = () =>
    new Response(Bun.file(TETO), {
        headers: {
            "Content-Type": "video/mp4",
            "Cache-Control": "private, max-age=3600"
        }
    });

const itemUrls = (item: any) => {
    if (item.category === "Package") {
        return String(item.package_parts ?? "").split(";").map(Number).filter(n => n > 0).map(assetUrl);
    }
    return item.asset_id ? [assetUrl(Number(item.asset_id))] : [];
};

const routes = (prefix: string) => new Elysia({ prefix })
    .use(session)

    .get("/", async ({ query, status, user, request, server }) => {
        // no asset versions here, the toolbox hands out AssetVersionId = AssetId
        const id = query.id ?? query.ID ?? query.assetversionid;
        if (id === undefined) {
            return status(400, "id missing");
        }
        if (await mediaHas("places", id)) {
            if (!await mayLoadPlace(id, user, request, server)) {
                return teto();
            }
            const place = await mediaStream("places", id);
            if (place) {
                return place;
            }
        }

        const local = await mediaStream("assets", id, "public, max-age=86400");
        if (local) {
            return local;
        }

        if (cacheable(id)) {
            if (await stored(id).exists()) {
                return blob(stored(id));
            }
            if (await missing(id)) {
                return unavailable();
            }
        }
        return proxy(id);
    }, {
        query: t.Object({
            id: t.Optional(t.Numeric()),
            ID: t.Optional(t.Numeric()),
            assetversionid: t.Optional(t.Numeric())
        })
    })

    .get("/BodyColors.ashx", async ({ query }) =>
        new Response(await bodyColorsXml(query.userId), {
            headers: {
                "Content-Type": "application/xml"
            }
        }), {
        query: t.Object({
            userId: t.Numeric()
        })
    })



    .get("/CharacterFetch.ashx", async ({ query, status }) => {
        if (query.assetId !== undefined) {
            return text(assetUrl(query.assetId));
        }
        if (query.itemId !== undefined) {
            const [item] = await sql`SELECT category, asset_id, package_parts FROM catalog_items WHERE id = ${query.itemId}`;
            return text(item ? itemUrls(item).join(";") : "");
        }
        if (query.userId === undefined) {
            return status(400, "userId missing");
        }

        const worn = await sql`
            SELECT catalog_items.category, catalog_items.asset_id, catalog_items.package_parts FROM user_items
            JOIN catalog_items ON catalog_items.id = user_items.item_id
            WHERE user_items.user_id = ${query.userId} AND user_items.wearing = 1
            ORDER BY catalog_items.category, catalog_items.id
        `;
        const urls = [`${SITE_URL}/Asset/BodyColors.ashx?userId=${query.userId}`, ...worn.flatMap(itemUrls)];
        return text(urls.join(";"));
    }, {
        query: t.Object({
            userId: t.Optional(t.Numeric()),
            assetId: t.Optional(t.Numeric()),
            itemId: t.Optional(t.Numeric())
        })
    })

export const asset = new Elysia()
    .use(routes("/asset"))
    .use(routes("/Asset"))
