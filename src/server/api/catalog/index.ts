import { Elysia, t } from "elysia";
import type { SQL } from "bun";
import { session } from "../../session";
import { sql, now } from "../../db";
import { withThumbnail } from "../../paths";

import { purchase } from "./purchase";
import { resale, isResellable } from "./resale";

const PER_PAGE = 42;
const LANDING_FEATURED = 22;
const LANDING_COLLECTIBLES = 12;

const CATEGORIES: Record<string, string[]> = {
    clothing: ["Hat", "Shirt", "T-Shirt", "Pants", "Package"],
    bodyparts: ["Face", "Package"],
    hats: ["Hat"],
    heads: [],
    faces: ["Face"],
    "t-shirts": ["T-Shirt"],
    shirts: ["Shirt"],
    pants: ["Pants"],
    gear: ["Gear"],
    packages: ["Package"],
    "featured-hats": ["Hat"],
    "featured-gear": ["Gear"],
    "featured-faces": ["Face"],
    "featured-packages": ["Package"],
    "collectible-hats": ["Hat"],
    "collectible-faces": ["Face"],
    "collectible-gear": ["Gear"]
};

const SORTS: Record<string, SQL.Query<any>> = {
    relevance: sql`catalog_items.is_featured DESC, catalog_items.id DESC`,
    favorited: sql`favorites DESC, catalog_items.id DESC`,
    bestselling: sql`owners DESC, catalog_items.id DESC`,
    recent: sql`catalog_items.updated_at DESC, catalog_items.id DESC`,
    "price-low": sql`catalog_items.price IS NULL, catalog_items.price ASC, catalog_items.id DESC`,
    "price-high": sql`catalog_items.price IS NULL, catalog_items.price DESC, catalog_items.id DESC`
};

const CURRENCIES: Record<string, SQL.Query<any>> = {
    all: sql`1 = 1`,
    nonebux: sql`catalog_items.price IS NOT NULL AND catalog_items.price > 0`,
    tix: sql`catalog_items.tix_price IS NOT NULL`,
    free: sql`catalog_items.price = 0`
};

const limited = sql`(catalog_items.is_limited = 1 OR catalog_items.is_limited_unique = 1)`;
const available = sql`(catalog_items.price IS NOT NULL OR catalog_items.tix_price IS NOT NULL OR ${limited})`;

const columns = sql`
    catalog_items.*, users.username AS creator_name,
    (SELECT COUNT(*) FROM user_items WHERE user_items.item_id = catalog_items.id) AS owners,
    (SELECT COUNT(*) FROM catalog_favorites WHERE catalog_favorites.item_id = catalog_items.id) AS favorites,
    (
        SELECT MIN(resale_listings.price) FROM resale_listings
        JOIN user_items ON user_items.user_id = resale_listings.user_id AND user_items.item_id = resale_listings.item_id
        WHERE resale_listings.item_id = catalog_items.id
    ) AS best_price
`;

const card = async (item: any) => ({
    ...await withThumbnail(item),
    owners: Number(item.owners),
    favorites: Number(item.favorites),
    sales: Number(item.is_limited_unique ? item.limited_sold : item.owners),
    best_price: item.best_price === null ? null : Number(item.best_price)
});

const categoryWhere = (category: string) => {
    if (category === "all") {
        return sql`1 = 1`;
    }
    if (category === "featured") {
        return sql`catalog_items.is_featured = 1`;
    }
    if (category === "collectibles") {
        return limited;
    }
    const types = CATEGORIES[category] ?? [];
    const inTypes = types.length ? sql`catalog_items.category IN ${sql(types)}` : sql`0 = 1`;
    if (category.startsWith("featured-")) {
        return sql`catalog_items.is_featured = 1 AND ${inTypes}`;
    }
    if (category.startsWith("collectible-")) {
        return sql`${limited} AND ${inTypes}`;
    }
    return inTypes;
};

export const catalog = new Elysia({ prefix: "/api/catalog" })
    .use(session)
    .use(purchase)
    .use(resale)

    .get("/landing", async () => {
        const featured = await sql`
            SELECT ${columns}
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE catalog_items.is_featured = 1 AND ${available}
            ORDER BY catalog_items.updated_at DESC, catalog_items.id DESC
            LIMIT ${LANDING_FEATURED}
        `;
        const collectibles = await sql`
            SELECT ${columns}
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE ${limited}
            ORDER BY catalog_items.updated_at DESC, catalog_items.id DESC
            LIMIT ${LANDING_COLLECTIBLES}
        `;
        return {
            featured: await Promise.all(featured.map(card)),
            collectibles: await Promise.all(collectibles.map(card))
        };
    })

    .get("/", async ({ query }) => {
        const q = (query.q ?? "").trim();
        let category = query.category ?? "all";
        if (category !== "featured" && category !== "collectibles" && category !== "all" && !(category in CATEGORIES)) {
            category = "all";
        }
        const sort = query.sort && query.sort in SORTS ? query.sort : "relevance";
        const currency = query.currency && query.currency in CURRENCIES ? query.currency : "all";
        const creator = (query.creator ?? "").trim();
        const unavailable = query.unavailable === "1" || query.unavailable === "true";

        const where = sql`
            ${q !== "" ? sql`catalog_items.name LIKE ${"%" + q + "%"}` : sql`1 = 1`}
            AND ${categoryWhere(category)}
            AND ${CURRENCIES[currency]}
            AND ${creator !== "" ? sql`users.username = ${creator}` : sql`1 = 1`}
            AND ${unavailable ? sql`1 = 1` : available}
        `;

        const [count] = await sql`
            SELECT COUNT(*) AS n
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE ${where}
        `;
        const total = Number(count.n);
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

        const items = await sql`
            SELECT ${columns}
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE ${where}
            ORDER BY ${SORTS[sort]}
            LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;

        return {
            category,
            sort,
            currency,
            creator,
            page,
            totalPages,
            total,
            perPage: PER_PAGE,
            items: await Promise.all(items.map(card))
        };
    }, {
        query: t.Object({
            q: t.Optional(t.String()),
            category: t.Optional(t.String()),
            sort: t.Optional(t.String()),
            currency: t.Optional(t.String()),
            creator: t.Optional(t.String()),
            unavailable: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/:id", async ({ params, user, status }) => {
        const [item] = await sql`
            SELECT ${columns}, users.membership AS creator_membership
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE catalog_items.id = ${params.id}
        `;
        if (!item) {
            return status(404, {
                error: "This item does not exist"
            });
        }

        const [favoriteMine] = user
            ? await sql`SELECT 1 FROM catalog_favorites WHERE user_id = ${user.id} AND item_id = ${params.id}`
            : [null];
        const [mine] = user
            ? await sql`SELECT wearing, serial_number FROM user_items WHERE user_id = ${user.id} AND item_id = ${params.id}`
            : [null];
        const [resellers] = isResellable(item)
            ? await sql`
                SELECT COUNT(*) AS n FROM resale_listings
                JOIN user_items ON user_items.user_id = resale_listings.user_id AND user_items.item_id = resale_listings.item_id
                WHERE resale_listings.item_id = ${params.id}
            `
            : [{ n: 0 }];

        return {
            ...await card(item),
            resellable: isResellable(item),
            resellers: Number(resellers.n),
            favorited: !!favoriteMine,
            owned: mine !== null && mine !== undefined,
            wearing: !!mine?.wearing,
            serial_number: mine?.serial_number ?? null
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .get("/:id/recommended", async ({ params }) => {
        const [item] = await sql`SELECT category FROM catalog_items WHERE id = ${params.id}`;
        if (!item) {
            return {
                items: []
            };
        }
        const items = await sql`
            SELECT ${columns}
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE catalog_items.category = ${item.category} AND catalog_items.id != ${params.id} AND ${available}
            ORDER BY RAND()
            LIMIT 6
        `;
        const others = await sql`
            SELECT games.id, games.title AS name FROM games
            ORDER BY RAND()
            LIMIT 3
        `;
        const otherItems = await sql`
            SELECT catalog_items.id, catalog_items.name FROM catalog_items
            WHERE catalog_items.id != ${params.id} AND catalog_items.price = 0
            ORDER BY RAND()
            LIMIT 3
        `;
        return {
            items: await Promise.all(items.map(card)),
            others: [
                ...others.map((g: any) => ({
                    kind: "game",
                    id: g.id,
                    name: g.name
                })),
                ...otherItems.map((i: any) => ({
                    kind: "item",
                    id: i.id,
                    name: i.name
                }))
            ]
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .post("/:id/favorite", async ({ params, user, status }) => {
        const [item] = await sql`SELECT id FROM catalog_items WHERE id = ${params.id}`;
        if (!item) {
            return status(404, {
                error: "Item not found"
            });
        }
        const removed = await sql`DELETE FROM catalog_favorites WHERE user_id = ${user.id} AND item_id = ${params.id}`;
        if (!removed.affectedRows) {
            await sql`INSERT INTO catalog_favorites (user_id, item_id, created_at) VALUES (${user.id}, ${params.id}, ${now()})`;
        }
        const [count] = await sql`SELECT COUNT(*) AS n FROM catalog_favorites WHERE item_id = ${params.id}`;
        return {
            favorited: !removed.affectedRows,
            favorites: Number(count.n)
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        })
    })
