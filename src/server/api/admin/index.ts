import { Elysia, t } from "elysia";
import { join } from "path";
import { session } from "../../session";
import { sql, now } from "../../db";
import { saveImage, mediaUrl, mediaHas, clearMedia, UploadError } from "../../paths";
import { lookupRobloxAsset, lookupRobloxBundle, storeThumbnail } from "../../roblox";
import { rcc } from "../../rcc";
import { CATEGORIES as BLOG_CATEGORIES } from "../site/blog";
import { siteSettings, setSiteSetting } from "../../settings";
import { isTier } from "../../membership";
import { ONLINE_WINDOW } from "../../friends";
import { GENRES, isGenre } from "../../games";
import { cleanPromo, promoItems, PROMO_CODE } from "../../promo";

const PER_PAGE = 20;
const BLOG_IMAGE_BYTES = 6 * 1024 * 1024;
const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BANNER_STYLES = ["info", "warning", "success"];
const ITEM_CATEGORIES = ["Hat", "Face", "T-Shirt", "Shirt", "Pants", "Gear", "Package"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const GAME_CARD_CODE = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const letters = Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    return letters.match(/.{4}/g)!.join("-");
};


const MODERATION: Record<string, [number, number]> = {
    warning: [1, 0],
    ban1d: [2, 86400],
    ban3d: [3, 259200],
    ban7d: [4, 604800],
    ban14d: [5, 1209600],
    account_deletion: [6, 0],
    reminder: [7, 0]
};


const id = t.Object({
    id: t.Numeric()
});
const promoBody = t.Object({
    code: t.String({
        maxLength: 60
    }),
    items: t.Array(t.Integer(), {
        maxItems: 10
    }),
    nonebux: t.Optional(t.Integer()),
    tix: t.Optional(t.Integer()),
    maxUses: t.Optional(t.Integer()),
    startsAt: t.Optional(t.String()),
    expiresAt: t.Optional(t.String())
});
const list = t.Object({
    q: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    status: t.Optional(t.String())
});

const banner = t.Object({
    message: t.String(),
    linkText: t.Optional(t.String()),
    linkUrl: t.Optional(t.String()),
    style: t.Optional(t.String()),
    enabled: t.Optional(t.Boolean()),
    dismissible: t.Optional(t.Boolean()),
    startsAt: t.Optional(t.String()),
    endsAt: t.Optional(t.String())
});

const post = t.Object({
    title: t.String(),
    excerpt: t.Optional(t.String()),
    body: t.String(),
    category: t.String(),
    is_published: t.Optional(t.BooleanString()),
    image: t.Optional(t.File({ type: "image" }))
});


const item = t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String()),
    creator: t.String(),
    category: t.Optional(t.String()),
    asset_id: t.Optional(t.Numeric()),
    price: t.Optional(t.Numeric({
        minimum: 0,
        maximum: 2147483647
    })),
    tix_price: t.Optional(t.Numeric({
        minimum: 0,
        maximum: 2000000000
    })),
    thumbnail: t.Optional(t.String()),
    is_featured: t.Optional(t.Boolean()),
    is_limited: t.Optional(t.Boolean()),
    is_limited_unique: t.Optional(t.Boolean()),
    limited_stock: t.Optional(t.Numeric({
        minimum: 0,
        maximum: 2147483647
    })),
    bc_only: t.Optional(t.Boolean()),
    is_starter: t.Optional(t.Boolean()),
    package_parts: t.Optional(t.String({ maxLength: 255 })),
    genre: t.Optional(t.String())
});

class AdminError extends Error {}

const handle = (err: unknown, status: any) => {
    if (err instanceof AdminError || err instanceof UploadError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

const paginate = async (count: Promise<any[]>, wanted: number | undefined, rows: (limit: any) => Promise<any[]>) => {
    const [row] = await count;
    const total = Number(row.n);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const page = Math.min(Math.max(1, wanted ?? 1), totalPages);
    return {
        items: await rows(sql`LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`),
        total,
        page,
        totalPages
    };
};

const bannerState = (b: any) => {
    if (Number(b.enabled) !== 1) {
        return "Off";
    }
    if (Number(b.startsAt) > now()) {
        return "Scheduled";
    }
    if (Number(b.endsAt) > 0 && Number(b.endsAt) < now()) {
        return "Expired";
    }
    return "Live";
};


const toStamp = (value?: string) => {
    const ms = Date.parse((value ?? "").trim());
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
};

const promoState = (p: any) => {
    if (Number(p.active) !== 1) {
        return "Off";
    }
    if (Number(p.starts_at) > now()) {
        return "Scheduled";
    }
    if (Number(p.expires_at) > 0 && Number(p.expires_at) <= now()) {
        return "Expired";
    }
    if (Number(p.max_uses) > 0 && Number(p.uses) >= Number(p.max_uses)) {
        return "Used up";
    }
    return "Live";
};

const cleanPromoBody = async (body: typeof promoBody.static) => {
    const code = cleanPromo(body.code);
    if (!PROMO_CODE.test(code)) {
        throw new AdminError("Codes are 3 to 40 letters, numbers, !, _ or -.");
    }
    const items = [...new Set(body.items)];
    const nonebux = body.nonebux ?? 0;
    const tix = body.tix ?? 0;
    const maxUses = body.maxUses ?? 0;
    for (const [label, value] of [["Nonebux", nonebux], ["Tix", tix], ["Max uses", maxUses]] as const) {
        if (!Number.isInteger(value) || value < 0 || value > 1000000) {
            throw new AdminError(`${label} must be between 0 and 1,000,000.`);
        }
    }
    if (!items.length && !nonebux && !tix) {
        throw new AdminError("A promo code needs at least one item, or some Nonebux or Tix.");
    }
    if (items.length) {
        const found = await sql`SELECT id, name, is_limited, is_limited_unique FROM catalog_items WHERE id IN ${sql(items)}`;
        if (found.length !== items.length) {
            throw new AdminError("One of those items does not exist.");
        }
        const limited = found.find((item: any) => item.is_limited || item.is_limited_unique);
        if (limited) {
            throw new AdminError(`${limited.name} is a Limited item, so a code can't give it.`);
        }
    }
    const startsAt = toStamp(body.startsAt);
    const expiresAt = toStamp(body.expiresAt);
    if (expiresAt > 0 && expiresAt <= Math.max(startsAt, now())) {
        throw new AdminError("The end time has to be in the future and after the start time.");
    }
    return {
        code,
        items,
        nonebux,
        tix,
        maxUses,
        startsAt,
        expiresAt
    };
};

const cleanBanner = (body: typeof banner.static) => {
    const message = body.message.trim();
    if (message === "") {
        throw new AdminError("A banner needs a message.");
    }
    return {
        message,
        linkText: (body.linkText ?? "").trim().slice(0, 120),
        linkUrl: (body.linkUrl ?? "").trim().slice(0, 255),
        style: BANNER_STYLES.includes(body.style ?? "") ? body.style! : "info",
        enabled: body.enabled ? 1 : 0,
        dismissible: body.dismissible ? 1 : 0,
        startsAt: toStamp(body.startsAt),
        endsAt: toStamp(body.endsAt)
    };
};

const cleanPost = (body: typeof post.static) => {
    const title = body.title.trim();
    const excerpt = (body.excerpt ?? "").trim();
    const text = body.body.trim();
    const category = body.category.trim().toLowerCase();

    if (title === "" || title.length > 180) {
        throw new AdminError("Title is required and must be 180 characters or less.");
    }
    if (excerpt.length > 320) {
        throw new AdminError("Excerpt must be 320 characters or less.");
    }
    if (text === "") {
        throw new AdminError("Post body is required.");
    }
    if (!(category in BLOG_CATEGORIES)) {
        throw new AdminError("Invalid blog category.");
    }
    if (body.image && body.image.size > 0 && !BLOG_IMAGE_TYPES.includes(body.image.type)) {
        throw new AdminError("Image must be a JPG, PNG, or WEBP file.");
    }
    return {
        title,
        excerpt,
        body: text,
        category,
        published: body.is_published ? 1 : 0
    };
};

const dropBlogImage = (postId: number) => clearMedia("blog", postId);


const cleanItem = async (body: typeof item.static, existing: any) => {
    let name = (body.name ?? "").trim();
    let description = (body.description ?? "").trim();
    let category = body.category ?? "Hat";
    const thumbnail = (body.thumbnail ?? "").trim();
    const assetId = body.asset_id ?? null;
    let remote = "";
    let parts = (body.package_parts ?? "").split(/[;,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);


    const wantsThumb = thumbnail === "" && !(existing && await mediaUrl("catalog", existing.id));
    if (category === "Package" && assetId && (name === "" || wantsThumb || parts.length === 0)) {
        try {
            const info = await lookupRobloxBundle(assetId);
            if (name === "") {
                name = info.name;
                if (description === "") {
                    description = info.description;
                }
            }
            if (wantsThumb) {
                remote = info.thumbnail;
            }
            if (parts.length === 0) {
                parts = info.parts;
            }
        } catch (err) {
            if (name === "" || parts.length === 0) {
                throw new AdminError(`Could not import bundle ${assetId} from Roblox: ${err instanceof Error ? err.message : err}`);
            }
        }
    } else if (assetId && (name === "" || wantsThumb)) {
        const importing = name === "";
        try {
            const info = await lookupRobloxAsset(assetId);
            if (importing) {
                name = info.name;
                if (description === "") {
                    description = info.description;
                }
                if (info.category) {
                    category = info.category;
                }
            }
            if (wantsThumb) {
                remote = info.thumbnail;
            }
        } catch (err) {
            if (importing) {
                throw new AdminError(`Could not import asset ${assetId} from Roblox: ${err instanceof Error ? err.message : err}`);
            }
        }
    }

    if (name === "" || name.length > 80) {
        throw new AdminError("Item name is required and must be 80 characters or less.");
    }
    const [creator] = await sql`SELECT id FROM users WHERE username = ${body.creator.trim()}`;
    if (!creator) {
        throw new AdminError("Creator username was not found.");
    }
    if (!ITEM_CATEGORIES.includes(category)) {
        throw new AdminError("Invalid category.");
    }
    const genre = body.genre ?? existing?.genre ?? "All";
    if (!isGenre(genre)) {
        throw new AdminError("Invalid genre.");
    }

    const limitedUnique = body.is_limited_unique ? 1 : 0;
    const limited = limitedUnique || body.is_limited ? 1 : 0;
    let stock: number | null = null;
    if (limitedUnique) {
        stock = body.limited_stock ?? 0;
        if (stock < 1) {
            throw new AdminError("Limited U items need a stock of at least 1.");
        }
        if (existing && stock < Number(existing.limited_sold)) {
            throw new AdminError(`Stock cannot be lower than the ${existing.limited_sold} copies already sold.`);
        }
    }

    return {
        name,
        description,
        creator_id: creator.id,
        category,
        asset_id: assetId,
        price: body.price ?? null,
        tix_price: body.tix_price ?? null,
        thumbnail,
        is_featured: body.is_featured ? 1 : 0,
        bc_only: body.bc_only ? 1 : 0,
        is_starter: body.is_starter ? 1 : 0,
        package_parts: category === "Package" ? parts.slice(0, 12).join(";") : "",
        genre,
        is_limited: limited,
        is_limited_unique: limitedUnique,
        limited_stock: stock,
        remote
    };
};

export const admin = new Elysia({ prefix: "/api/admin" })
    .use(session)


    .get("/banners", async () => {
        const rows = await sql`SELECT * FROM site_banners ORDER BY id DESC`;
        return rows.map((b: any) => ({
            ...b,
            state: bannerState(b)
        }));
    }, {
        admin: true
    })

    .post("/banners", async ({ body, user, status }) => {
        try {
            const c = cleanBanner(body);
            const created = await sql`
                INSERT INTO site_banners (message, "linkText", "linkUrl", style, enabled, dismissible, "startsAt", "endsAt", "createdBy", "createdAt", "updatedAt")
                VALUES (${c.message}, ${c.linkText}, ${c.linkUrl}, ${c.style}, ${c.enabled}, ${c.dismissible}, ${c.startsAt}, ${c.endsAt}, ${user.id}, ${now()}, ${now()}) RETURNING id`;
            return {
                ok: true,
                id: Number(created[0].id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        body: banner
    })

    .patch("/banners/:id", async ({ params, body, status }) => {
        try {
            const c = cleanBanner(body);
            const done = await sql`
                UPDATE site_banners SET message = ${c.message}, "linkText" = ${c.linkText}, "linkUrl" = ${c.linkUrl}, style = ${c.style},
                    enabled = ${c.enabled}, dismissible = ${c.dismissible}, "startsAt" = ${c.startsAt}, "endsAt" = ${c.endsAt}, "updatedAt" = ${now()}
                WHERE id = ${params.id}
            `;
            if (done.count !== 1) {
                throw new AdminError("That banner does not exist any more.");
            }
            return {
                ok: true,
                id: params.id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        params: id,
        body: banner
    })

    .post("/banners/:id/toggle", async ({ params, status }) => {
        const [b] = await sql`SELECT enabled FROM site_banners WHERE id = ${params.id}`;
        if (!b) {
            return status(400, {
                error: "That banner does not exist any more."
            });
        }
        const enabled = Number(b.enabled) === 1 ? 0 : 1;
        await sql`UPDATE site_banners SET enabled = ${enabled}, "updatedAt" = ${now()} WHERE id = ${params.id}`;
        return {
            ok: true,
            enabled
        };
    }, {
        admin: true,
        params: id
    })

    .delete("/banners/:id", async ({ params }) => {
        await sql`DELETE FROM site_banners WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/blog", async () => sql`
        SELECT blog_posts.*, users.username AS author_name FROM blog_posts
        LEFT JOIN users ON users.id = blog_posts.author_id
        ORDER BY blog_posts.created_at DESC, blog_posts.id DESC
        LIMIT 100
    `, {
        admin: true
    })

    .post("/blog", async ({ body, user, status }) => {
        try {
            const p = cleanPost(body);
            const created = await sql`
                INSERT INTO blog_posts (title, excerpt, body, category, author_id, image, is_published, published_at, created_at, updated_at)
                VALUES (${p.title}, ${p.excerpt}, ${p.body}, ${p.category}, ${user.id}, '', ${p.published}, ${p.published ? now() : 0}, ${now()}, ${now()}) RETURNING id`;
            const postId = Number(created[0].id);
            if (body.image && body.image.size > 0) {
                const image = await saveImage("blog", postId, body.image, BLOG_IMAGE_BYTES);
                await sql`UPDATE blog_posts SET image = ${image} WHERE id = ${postId}`;
            }
            return {
                ok: true,
                id: postId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        body: post
    })

    .patch("/blog/:id", async ({ params, body, status }) => {
        try {
            const [existing] = await sql`SELECT published_at FROM blog_posts WHERE id = ${params.id}`;
            if (!existing) {
                throw new AdminError("Blog post was not found.");
            }
            const p = cleanPost(body);
            const publishedAt = p.published ? Number(existing.published_at) || now() : 0;
            await sql`
                UPDATE blog_posts SET title = ${p.title}, excerpt = ${p.excerpt}, body = ${p.body}, category = ${p.category},
                    is_published = ${p.published}, published_at = ${publishedAt}, updated_at = ${now()}
                WHERE id = ${params.id}
            `;
            if (body.image && body.image.size > 0) {
                const image = await saveImage("blog", params.id, body.image, BLOG_IMAGE_BYTES);
                await sql`UPDATE blog_posts SET image = ${image} WHERE id = ${params.id}`;
            }
            return {
                ok: true,
                id: params.id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        params: id,
        body: post
    })

    .delete("/blog/:id/image", async ({ params }) => {
        await dropBlogImage(params.id);
        await sql`UPDATE blog_posts SET image = '', updated_at = ${now()} WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })

    .delete("/blog/:id", async ({ params }) => {
        await dropBlogImage(params.id);
        await sql`DELETE FROM blog_posts WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/catalog", async ({ query }) => {
        const like = `%${(query.q ?? "").trim()}%`;
        const where = sql`catalog_items.name ILIKE ${like} OR users.username ILIKE ${like}`;
        const page = await paginate(
            sql`SELECT COUNT(*)::int AS n FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id WHERE ${where}`,
            query.page,
            limit => sql`
                SELECT catalog_items.*, users.username AS creator_name FROM catalog_items
                LEFT JOIN users ON users.id = catalog_items.creator_id
                WHERE ${where}
                ORDER BY catalog_items.id DESC ${limit}
            `
        );
        for (const row of page.items) {
            row.thumbnail = row.thumbnail || await mediaUrl("catalog", row.id);
        }
        return {
            ...page,
            genres: GENRES
        };
    }, {
        admin: true,
        query: list
    })

    .post("/catalog", async ({ body, status }) => {
        try {
            const c = await cleanItem(body, null);
            const created = await sql`
                INSERT INTO catalog_items (name, description, creator_id, category, asset_id, price, tix_price, thumbnail, is_featured, bc_only, is_starter, package_parts, genre, is_limited, is_limited_unique, limited_stock, limited_sold, created_at, updated_at)
                VALUES (${c.name}, ${c.description}, ${c.creator_id}, ${c.category}, ${c.asset_id}, ${c.price}, ${c.tix_price}, ${c.thumbnail}, ${c.is_featured}, ${c.bc_only}, ${c.is_starter}, ${c.package_parts}, ${c.genre}, ${c.is_limited}, ${c.is_limited_unique}, ${c.limited_stock}, 0, ${now()}, ${now()}) RETURNING id`;
            const itemId = Number(created[0].id);
            if (c.remote !== "") {
                await storeThumbnail(itemId, c.remote);
            }
            return {
                ok: true,
                id: itemId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        body: item
    })

    .patch("/catalog/:id", async ({ params, body, status }) => {
        try {
            const [existing] = await sql`SELECT id, limited_sold, genre FROM catalog_items WHERE id = ${params.id}`;
            if (!existing) {
                throw new AdminError("That item does not exist.");
            }
            const c = await cleanItem(body, existing);
            await sql`
                UPDATE catalog_items SET name = ${c.name}, description = ${c.description}, creator_id = ${c.creator_id}, category = ${c.category},
                    asset_id = ${c.asset_id}, price = ${c.price}, tix_price = ${c.tix_price}, thumbnail = ${c.thumbnail}, is_featured = ${c.is_featured}, bc_only = ${c.bc_only}, is_starter = ${c.is_starter}, package_parts = ${c.package_parts}, genre = ${c.genre},
                    is_limited = ${c.is_limited}, is_limited_unique = ${c.is_limited_unique}, limited_stock = ${c.limited_stock}, updated_at = ${now()}
                WHERE id = ${params.id}
            `;
            if (c.remote !== "") {
                await storeThumbnail(params.id, c.remote);
            }
            return {
                ok: true,
                id: params.id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        params: id,
        body: item
    })


    .post("/render/avatars", async ({ user }) => {
        const users = await sql`SELECT id FROM users ORDER BY id ASC`;
        console.log(`admin: ${user.username} queued avatar renders for ${users.length} users`);
        (async () => {
            for (const u of users) {
                await rcc.render.avatar(Number(u.id));
            }
        })();
        return {
            ok: true,
            queued: users.length
        };
    }, {
        admin: true
    })

    .post("/catalog/:id/render", async ({ params, status }) => {
        const [row] = await sql`SELECT id, asset_id FROM catalog_items WHERE id = ${params.id}`;
        if (!row?.asset_id) {
            return status(400, {
                error: "That item has no asset to render."
            });
        }
        if (!(await rcc.render.item(row.id, Number(row.asset_id)))) {
            return status(400, {
                error: "rccmanager is not reachable right now."
            });
        }
        await sql`UPDATE catalog_items SET thumbnail = '', updated_at = ${now()} WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })

    .delete("/catalog/:id", async ({ params }) => {
        await sql`DELETE FROM catalog_items WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/stats", async () => {
        const today = Math.floor(now() / 86400) * 86400;
        const [[u], [g], [c], [m], [i], [a], [ap], servers, health] = await Promise.all([
            sql`
                SELECT COUNT(*)::int AS users, COUNT(*) FILTER (WHERE "lastOnlineSite" > ${now() - ONLINE_WINDOW})::int AS online, COUNT(*) FILTER (WHERE created_at >= ${today})::int AS today,
                    COUNT(*) FILTER (WHERE admin > 0)::int AS admins, COUNT(*) FILTER (WHERE membership <> 'None' AND (membership_expires = 0 OR membership_expires > ${now()}))::int AS club
                FROM users
            `,
            sql`SELECT COUNT(*)::int AS games, (SELECT COUNT(*)::int FROM media WHERE kind = 'places') AS published FROM games`,
            sql`SELECT COUNT(*)::int AS n FROM catalog_items`,
            sql`SELECT COUNT(*)::int AS n FROM users WHERE ongoing_action_id IS NOT NULL`,
            sql`SELECT COUNT(*)::int AS n FROM invites`,
            sql`SELECT COUNT(*)::int AS n FROM assets WHERE type = 'Model' AND parent_id IS NULL`,
            sql`SELECT COUNT(*)::int AS n FROM applications WHERE status = 'pending'`,
            rcc.servers(),
            rcc.health()
        ]);
        return {
            users: Number(u.users),
            online: Number(u.online ?? 0),
            signups_today: Number(u.today ?? 0),
            admins: Number(u.admins ?? 0),
            club: Number(u.club ?? 0),
            games: Number(g.games),
            published: Number(g.published),
            catalog: Number(c.n),
            moderation: Number(m.n),
            invites: Number(i.n),
            models: Number(a.n),
            applications: Number(ap.n),
            servers: servers.length,
            players: servers.reduce((sum, s: any) => sum + Number(s.players ?? 0), 0),
            rcc: health?.rcc === "up" ? "up" : health ? "down" : "unreachable"
        };
    }, {
        admin: true
    })


    .get("/games", async ({ query }) => {
        const like = `%${(query.q ?? "").trim()}%`;
        const where = sql`(games.title ILIKE ${like} OR users.username ILIKE ${like})`;
        const result = await paginate(
            sql`SELECT COUNT(*)::int AS n FROM games LEFT JOIN users ON users.id = games.creator_id WHERE ${where}`,
            query.page,
            limit => sql`
                SELECT games.id, games.title, games.creator_id, games.featured, users.username AS creator_name, media.updated_at AS published_at, media.size AS file_size
                FROM games
                LEFT JOIN users ON users.id = games.creator_id
                LEFT JOIN media ON media.kind = 'places' AND media.id = games.id
                WHERE ${where}
                ORDER BY games.id DESC ${limit}
            `
        );
        const playing = await rcc.players(result.items.map((g: any) => Number(g.id)));
        return {
            ...result,
            items: await Promise.all(result.items.map(async (g: any) => ({
                ...g,
                icon: await mediaUrl("icons", Number(g.id)),
                thumbnail: await mediaUrl("thumbnails", Number(g.id)),
                playing: playing[Number(g.id)] ?? 0,
                featured: Number(g.featured) === 1
            })))
        };
    }, {
        admin: true,
        query: list
    })

    .post("/games/:id/featured", async ({ params, body, status }) => {
        const [game] = await sql`SELECT id FROM games WHERE id = ${params.id}`;
        if (!game) {
            return status(404, {
                error: "Game not found."
            });
        }
        await sql`UPDATE games SET featured = ${body.featured ? 1 : 0} WHERE id = ${params.id}`;
        return {
            ok: true,
            featured: body.featured
        };
    }, {
        admin: true,
        params: id,
        body: t.Object({
            featured: t.Boolean()
        })
    })

    .post("/games/:id/render", async ({ params, status }) => {
        const [game] = await sql`SELECT id FROM games WHERE id = ${params.id}`;
        if (!game) {
            return status(404, {
                error: "Game not found."
            });
        }
        if (!(await mediaHas("places", params.id))) {
            return status(400, {
                error: "That place has no file to render."
            });
        }
        if (!(await rcc.render.place(params.id))) {
            return status(502, {
                error: "RCCManager did not take the render."
            });
        }
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })

    .delete("/games/:id", async ({ params, user, status }) => {
        const [game] = await sql`SELECT title FROM games WHERE id = ${params.id}`;
        if (!game) {
            return status(404, {
                error: "Game not found."
            });
        }
        await rcc.closePlace(params.id);
        await sql`DELETE FROM games WHERE id = ${params.id}`;
        await sql`DELETE FROM game_favorites WHERE game_id = ${params.id}`;
        await Promise.all(["places", "thumbnails", "icons"].map(kind => clearMedia(kind, params.id)));
        console.log(`admin: ${user.username} deleted place ${params.id} (${game.title})`);
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/settings", () => siteSettings(), {
        admin: true
    })

    .patch("/settings", async ({ body, user }) => {
        if (body.registration_enabled !== undefined) {
            await setSiteSetting("registration_enabled", body.registration_enabled, user.id);
        }
        if (body.invites_enabled !== undefined) {
            await setSiteSetting("invites_enabled", body.invites_enabled, user.id);
        }
        if (body.applications_enabled !== undefined) {
            await setSiteSetting("applications_enabled", body.applications_enabled, user.id);
        }
        return siteSettings();
    }, {
        admin: true,
        body: t.Object({
            registration_enabled: t.Optional(t.Boolean()),
            invites_enabled: t.Optional(t.Boolean()),
            applications_enabled: t.Optional(t.Boolean())
        })
    })

    .get("/invitekeys/log", ({ query }) => paginate(
        sql`SELECT COUNT(*)::int AS n FROM invite_log`,
        query.page,
        limit => sql`
            SELECT invite_log.*, maker.username AS creator_name, joiner.username AS user_name FROM invite_log
            LEFT JOIN users maker ON maker.id = invite_log.created_by
            LEFT JOIN users joiner ON joiner.id = invite_log.used_by
            ORDER BY invite_log.id DESC ${limit}
        `
    ), {
        admin: true,
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .get("/invitekeys", ({ query }) => paginate(
        sql`SELECT COUNT(*)::int AS n FROM invites`,
        query.page,
        limit => sql`
            SELECT invites.*, users.username AS creator_name FROM invites
            LEFT JOIN users ON users.id = invites."createdBy"
            ORDER BY invites.id DESC ${limit}
        `
    ), {
        admin: true,
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/invitekeys", async ({ user }) => {
        const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
        await sql`INSERT INTO invites ("createdBy", "inviteKey", "createdAt") VALUES (${user.id}, ${key}, ${now()})`;
        return {
            ok: true,
            key
        };
    }, {
        admin: true
    })

    .delete("/invitekeys/:id", async ({ params }) => {
        await sql`DELETE FROM invites WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/gamecards", ({ query }) => paginate(
        query.used
            ? sql`SELECT COUNT(*)::int AS n FROM game_cards WHERE redeemed_by > 0`
            : sql`SELECT COUNT(*)::int AS n FROM game_cards WHERE redeemed_by = 0`,
        query.page,
        limit => query.used
            ? sql`
                SELECT game_cards.*, maker.username AS creator_name, owner.username AS user_name FROM game_cards
                LEFT JOIN users maker ON maker.id = game_cards.created_by
                LEFT JOIN users owner ON owner.id = game_cards.redeemed_by
                WHERE game_cards.redeemed_by > 0
                ORDER BY game_cards.redeemed_at DESC ${limit}
            `
            : sql`
                SELECT game_cards.*, maker.username AS creator_name FROM game_cards
                LEFT JOIN users maker ON maker.id = game_cards.created_by
                WHERE game_cards.redeemed_by = 0
                ORDER BY game_cards.id DESC ${limit}
            `
    ), {
        admin: true,
        query: t.Object({
            page: t.Optional(t.Numeric()),
            used: t.Optional(t.BooleanString())
        })
    })

    .post("/gamecards", async ({ body, user, status }) => {
        try {
            const amount = body.amount;
            const count = body.count ?? 1;
            if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) {
                throw new AdminError("Amount must be between 1 and 1,000,000 Nonebux.");
            }
            if (!Number.isInteger(count) || count < 1 || count > 100) {
                throw new AdminError("You can make up to 100 cards at once.");
            }
            const codes: string[] = [];
            for (let i = 0; i < count; i++) {
                const code = GAME_CARD_CODE();
                await sql`INSERT INTO game_cards (code, amount, created_by, created_at) VALUES (${code}, ${amount}, ${user.id}, ${now()})`;
                codes.push(code);
            }
            return {
                ok: true,
                codes
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        body: t.Object({
            amount: t.Integer(),
            count: t.Optional(t.Integer())
        })
    })

    .delete("/gamecards/:id", async ({ params }) => {
        await sql`DELETE FROM game_cards WHERE id = ${params.id} AND redeemed_by = 0`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/promocodes", async ({ query }) => {
        const page = await paginate(
            sql`SELECT COUNT(*)::int AS n FROM promo_codes`,
            query.page,
            limit => sql`
                SELECT promo_codes.*, maker.username AS creator_name FROM promo_codes
                LEFT JOIN users maker ON maker.id = promo_codes.created_by
                ORDER BY promo_codes.id DESC ${limit}
            `
        );
        const items = await promoItems(page.items.map((row: any) => Number(row.id)));
        for (const row of page.items) {
            row.items = items.get(Number(row.id)) ?? [];
            row.state = promoState(row);
        }
        return page;
    }, {
        admin: true,
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/promocodes", async ({ body, user, status }) => {
        try {
            const c = await cleanPromoBody(body);
            const [taken] = await sql`SELECT 1 FROM promo_codes WHERE code = ${c.code}`;
            if (taken) {
                throw new AdminError("That code already exists.");
            }
            const created = await sql.begin(async tx => {
                const [row] = await tx`
                    INSERT INTO promo_codes (code, nonebux, tix, max_uses, starts_at, expires_at, active, created_by, created_at)
                    VALUES (${c.code}, ${c.nonebux}, ${c.tix}, ${c.maxUses}, ${c.startsAt}, ${c.expiresAt}, 1, ${user.id}, ${now()}) RETURNING id`;
                for (const itemId of c.items) {
                    await tx`INSERT INTO promo_code_items (code_id, item_id) VALUES (${row.id}, ${itemId})`;
                }
                return row;
            });
            console.log(`admin: ${user.username} made promo code ${c.code}`);
            return {
                ok: true,
                id: created.id,
                code: c.code
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        body: promoBody
    })

    .post("/promocodes/:id/active", async ({ params, body }) => {
        await sql`UPDATE promo_codes SET active = ${body.active ? 1 : 0} WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id,
        body: t.Object({
            active: t.Boolean()
        })
    })

    .delete("/promocodes/:id", async ({ params, user }) => {
        await sql.begin(async tx => {
            await tx`DELETE FROM promo_code_items WHERE code_id = ${params.id}`;
            await tx`DELETE FROM promo_redemptions WHERE code_id = ${params.id}`;
            await tx`DELETE FROM promo_codes WHERE id = ${params.id}`;
        });
        console.log(`admin: ${user.username} deleted promo code ${params.id}`);
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/moderation", async ({ query }) => {
        const page = await paginate(
            sql`SELECT COUNT(*)::int AS n FROM users WHERE ongoing_action_id IS NOT NULL`,
            query.page,
            limit => sql`
                SELECT users.id, users.username, moderation_actions.id AS action_id, moderation_actions.action, moderation_actions.reason,
                    moderation_actions."moderatedBy", moderation_actions."expiresAt", moderation_actions.created_at AS "createdAt", moderator.username AS moderator_name
                FROM users
                LEFT JOIN moderation_actions ON moderation_actions.id = users.ongoing_action_id
                LEFT JOIN users AS moderator ON moderator.id = moderation_actions."moderatedBy"
                WHERE users.ongoing_action_id IS NOT NULL
                ORDER BY users.id DESC ${limit}
            `
        );
        const actions = page.items.map(row => Number(row.action_id)).filter(n => n > 0);
        const offenses = actions.length > 0
            ? await sql`SELECT action_id, label, body FROM moderation_offenses WHERE action_id IN ${sql(actions)} ORDER BY id`
            : [];
        for (const row of page.items) {
            row.offenses = offenses.filter((o: any) => o.action_id === row.action_id).map((o: any) => ({
                label: o.label,
                body: o.body
            }));
        }
        return page;
    }, {
        admin: true,
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/moderation", async ({ body, user, status }) => {
        try {
            const reason = body.reason.trim();
            const username = body.username.trim();
            if (reason === "" || username === "") {
                throw new AdminError("Username and reason are required.");
            }
            const [target] = await sql`SELECT id FROM users WHERE username = ${username}`;
            if (!target) {
                throw new AdminError("That user does not exist.");
            }
            if (target.id === user.id) {
                throw new AdminError("You cannot moderate your own account from this page.");
            }

            const [action, seconds] = MODERATION[body.type]!;
            const expiresAt = seconds > 0 ? now() + seconds : 0;
            const offenses = (body.offenses ?? []).map(o => ({
                label: (o.label ?? "").trim(),
                body: o.body.trim()
            })).filter(o => o.body !== "");
            await sql.begin(async tx => {
                const created = await tx`
                    INSERT INTO moderation_actions (user_id, action, reason, "moderatedBy", "expiresAt", created_at)
                    VALUES (${target.id}, ${action}, ${reason}, ${user.id}, ${expiresAt}, ${now()}) RETURNING id`;
                const actionId = Number(created[0].id);
                for (const offense of offenses) {
                    await tx`INSERT INTO moderation_offenses (action_id, label, body) VALUES (${actionId}, ${offense.label}, ${offense.body})`;
                }
                await tx`UPDATE users SET ongoing_action_id = ${actionId} WHERE id = ${target.id}`;
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        body: t.Object({
            username: t.String(),
            type: t.Union([
                t.Literal("warning"),
                t.Literal("ban1d"),
                t.Literal("ban3d"),
                t.Literal("ban7d"),
                t.Literal("ban14d"),
                t.Literal("account_deletion"),
                t.Literal("reminder")
            ]),
            reason: t.String(),
            offenses: t.Optional(t.Array(t.Object({
                label: t.Optional(t.String({ maxLength: 40 })),
                body: t.String({ maxLength: 4000 })
            }), { maxItems: 10 }))
        })
    })


    .delete("/moderation/:id", async ({ params }) => {
        await sql`DELETE FROM moderation_offenses WHERE action_id IN (SELECT id FROM moderation_actions WHERE user_id = ${params.id})`;
        await sql`DELETE FROM moderation_actions WHERE user_id = ${params.id}`;
        await sql`UPDATE users SET ongoing_action_id = NULL WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })


    .get("/users", ({ query }) => {
        const search = (query.q ?? "").trim();
        const like = `%${search}%`;
        const userId = /^\d+$/.test(search) ? Number(search) : 0;
        const status = query.status ?? "all";
        const currentTime = now();
        const where = sql`(users.username ILIKE ${like} OR users.email ILIKE ${like} OR users.id = ${userId}) AND (${status} = 'all' OR (${status} = 'admin' AND users.admin > 0) OR (${status} = 'moderated' AND users.ongoing_action_id IS NOT NULL) OR (${status} = 'membership' AND users.membership <> 'None' AND (users.membership_expires = 0 OR users.membership_expires > ${currentTime})))`;
        return paginate(
            sql`SELECT COUNT(*)::int AS n FROM users WHERE ${where}`,
            query.page,
            limit => sql`
                SELECT users.id, users.username, users.email, users.admin, users.currency, users.tix, users.ongoing_action_id, users.created_at, users.membership, users.membership_expires,
                    joined.created_by AS invited_by_id, maker.username AS invited_by,
                    (SELECT COUNT(*)::int FROM invite_log l WHERE l.created_by = users.id) AS invited
                FROM users
                LEFT JOIN invite_log joined ON joined.used_by = users.id
                LEFT JOIN users maker ON maker.id = joined.created_by
                WHERE ${where}
                ORDER BY users.id DESC ${limit}
            `
        );
    }, {
        admin: true,
        query: list
    })

    .get("/users/:id/history", async ({ params }) => {
        const [joined] = await sql`
            SELECT invite_log.*, maker.username AS creator_name FROM invite_log
            LEFT JOIN users maker ON maker.id = invite_log.created_by
            WHERE invite_log.used_by = ${params.id} ORDER BY invite_log.id LIMIT 1
        `;
        const invited = await sql`
            SELECT invite_log.used_by AS id, joiner.username, invite_log.used_at, invite_log.ip, joiner.ongoing_action_id FROM invite_log
            LEFT JOIN users joiner ON joiner.id = invite_log.used_by
            WHERE invite_log.created_by = ${params.id} ORDER BY invite_log.id DESC
        `;
        const ips = (await sql`
            SELECT ip FROM invite_log WHERE used_by = ${params.id} AND ip != ''
            UNION SELECT ip FROM username_history WHERE user_id = ${params.id} AND ip != ''
        `).map((r: any) => r.ip);
        const sameIp = ips.length > 0 ? await sql`
            SELECT DISTINCT users.id, users.username, users.ongoing_action_id, invite_log.ip FROM invite_log
            JOIN users ON users.id = invite_log.used_by
            WHERE invite_log.ip IN ${sql(ips)} AND invite_log.used_by != ${params.id}
            UNION
            SELECT DISTINCT users.id, users.username, users.ongoing_action_id, username_history.ip FROM username_history
            JOIN users ON users.id = username_history.user_id
            WHERE username_history.ip IN ${sql(ips)} AND username_history.user_id != ${params.id}
        ` : [];
        const usernames = await sql`SELECT old_username, new_username, changed_at, ip FROM username_history WHERE user_id = ${params.id} ORDER BY changed_at DESC`;
        return {
            invitedBy: joined ?? null,
            invited,
            ips,
            sameIp,
            usernames
        };
    }, {
        admin: true,
        params: id
    })

    .patch("/users/:id", async ({ params, body, user, status }) => {
        const [target] = await sql`SELECT admin, currency, tix, membership, membership_expires FROM users WHERE id = ${params.id}`;
        if (!target) {
            return status(400, {
                error: "User not found."
            });
        }
        if (body.admin_level !== undefined && Number(body.admin_level) !== Number(target.admin) && user.admin < 5) {
            return status(403, {
                error: "Only administrators can change staff ranks."
            });
        }
        const adminLevel = Math.max(0, Math.min(5, body.admin_level ?? Number(target.admin)));
        const currency = Math.max(0, body.currency ?? Number(target.currency));
        const tix = Math.max(0, Math.min(2000000000, body.tix ?? Number(target.tix)));
        if (params.id === user.id && adminLevel < 1) {
            return status(400, {
                error: "You cannot remove your own admin access here."
            });
        }
        const membership = body.membership ?? target.membership;
        if (!isTier(membership)) {
            return status(400, {
                error: "Unknown membership."
            });
        }
        let expires = Number(target.membership_expires);
        if (body.membership_days !== undefined) {
            expires = body.membership_days > 0 ? now() + body.membership_days * 86400 : 0;
        } else if (membership !== target.membership) {
            expires = 0;
        }
        await sql`UPDATE users SET admin = ${adminLevel}, currency = ${currency}, tix = ${tix}, membership = ${membership}, membership_expires = ${expires} WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id,
        body: t.Object({
            admin_level: t.Optional(t.Integer({ minimum: 0, maximum: 5 })),
            currency: t.Optional(t.Numeric({ minimum: 0 })),
            tix: t.Optional(t.Numeric({ minimum: 0, maximum: 2000000000 })),
            membership: t.Optional(t.String()),
            membership_days: t.Optional(t.Numeric({ minimum: 0 }))
        })
    })
