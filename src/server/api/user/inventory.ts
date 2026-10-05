import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { withThumbnail, mediaUrl } from "../../paths";

const PER_PAGE = 30;


const CATEGORIES: Record<string, string | null> = {
    hats: "Hat",
    faces: "Face",
    gear: "Gear",
    packages: "Package",
    shirts: "Shirt",
    pants: "Pants",
    "t-shirts": "T-Shirt",
    badges: null,
    "game-passes": null,
    places: null
};

const placesFilter = (filter: string, user: { id: number, username: string }, offset: number) => {
    if (filter === "my-vip-servers" || filter === "other-vip-servers") {
        const where = filter === "my-vip-servers"
            ? sql`v.owner_id = ${user.id}`
            : sql`v.owner_id <> ${user.id} AND v.id IN (SELECT vip_id FROM vip_server_members WHERE user_id = ${user.id})`;
        return Promise.all([
            sql`
                SELECT games.id, games.id AS game_id, games.title AS name, games.creator_id, users.username AS creator_name,
                    v.id AS vip_id, v.name AS vip_name, v.owner_id AS vip_owner_id, owner.username AS vip_owner_name
                FROM vip_servers v
                JOIN games ON games.id = v.game_id
                LEFT JOIN users ON users.id = games.creator_id
                LEFT JOIN users owner ON owner.id = v.owner_id
                WHERE ${where}
                ORDER BY v.created_at DESC, v.id DESC LIMIT ${PER_PAGE} OFFSET ${offset}
            `,
            sql`SELECT COUNT(*)::int AS n FROM vip_servers v JOIN games ON games.id = v.game_id WHERE ${where}`
        ]);
    }
    if (filter === "purchased") {
        const owned = sql`games.id IN (SELECT p.game_id FROM user_game_passes up JOIN game_passes p ON p.id = up.pass_id WHERE up.user_id = ${user.id})`;
        return Promise.all([
            sql`
                SELECT games.id, games.id AS game_id, games.title AS name, games.creator_id, users.username AS creator_name FROM games
                LEFT JOIN users ON users.id = games.creator_id
                WHERE ${owned} ORDER BY games.id DESC LIMIT ${PER_PAGE} OFFSET ${offset}
            `,
            sql`SELECT COUNT(*)::int AS n FROM games WHERE ${owned}`
        ]);
    }
    return Promise.all([
        sql`
            SELECT id, id AS game_id, title AS name, creator_id, ${user.username} AS creator_name FROM games
            WHERE creator_id = ${user.id} ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS n FROM games WHERE creator_id = ${user.id}`
    ]);
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
        const filter = query.places_filter ?? "created";

        const [items, [count]] = type
            ? await Promise.all([
                sql`
                    SELECT catalog_items.id, catalog_items.name, catalog_items.thumbnail, catalog_items.creator_id, users.username AS creator_name,
                        catalog_items.is_limited, catalog_items.is_limited_unique, catalog_items.limited_stock,
                        user_items.wearing, user_items.serial_number
                    FROM user_items JOIN catalog_items ON catalog_items.id = user_items.item_id
                    LEFT JOIN users ON users.id = catalog_items.creator_id
                    WHERE user_items.user_id = ${user.id} AND catalog_items.category = ${type}
                    ORDER BY user_items.purchased_at DESC, catalog_items.id DESC
                    LIMIT ${PER_PAGE} OFFSET ${offset}
                `,
                sql`
                    SELECT COUNT(*)::int AS n FROM user_items JOIN catalog_items ON catalog_items.id = user_items.item_id
                    WHERE user_items.user_id = ${user.id} AND catalog_items.category = ${type}
                `
            ])
            : category === "badges"
            ? await Promise.all([
                sql`
                    SELECT b.id, b.name, b.icon, b.game_id, b.creator_id, users.username AS creator_name, games.title AS game_title
                    FROM user_badges ub JOIN game_badges b ON b.id = ub.badge_id
                    LEFT JOIN users ON users.id = b.creator_id LEFT JOIN games ON games.id = b.game_id
                    WHERE ub.user_id = ${user.id} ORDER BY ub.awarded_at DESC LIMIT ${PER_PAGE} OFFSET ${offset}
                `,
                sql`SELECT COUNT(*)::int AS n FROM user_badges WHERE user_id = ${user.id}`
            ])
            : category === "places"
            ? await placesFilter(filter, user, offset)
            : await Promise.all([
                sql`
                    SELECT p.id, p.name, p.icon, p.game_id, p.creator_id, users.username AS creator_name, games.title AS game_title
                    FROM user_game_passes up JOIN game_passes p ON p.id = up.pass_id
                    LEFT JOIN users ON users.id = p.creator_id LEFT JOIN games ON games.id = p.game_id
                    WHERE up.user_id = ${user.id} ORDER BY up.purchased_at DESC LIMIT ${PER_PAGE} OFFSET ${offset}
                `,
                sql`SELECT COUNT(*)::int AS n FROM user_game_passes WHERE user_id = ${user.id}`
            ]);

        return {
            category,
            items: type
                ? await Promise.all(items.map(withThumbnail))
                : category === "places"
                ? await Promise.all(items.map(async (g: any) => ({
                    ...g,
                    icon: await mediaUrl("icons", Number(g.id))
                })))
                : items,
            ...(category === "places" ? {
                places_filter: filter
            } : {}),
            page,
            totalPages: Math.max(1, Math.ceil(Number(count.n) / PER_PAGE))
        };
    }, {
        auth: true,
        query: t.Object({
            category: t.Optional(t.String()),
            places_filter: t.Optional(t.Union([
                t.Literal("created"),
                t.Literal("my-vip-servers"),
                t.Literal("other-vip-servers"),
                t.Literal("purchased")
            ])),
            page: t.Optional(t.Numeric())
        })
    })
