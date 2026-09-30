import { Elysia, t } from "elysia";
import { sql, now } from "../../db";
import { mediaUrl } from "../../media";
import { rcc } from "../../rcc";
import { SITE_URL } from "../../site";
import { isOnline, friendCount, ONLINE_WINDOW } from "../../friends";
import { membershipOf } from "../../membership";
import { siteBadges } from "../../badges";

const TERMINATED = 6;
const LIMIT = 25;

const headshot = async (id: number) => (await mediaUrl("headshots", id)) || `${SITE_URL}/api/user/getProfilePicture?userId=${id}&type=headshot`;
const avatar = async (id: number) => (await mediaUrl("avatars", id)) || `${SITE_URL}/api/user/getProfilePicture?userId=${id}&type=full`;

const cached = (data: unknown, seconds = 30) =>
    new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": `public, max-age=${seconds}`
        }
    });

const like = (q: string) => `%${q.trim().replace(/[%_]/g, "")}%`;
const size = (n: number | undefined) => Math.min(LIMIT, Math.max(1, n ?? 10));

const userCard = async (u: any) => ({
    id: Number(u.id),
    username: u.username,
    headshot: await headshot(Number(u.id)),
    url: `${SITE_URL}/user?id=${u.id}`
});

const gameCard = async (g: any, playing: Record<number, number>) => ({
    id: Number(g.id),
    title: g.title,
    creator: g.creator_id ? {
        id: Number(g.creator_id),
        username: g.creator_name ?? "Unknown"
    } : null,
    icon: await mediaUrl("icons", Number(g.id)),
    thumbnail: await mediaUrl("thumbnails", Number(g.id)),
    playing: playing[Number(g.id)] ?? 0,
    visits: Number(g.visits ?? 0),
    url: `${SITE_URL}/game?id=${g.id}`
});

const itemCard = async (i: any) => ({
    id: Number(i.id),
    name: i.name,
    category: i.category,
    price: i.price === null ? null : Number(i.price),
    creator: {
        id: Number(i.creator_id),
        username: i.creator_name ?? "NoneRev"
    },
    thumbnail: (await mediaUrl("catalog", Number(i.id))) || i.thumbnail || "",
    url: `${SITE_URL}/catalog/item?id=${i.id}`
});

const findUser = async (id?: number, username?: string) => {
    const [row] = id
        ? await sql`SELECT id, username, about, admin, created_at, lastOnlineSite, ongoing_action_id, membership, membership_expires FROM users WHERE id = ${id}`
        : await sql`SELECT id, username, about, admin, created_at, lastOnlineSite, ongoing_action_id, membership, membership_expires FROM users WHERE username = ${username ?? ""}`;
    if (!row) {
        return null;
    }
    if (row.ongoing_action_id) {
        const [action] = await sql`SELECT action FROM moderation_actions WHERE id = ${row.ongoing_action_id}`;
        if (action?.action === TERMINATED) {
            return null;
        }
    }
    return row;
};

const userProfile = async (row: any) => {
    const id = Number(row.id);
    const [[games], [favorites], [posts], badges, friends, history] = await Promise.all([
        sql`SELECT COUNT(*) AS n FROM games WHERE creator_id = ${id}`,
        sql`SELECT COUNT(*) AS n FROM game_favorites WHERE user_id = ${id}`,
        sql`SELECT COUNT(*) AS n FROM forum_posts WHERE author_id = ${id}`,
        siteBadges(row),
        friendCount(id),
        sql`SELECT DISTINCT old_username FROM username_history WHERE user_id = ${id} AND old_username != ${row.username} ORDER BY old_username`
    ]);
    return {
        id,
        username: row.username,
        about: row.about ?? "",
        admin: Number(row.admin) > 0,
        membership: membershipOf(row),
        online: isOnline(row.lastOnlineSite),
        moderated: row.ongoing_action_id !== null,
        joined: Number(row.created_at),
        friends,
        places: Number(games.n),
        favorites: Number(favorites.n),
        forum_posts: Number(posts.n),
        badges: badges.map(b => b.name),
        previous_usernames: history.map((h: any) => h.old_username),
        headshot: await headshot(id),
        avatar: await avatar(id),
        url: `${SITE_URL}/user?id=${id}`
    };
};

export const publicApi = new Elysia({ prefix: "/api/public" })

    .get("/stats", async () => {
        const [[u], [g], [c], servers] = await Promise.all([
            sql`SELECT COUNT(*) AS users, SUM(lastOnlineSite > ${now() - ONLINE_WINDOW}) AS online FROM users`,
            sql`SELECT COUNT(*) AS n FROM games`,
            sql`SELECT COUNT(*) AS n FROM catalog_items`,
            rcc.servers()
        ]);
        return cached({
            users: Number(u.users),
            online: Number(u.online ?? 0),
            games: Number(g.n),
            catalog_items: Number(c.n),
            servers: servers.length,
            playing: servers.reduce((sum, s: any) => sum + Number(s.players ?? 0), 0)
        });
    })

    .get("/status", async () => {
        const [health, servers] = await Promise.all([rcc.health(), rcc.servers()]);
        return cached({
            site: "up",
            rcc: health?.rcc === "up" ? "up" : health ? "down" : "unreachable",
            servers: servers.length,
            playing: servers.reduce((sum, s: any) => sum + Number(s.players ?? 0), 0)
        }, 10);
    })


    .get("/users/search", async ({ query }) => {
        const rows = await sql`SELECT id, username FROM users WHERE username LIKE ${like(query.q)} ORDER BY username = ${query.q.trim()} DESC, username ASC LIMIT ${size(query.limit)}`;
        return cached(await Promise.all(rows.map(userCard)));
    }, {
        query: t.Object({
            q: t.String({ minLength: 1, maxLength: 32 }),
            limit: t.Optional(t.Numeric())
        })
    })

    .get("/users/by-name/:username", async ({ params, status }) => {
        const row = await findUser(undefined, params.username);
        return row ? cached(await userProfile(row)) : status(404, {
            error: "unknown user"
        });
    }, {
        params: t.Object({
            username: t.String({ maxLength: 32 })
        })
    })

    .get("/users/:id", async ({ params, status }) => {
        const row = await findUser(params.id);
        return row ? cached(await userProfile(row)) : status(404, {
            error: "unknown user"
        });
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .get("/users/:id/games", async ({ params, query }) => {
        const rows = await sql`
            SELECT games.id, games.title, games.visits, games.creator_id, users.username AS creator_name FROM games
            LEFT JOIN users ON users.id = games.creator_id
            WHERE games.creator_id = ${params.id} ORDER BY games.id DESC LIMIT ${size(query.limit)}
        `;
        const playing = await rcc.players(rows.map((g: any) => Number(g.id)));
        return cached(await Promise.all(rows.map((g: any) => gameCard(g, playing))));
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        query: t.Object({
            limit: t.Optional(t.Numeric())
        })
    })


    .get("/games/search", async ({ query }) => {
        const rows = await sql`
            SELECT games.id, games.title, games.visits, games.creator_id, users.username AS creator_name FROM games
            LEFT JOIN users ON users.id = games.creator_id
            WHERE games.title LIKE ${like(query.q)} ORDER BY games.id DESC LIMIT ${size(query.limit)}
        `;
        const playing = await rcc.players(rows.map((g: any) => Number(g.id)));
        return cached(await Promise.all(rows.map((g: any) => gameCard(g, playing))));
    }, {
        query: t.Object({
            q: t.String({ minLength: 1, maxLength: 100 }),
            limit: t.Optional(t.Numeric())
        })
    })

    .get("/games/:id", async ({ params, status }) => {
        const [g] = await sql`
            SELECT games.*, users.username AS creator_name FROM games
            LEFT JOIN users ON users.id = games.creator_id
            WHERE games.id = ${params.id}
        `;
        if (!g) {
            return status(404, {
                error: "unknown game"
            });
        }
        const [[fav], servers, playing] = await Promise.all([
            sql`SELECT COUNT(*) AS n FROM game_favorites WHERE game_id = ${params.id}`,
            rcc.servers(),
            rcc.players([params.id])
        ]);
        const mine = servers.filter(s => s.placeId === params.id);
        return cached({
            ...await gameCard(g, playing),
            description: g.description ?? "",
            favorites: Number(fav.n),
            created: Number(g.created_at) || null,
            updated: Number(g.updated_at) || null,
            servers: mine.map((s: any) => ({
                players: Number(s.players ?? 0),
                ready: !!s.ready,
                started: s.startedAt
            }))
        });
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })


    .get("/catalog/search", async ({ query }) => {
        const rows = await sql`
            SELECT catalog_items.*, users.username AS creator_name FROM catalog_items
            LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE catalog_items.name LIKE ${like(query.q)} ORDER BY catalog_items.id DESC LIMIT ${size(query.limit)}
        `;
        return cached(await Promise.all(rows.map(itemCard)));
    }, {
        query: t.Object({
            q: t.String({ minLength: 1, maxLength: 80 }),
            limit: t.Optional(t.Numeric())
        })
    })

    .get("/catalog/:id", async ({ params, status }) => {
        const [i] = await sql`
            SELECT catalog_items.*, users.username AS creator_name FROM catalog_items
            LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE catalog_items.id = ${params.id}
        `;
        if (!i) {
            return status(404, {
                error: "unknown item"
            });
        }
        const [owners] = await sql`SELECT COUNT(*) AS n FROM user_items WHERE item_id = ${params.id}`;
        return cached({
            ...await itemCard(i),
            description: i.description ?? "",
            owners: Number(owners.n),
            limited: Number(i.is_limited) === 1,
            limited_unique: Number(i.is_limited_unique) === 1,
            stock: i.limited_stock === null ? null : Number(i.limited_stock),
            sold: Number(i.limited_sold),
            bc_only: Number(i.bc_only) === 1,
            featured: Number(i.is_featured) === 1
        });
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })
