import { Elysia, t } from "elysia";
import { sql } from "../../db";
import { mediaUrl, withThumbnail } from "../../paths";

const PER_PAGE = 30;

const CATEGORIES: Record<string, string | null> = {
    hats: "Hat",
    faces: "Face",
    gear: "Gear",
    packages: "Package",
    shirts: "Shirt",
    pants: "Pants",
    "t-shirts": "T-Shirt",
    places: null
};

export const favorites = new Elysia({ prefix: "/favorites" })
    .get("/:id", async ({ params, query, status }) => {
        const [who] = await sql`SELECT id, username FROM users WHERE id = ${params.id}`;
        if (!who) {
            return status(404, {
                error: "unknown user"
            });
        }
        const category = query.category ?? "hats";
        const type = CATEGORIES[category] ?? null;
        if (!(category in CATEGORIES)) {
            return {
                username: who.username,
                category,
                page: 1,
                totalPages: 1,
                total: 0,
                items: []
            };
        }

        const [count] = type
            ? await sql`
                SELECT COUNT(*)::int AS n FROM catalog_favorites f JOIN catalog_items c ON c.id = f.item_id
                WHERE f.user_id = ${params.id} AND c.category = ${type}
            `
            : await sql`SELECT COUNT(*)::int AS n FROM game_favorites f JOIN games ON games.id = f.game_id WHERE f.user_id = ${params.id}`;
        const total = Number(count.n);
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
        const offset = (page - 1) * PER_PAGE;

        if (type) {
            const items = await sql`
                SELECT c.id, c.name, c.thumbnail, c.creator_id, c.price, c.tix_price, c.is_limited, c.is_limited_unique, c.limited_stock, c.limited_sold,
                    u.username AS creator_name,
                    (SELECT MIN(price) FROM resale_listings WHERE item_id = c.id) AS best_price
                FROM catalog_favorites f
                JOIN catalog_items c ON c.id = f.item_id
                LEFT JOIN users u ON u.id = c.creator_id
                WHERE f.user_id = ${params.id} AND c.category = ${type}
                ORDER BY f.created_at DESC LIMIT ${PER_PAGE} OFFSET ${offset}
            `;
            return {
                username: who.username,
                category,
                page,
                totalPages,
                total,
                items: await Promise.all(items.map(async (item: any) => ({
                    ...await withThumbnail(item),
                    best_price: item.best_price === null ? null : Number(item.best_price)
                })))
            };
        }

        const rows = await sql`
            SELECT games.id, games.title AS name, games.creator_id, users.username AS creator_name FROM game_favorites f
            JOIN games ON games.id = f.game_id
            LEFT JOIN users ON users.id = games.creator_id
            WHERE f.user_id = ${params.id}
            ORDER BY f.created_at DESC LIMIT ${PER_PAGE} OFFSET ${offset}
        `;
        return {
            username: who.username,
            category,
            page,
            totalPages,
            total,
            items: await Promise.all(rows.map(async (g: any) => ({
                id: Number(g.id),
                name: g.name,
                creator_id: Number(g.creator_id),
                creator_name: g.creator_name ?? "Unknown",
                icon: await mediaUrl("icons", Number(g.id))
            })))
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        query: t.Object({
            page: t.Optional(t.Numeric()),
            category: t.Optional(t.String())
        })
    })
