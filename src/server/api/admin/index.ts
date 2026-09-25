import { Elysia, t } from "elysia";
import { join } from "path";
import { session } from "../../session";
import { sql, now } from "../../db";
import { saveImage, mediaUrl, clearMedia, UploadError } from "../../paths";
import { mediaPut } from "../../media";
import { rcc } from "../../rcc";
import { CATEGORIES as BLOG_CATEGORIES } from "../site/blog";

const PER_PAGE = 20;
const BLOG_IMAGE_BYTES = 6 * 1024 * 1024;
const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BANNER_STYLES = ["info", "warning", "success"];
const ITEM_CATEGORIES = ["Hat", "Face", "T-Shirt", "Shirt", "Pants", "Gear", "Package"];
const ROBLOX_TIMEOUT = 10000;

// type -> [action, seconds]
const MODERATION: Record<string, [number, number]> = {
    warning: [1, 0],
    ban1d: [2, 86400],
    ban3d: [3, 259200],
    ban7d: [4, 604800],
    ban14d: [5, 1209600],
    account_deletion: [6, 0]
};

// roblox AssetTypeId -> our category, every accessory is a Hat here
const ROBLOX_TYPES: Record<number, string> = {
    2: "T-Shirt",
    8: "Hat",
    11: "Shirt",
    12: "Pants",
    18: "Face",
    19: "Gear",
    32: "Package",
    41: "Hat",
    42: "Hat",
    43: "Hat",
    44: "Hat",
    45: "Hat",
    46: "Hat",
    47: "Hat"
};

const id = t.Object({
    id: t.Numeric()
});
const list = t.Object({
    q: t.Optional(t.String()),
    page: t.Optional(t.Numeric())
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

// creator is a username
const item = t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String()),
    creator: t.String(),
    category: t.Optional(t.String()),
    asset_id: t.Optional(t.Numeric()),
    price: t.Optional(t.Numeric({ minimum: 0 })),
    thumbnail: t.Optional(t.String()),
    is_featured: t.Optional(t.Boolean()),
    is_limited: t.Optional(t.Boolean()),
    is_limited_unique: t.Optional(t.Boolean()),
    limited_stock: t.Optional(t.Numeric({ minimum: 0 }))
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

// datetime-local string -> unix seconds, 0 when blank or garbage
const toStamp = (value?: string) => {
    const ms = Date.parse((value ?? "").trim());
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
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

const fetchJson = async (url: string) => {
    const res = await fetch(url, {
        headers: {
            Accept: "application/json"
        },
        signal: AbortSignal.timeout(ROBLOX_TIMEOUT)
    });
    if (!res.ok) {
        throw new Error(`roblox answered ${res.status}`);
    }
    return res.json() as Promise<any>;
};

const lookupRobloxAsset = async (assetId: number) => {
    const details = await fetchJson(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    if (!details?.Name) {
        throw new Error(`Roblox does not know asset ${assetId}`);
    }
    const thumbs = await fetchJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`).catch(() => null);
    const thumb = thumbs?.data?.[0];
    return {
        name: String(details.Name).slice(0, 80),
        description: String(details.Description ?? ""),
        category: ROBLOX_TYPES[Number(details.AssetTypeId)] ?? null,
        thumbnail: thumb?.state === "Completed" && thumb.imageUrl ? String(thumb.imageUrl) : ""
    };
};

// copy of the roblox thumb lands in uploads/catalog/<id>.png, the column stays empty
const storeThumbnail = async (itemId: number, url: string) => {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(20000)
    }).catch(() => null);
    if (!res?.ok) {
        return;
    }
    const png = new Uint8Array(await res.arrayBuffer());
    if (png.length < 4 || png[0] !== 0x89 || png[1] !== 0x50) {
        return;
    }
    await mediaPut("catalog", itemId, "png", png);
};

const cleanItem = async (body: typeof item.static, existing: any) => {
    let name = (body.name ?? "").trim();
    let description = (body.description ?? "").trim();
    let category = body.category ?? "Hat";
    const thumbnail = (body.thumbnail ?? "").trim();
    const assetId = body.asset_id ?? null;
    let remote = "";

    // dont fetch the roblox thumb again when a render already sits on disk
    const wantsThumb = thumbnail === "" && !(existing && await mediaUrl("catalog", existing.id));
    if (assetId && (name === "" || wantsThumb)) {
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
        thumbnail,
        is_featured: body.is_featured ? 1 : 0,
        is_limited: limited,
        is_limited_unique: limitedUnique,
        limited_stock: stock,
        remote
    };
};

export const admin = new Elysia({ prefix: "/api/admin" })
    .use(session)

    // banners
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
                INSERT INTO site_banners (message, linkText, linkUrl, style, enabled, dismissible, startsAt, endsAt, createdBy, createdAt, updatedAt)
                VALUES (${c.message}, ${c.linkText}, ${c.linkUrl}, ${c.style}, ${c.enabled}, ${c.dismissible}, ${c.startsAt}, ${c.endsAt}, ${user.id}, ${now()}, ${now()})
            `;
            return {
                ok: true,
                id: Number(created.lastInsertRowid)
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
                UPDATE site_banners SET message = ${c.message}, linkText = ${c.linkText}, linkUrl = ${c.linkUrl}, style = ${c.style},
                    enabled = ${c.enabled}, dismissible = ${c.dismissible}, startsAt = ${c.startsAt}, endsAt = ${c.endsAt}, updatedAt = ${now()}
                WHERE id = ${params.id}
            `;
            if (done.affectedRows !== 1) {
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
        await sql`UPDATE site_banners SET enabled = ${enabled}, updatedAt = ${now()} WHERE id = ${params.id}`;
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

    // blog, drafts too
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
                VALUES (${p.title}, ${p.excerpt}, ${p.body}, ${p.category}, ${user.id}, '', ${p.published}, ${p.published ? now() : 0}, ${now()}, ${now()})
            `;
            const postId = Number(created.lastInsertRowid);
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

    // catalog
    .get("/catalog", async ({ query }) => {
        const like = `%${(query.q ?? "").trim()}%`;
        const where = sql`catalog_items.name LIKE ${like} OR users.username LIKE ${like}`;
        const page = await paginate(
            sql`SELECT COUNT(*) AS n FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id WHERE ${where}`,
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
        return page;
    }, {
        admin: true,
        query: list
    })

    .post("/catalog", async ({ body, status }) => {
        try {
            const c = await cleanItem(body, null);
            const created = await sql`
                INSERT INTO catalog_items (name, description, creator_id, category, asset_id, price, thumbnail, is_featured, is_limited, is_limited_unique, limited_stock, limited_sold, created_at, updated_at)
                VALUES (${c.name}, ${c.description}, ${c.creator_id}, ${c.category}, ${c.asset_id}, ${c.price}, ${c.thumbnail}, ${c.is_featured}, ${c.is_limited}, ${c.is_limited_unique}, ${c.limited_stock}, 0, ${now()}, ${now()})
            `;
            const itemId = Number(created.lastInsertRowid);
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
            const [existing] = await sql`SELECT id, limited_sold FROM catalog_items WHERE id = ${params.id}`;
            if (!existing) {
                throw new AdminError("That item does not exist.");
            }
            const c = await cleanItem(body, existing);
            await sql`
                UPDATE catalog_items SET name = ${c.name}, description = ${c.description}, creator_id = ${c.creator_id}, category = ${c.category},
                    asset_id = ${c.asset_id}, price = ${c.price}, thumbnail = ${c.thumbnail}, is_featured = ${c.is_featured},
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

    // rcc draws the item on a default character, the png replaces whatever thumbnail was set
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

    // invite keys, no cooldown for admins
    .get("/invitekeys", ({ query }) => paginate(
        sql`SELECT COUNT(*) AS n FROM invites`,
        query.page,
        limit => sql`
            SELECT invites.*, users.username AS creator_name FROM invites
            LEFT JOIN users ON users.id = invites.createdBy
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
        await sql`INSERT INTO invites (createdBy, inviteKey, createdAt) VALUES (${user.id}, ${key}, ${now()})`;
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

    // moderation
    .get("/moderation", ({ query }) => paginate(
        sql`SELECT COUNT(*) AS n FROM users WHERE ongoing_action_id IS NOT NULL`,
        query.page,
        limit => sql`
            SELECT users.id, users.username, moderation_actions.action, moderation_actions.reason,
                moderation_actions.moderatedBy, moderation_actions.expiresAt, moderator.username AS moderator_name
            FROM users
            LEFT JOIN moderation_actions ON moderation_actions.id = users.ongoing_action_id
            LEFT JOIN users AS moderator ON moderator.id = moderation_actions.moderatedBy
            WHERE users.ongoing_action_id IS NOT NULL
            ORDER BY users.id DESC ${limit}
        `
    ), {
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
            const created = await sql`
                INSERT INTO moderation_actions (user_id, action, reason, moderatedBy, expiresAt)
                VALUES (${target.id}, ${action}, ${reason}, ${user.id}, ${expiresAt})
            `;
            await sql`UPDATE users SET ongoing_action_id = ${Number(created.lastInsertRowid)} WHERE id = ${target.id}`;
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
                t.Literal("account_deletion")
            ]),
            reason: t.String()
        })
    })

    // undo, id is the user
    .delete("/moderation/:id", async ({ params }) => {
        await sql`DELETE FROM moderation_actions WHERE user_id = ${params.id}`;
        await sql`UPDATE users SET ongoing_action_id = NULL WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id
    })

    // users
    .get("/users", ({ query }) => {
        const like = `%${(query.q ?? "").trim()}%`;
        const where = sql`username LIKE ${like} OR email LIKE ${like}`;
        return paginate(
            sql`SELECT COUNT(*) AS n FROM users WHERE ${where}`,
            query.page,
            limit => sql`
                SELECT id, username, email, admin, currency, ongoing_action_id, created_at FROM users
                WHERE ${where}
                ORDER BY id DESC ${limit}
            `
        );
    }, {
        admin: true,
        query: list
    })

    .patch("/users/:id", async ({ params, body, user, status }) => {
        const [target] = await sql`SELECT admin, currency FROM users WHERE id = ${params.id}`;
        if (!target) {
            return status(400, {
                error: "User not found."
            });
        }
        const adminLevel = Math.max(0, Math.min(255, body.admin_level ?? Number(target.admin)));
        const currency = Math.max(0, body.currency ?? Number(target.currency));
        if (params.id === user.id && adminLevel < 1) {
            return status(400, {
                error: "You cannot remove your own admin access here."
            });
        }
        await sql`UPDATE users SET admin = ${adminLevel}, currency = ${currency} WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id,
        body: t.Object({
            admin_level: t.Optional(t.Numeric({ minimum: 0 })),
            currency: t.Optional(t.Numeric({ minimum: 0 }))
        })
    })
