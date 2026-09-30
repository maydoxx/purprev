import { Elysia, t } from "elysia";
import { sql } from "../../db";
import { mediaUrl, withThumbnail } from "../../paths";
import { rcc } from "../../rcc";

const PER_PAGE = 24;

export const favorites = new Elysia({ prefix: "/favorites" })
    .get("/:id", async ({ params, query, status }) => {
        const [who] = await sql`SELECT id, username FROM users WHERE id = ${params.id}`;
        if (!who) {
            return status(404, {
                error: "unknown user"
            });
        }
        const type = query.type ?? "games";
        const [count] = type === "items"
            ? await sql`SELECT COUNT(*) AS n FROM catalog_favorites WHERE user_id = ${params.id}`
            : await sql`SELECT COUNT(*) AS n FROM game_favorites WHERE user_id = ${params.id}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

        if (type === "items") {
            const items = await sql`SELECT c.*, u.username AS creator_name FROM catalog_favorites f JOIN catalog_items c ON c.id = f.item_id LEFT JOIN users u ON u.id = c.creator_id WHERE f.user_id = ${params.id} ORDER BY f.created_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`;
            return { username: who.username, page, totalPages, total: Number(count.n), type, items: await Promise.all(items.map(withThumbnail)), games: [] };
        }

        const rows = await sql`
            SELECT games.id, games.title, games.creator_id, users.username AS creator_name FROM game_favorites f
            JOIN games ON games.id = f.game_id
            LEFT JOIN users ON users.id = games.creator_id
            WHERE f.user_id = ${params.id}
            ORDER BY f.created_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;
        const playing = await rcc.players(rows.map((g: any) => Number(g.id)));

        return {
            username: who.username,
            page,
            totalPages,
            total: Number(count.n),
            games: await Promise.all(rows.map(async (g: any) => ({
                id: Number(g.id),
                title: g.title,
                creator_id: Number(g.creator_id),
                creator_name: g.creator_name ?? "Unknown",
                icon: await mediaUrl("icons", Number(g.id)),
                playing: playing[Number(g.id)] ?? 0
            })))
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        query: t.Object({
            page: t.Optional(t.Numeric()),
            type: t.Optional(t.Union([t.Literal("games"), t.Literal("items")]))
        })
    })
