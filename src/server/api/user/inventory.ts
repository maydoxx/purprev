import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";

const PER_PAGE = 30;

// tab name => catalog category. badges and game-passes are their own tables
const CATEGORIES: Record<string, string | null> = {
    hats: "Hat",
    faces: "Face",
    gear: "Gear",
    packages: "Package",
    shirts: "Shirt",
    pants: "Pants",
    "t-shirts": "T-Shirt",
    badges: null,
    "game-passes": null
};

export const inventory = new Elysia({ prefix: "/inventory" })
    .use(session)
    .get("/", async ({ query, user, status }) => {
        const category = query.category ?? "hats";
        if (!(category in CATEGORIES)) {
            return status(400, {
                error: "unknown category"
            });
        }

        const page = Math.max(1, query.page ?? 1);
        const offset = (page - 1) * PER_PAGE;
        const type = CATEGORIES[category];

        const [items, [count]] = type
            ? await Promise.all([
                sql`
                    SELECT catalog_items.id, catalog_items.name, catalog_items.thumbnail, user_items.wearing, user_items.serial_number
                    FROM user_items JOIN catalog_items ON catalog_items.id = user_items.item_id
                    WHERE user_items.user_id = ${user.id} AND catalog_items.category = ${type}
                    ORDER BY user_items.purchased_at DESC, catalog_items.id DESC
                    LIMIT ${PER_PAGE} OFFSET ${offset}
                `,
                sql`
                    SELECT COUNT(*) AS n FROM user_items JOIN catalog_items ON catalog_items.id = user_items.item_id
                    WHERE user_items.user_id = ${user.id} AND catalog_items.category = ${type}
                `
            ])
            : category === "badges"
            ? await Promise.all([
                sql`
                    SELECT b.id, b.name, b.icon, b.game_id FROM user_badges ub JOIN game_badges b ON b.id = ub.badge_id
                    WHERE ub.user_id = ${user.id} ORDER BY ub.awarded_at DESC LIMIT ${PER_PAGE} OFFSET ${offset}
                `,
                sql`SELECT COUNT(*) AS n FROM user_badges WHERE user_id = ${user.id}`
            ])
            : await Promise.all([
                sql`
                    SELECT p.id, p.name, p.icon, p.game_id FROM user_game_passes up JOIN game_passes p ON p.id = up.pass_id
                    WHERE up.user_id = ${user.id} ORDER BY up.purchased_at DESC LIMIT ${PER_PAGE} OFFSET ${offset}
                `,
                sql`SELECT COUNT(*) AS n FROM user_game_passes WHERE user_id = ${user.id}`
            ]);

        return {
            category,
            items,
            page,
            totalPages: Math.max(1, Math.ceil(Number(count.n) / PER_PAGE))
        };
    }, {
        auth: true,
        query: t.Object({
            category: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })
