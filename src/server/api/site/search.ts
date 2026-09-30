import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { mediaUrl, withThumbnail } from "../../paths";
import { isOnline } from "../../friends";

const PER_PAGE = 10;

const SUGGESTIONS = [
    ["games", "Games"],
    ["user", "Users"],
    ["library", "Library"],
    ["groups", "Groups"],
    ["catalog", "Catalog"]
];

const withMedia = async (game: any) => ({
    ...game,
    description: game.description ?? "",
    thumbnail: await mediaUrl("thumbnails", game.id),
    icon: await mediaUrl("icons", game.id),
    playing: 0,
    visits: Number(game.visits ?? 0),
    favorites: 0,
    up_votes: 0,
    down_votes: 0,
    like_ratio: 0,
    max_players: 50,
    genre: "All"
});

const paginate = async (from: any, page: number) => {
    const [count] = await sql`SELECT COUNT(*) AS n FROM ${from}`;
    const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
    return {
        page: Math.min(Math.max(1, page), totalPages),
        totalPages
    };
};

export const search = new Elysia({ prefix: "/search" })
    .use(session)


    .get("/", async ({ query }) => {
        const like = "%" + query.q.trim() + "%";
        const type = query.type ?? "games";

        if (type === "games") {
            const { page, totalPages } = await paginate(sql`games WHERE title LIKE ${like}`, query.page ?? 1);
            const rows = await sql`
                SELECT games.*, users.username AS creator_name FROM games
                LEFT JOIN users ON users.id = games.creator_id
                WHERE games.title LIKE ${like}
                ORDER BY games.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
            `;
            return {
                type,
                page,
                totalPages,
                results: await Promise.all(rows.map(withMedia))
            };
        }

        if (type === "groups") {
            const { page, totalPages } = await paginate(sql`site_groups WHERE name LIKE ${like}`, query.page ?? 1);
            const rows = await sql`
                SELECT g.*, users.username AS owner_username,
                (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
                FROM site_groups g LEFT JOIN users ON users.id = g.owner_id
                WHERE g.name LIKE ${like}
                ORDER BY g.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
            `;
            return {
                type,
                page,
                totalPages,
                results: await Promise.all(rows.map(async (g: any) => ({
                    ...g,
                    member_count: Number(g.member_count),
                    icon: g.icon || await mediaUrl("groups", g.id)
                })))
            };
        }

        if (type === "catalog") {
            const { page, totalPages } = await paginate(sql`catalog_items WHERE name LIKE ${like}`, query.page ?? 1);
            const rows = await sql`
                SELECT c.*, u.username AS creator_name FROM catalog_items c
                LEFT JOIN users u ON u.id = c.creator_id
                WHERE c.name LIKE ${like}
                ORDER BY c.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
            `;
            return {
                type,
                page,
                totalPages,
                results: await Promise.all(rows.map(withThumbnail))
            };
        }

        if (type === "library") {
            const { page, totalPages } = await paginate(sql`assets WHERE name LIKE ${like} AND type IN ('Model', 'Decal')`, query.page ?? 1);
            const rows = await sql`
                SELECT a.id, a.name, a.type, a.creator_id, u.username AS creator_name
                FROM assets a LEFT JOIN users u ON u.id = a.creator_id
                WHERE a.name LIKE ${like} AND a.type IN ('Model', 'Decal')
                ORDER BY a.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
            `;
            return {
                type,
                page,
                totalPages,
                results: rows
            };
        }

        const { page, totalPages } = await paginate(sql`users WHERE username LIKE ${like}`, query.page ?? 1);
        const rows = await sql`
            SELECT id, username, lastOnlineSite FROM users
            WHERE username LIKE ${like}
            ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;
        return {
            type: "user",
            page,
            totalPages,
            results: rows.map((u: any) => ({
                id: u.id,
                username: u.username,
                online: isOnline(u.lastOnlineSite)
            }))
        };
    }, {
        query: t.Object({
            q: t.String(),
            type: t.Optional(t.Union([
                t.Literal("games"),
                t.Literal("user"),
                t.Literal("library"),
                t.Literal("groups"),
                t.Literal("catalog")
            ])),
            page: t.Optional(t.Numeric())
        })
    })


    .get("/suggestions", ({ query }) => {
        const q = query.q.trim();
        return SUGGESTIONS.map(([type, label]) => ({
            type,
            label: `${q} in ${label}`,
            url: `/search?q=${encodeURIComponent(q)}&type=${type}`
        }));
    }, {
        query: t.Object({
            q: t.String()
        })
    })
