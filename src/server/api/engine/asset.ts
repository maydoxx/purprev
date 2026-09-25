import { Elysia, t } from "elysia";
import { join } from "path";
import { mkdir, stat, utimes, writeFile } from "fs/promises";
import { sql } from "../../db";
import { UPLOADS } from "../../paths";
import { mediaStream } from "../../media";
import { SITE_URL, assetUrl } from "../../site";
import { text } from "./sign";

// remember what roblox refused or every place load re-asks the same dead ids at 1.5s each
// only roblox ids, a miss on one of ours just means the upload isnt done (develop ids start at 3 billion)
const MISS_DIR = join(UPLOADS, "assetcache");
const MISS_TTL = 86400;
const cacheable = (id: number) => id >= 1000000 && id < 3000000000;

const missing = async (id: number) => {
    try {
        const s = await stat(join(MISS_DIR, `missing-${id}`));
        return Date.now() - s.mtimeMs < MISS_TTL * 1000;
    } catch {
        return false;
    }
};

const rememberMissing = async (id: number) => {
    await mkdir(MISS_DIR, {
        recursive: true
    });
    const file = join(MISS_DIR, `missing-${id}`);
    await writeFile(file, "").catch(() => {});
    await utimes(file, new Date(), new Date()).catch(() => {});
};

const unavailable = () =>
    new Response("asset unavailable", {
        status: 404,
        headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "private, max-age=3600"
        }
    });

// 401/403/404/409 from roblox has to be answered as 404, 409 makes the engine retry forever
const proxy = async (id: number) => {
    const cookie = process.env.ROBLOX_COOKIE ?? "";
    if (!cookie) {
        return new Response("Asset proxy is not configured: set ROBLOX_COOKIE", {
            status: 500
        });
    }

    let res: Response;
    try {
        res = await fetch(`https://assetdelivery.roblox.com/v1/asset?id=${id}`, {
            headers: {
                Cookie: `.ROBLOSECURITY=${cookie}`,
                "User-Agent": "Roblox/WinInet"
            },
            redirect: "follow",
            signal: AbortSignal.timeout(30000)
        });
    } catch {
        return new Response("Upstream request failed\n", {
            status: 502,
            headers: {
                "Content-Type": "text/plain; charset=utf-8"
            }
        });
    }

    if ([401, 403, 404, 409].includes(res.status)) {
        if (cacheable(id)) {
            await rememberMissing(id);
        }
        return unavailable();
    }

    return new Response(await res.arrayBuffer(), {
        status: res.status,
        headers: {
            "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
            "Cache-Control": "private, max-age=3600"
        }
    });
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

const routes = (prefix: string) => new Elysia({ prefix })
    // uploaded place > develop upload > roblox through the cookie
    .get("/", async ({ query }) => {
        const id = query.id;
        const place = await mediaStream("places", id);
        if (place) {
            return place;
        }

        const local = await mediaStream("assets", id, "public, max-age=86400");
        if (local) {
            return local;
        }

        if (cacheable(id) && await missing(id)) {
            return unavailable();
        }
        return proxy(id);
    }, {
        query: t.Object({
            id: t.Numeric()
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

    // asset urls separated by ";", the first one is the BodyColors.ashx url
    // ?assetId= gives just that one, the thumbnailer puts a single catalog item on a default character
    .get("/CharacterFetch.ashx", async ({ query, status }) => {
        if (query.assetId !== undefined) {
            return text(assetUrl(query.assetId));
        }
        if (query.userId === undefined) {
            return status(400, "userId missing");
        }

        const worn = await sql`
            SELECT catalog_items.asset_id FROM user_items
            JOIN catalog_items ON catalog_items.id = user_items.item_id
            WHERE user_items.user_id = ${query.userId} AND user_items.wearing = 1 AND catalog_items.asset_id IS NOT NULL
            ORDER BY catalog_items.category, catalog_items.id
        `;
        const urls = [`${SITE_URL}/Asset/BodyColors.ashx?userId=${query.userId}`, ...worn.map((w: any) => assetUrl(Number(w.asset_id)))];
        return text(urls.join(";"));
    }, {
        query: t.Object({
            userId: t.Optional(t.Numeric()),
            assetId: t.Optional(t.Numeric())
        })
    })

export const asset = new Elysia()
    .use(routes("/asset"))
    .use(routes("/Asset"))
