import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { withThumbnail } from "../../paths";

import { purchase } from "./purchase";

const PER_PAGE = 24;

const CATEGORIES: Record<string, string[]> = {
    clothing: ["Hat", "Shirt", "T-Shirt", "Pants", "Package"],
    bodyparts: ["Face", "Package"],
    hats: ["Hat"],
    faces: ["Face"],
    "t-shirts": ["T-Shirt"],
    shirts: ["Shirt"],
    pants: ["Pants"],
    gear: ["Gear"],
    packages: ["Package"]
};

const SORTS = {
    featured: sql`catalog_items.is_featured DESC, catalog_items.id DESC`,
    recent: sql`catalog_items.id DESC`,
    "price-low": sql`catalog_items.price IS NULL, catalog_items.price ASC, catalog_items.id DESC`,
    "price-high": sql`catalog_items.price IS NULL, catalog_items.price DESC, catalog_items.id DESC`
};

export const catalog = new Elysia({ prefix: "/api/catalog" })
    .use(session)
    .use(purchase)

    .get("/", async ({ query }) => {
        const q = (query.q ?? "").trim();
        let category = query.category ?? "featured";
        if (category !== "featured" && category !== "all" && !(category in CATEGORIES)) {
            category = "featured";
        }

        if (q !== "" && category === "featured") {
            category = "all";
        }
        const order = SORTS[(query.sort ?? "featured") as keyof typeof SORTS] ?? SORTS.featured;

        const where = sql`
            ${q !== "" ? sql`catalog_items.name LIKE ${"%" + q + "%"}` : sql`1 = 1`}
            AND ${category === "featured" ? sql`catalog_items.is_featured = 1` : category === "all" ? sql`1 = 1` : sql`catalog_items.category IN ${sql(CATEGORIES[category]!)}`}
        `;

        const [count] = await sql`SELECT COUNT(*) AS n FROM catalog_items WHERE ${where}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

        const items = await sql`
            SELECT catalog_items.*, users.username AS creator_name
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE ${where}
            ORDER BY ${order}
            LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;

        return {
            category,
            sort: query.sort ?? "featured",
            page,
            totalPages,
            items: await Promise.all(items.map(withThumbnail))
        };
    }, {
        query: t.Object({
            q: t.Optional(t.String()),
            category: t.Optional(t.String()),
            sort: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/:id", async ({ params, user, status }) => {
        const [item] = await sql`
            SELECT catalog_items.*, users.username AS creator_name
            FROM catalog_items LEFT JOIN users ON users.id = catalog_items.creator_id
            WHERE catalog_items.id = ${params.id}
        `;
        if (!item) {
            return status(404, {
                error: "This item does not exist"
            });
        }

        const [owners] = await sql`SELECT COUNT(*) AS n FROM user_items WHERE item_id = ${params.id}`;
        const [mine] = user
            ? await sql`SELECT wearing, serial_number FROM user_items WHERE user_id = ${user.id} AND item_id = ${params.id}`
            : [null];

        return {
            ...await withThumbnail(item),
            sales: Number(owners.n),
            owned: mine !== null && mine !== undefined,
            wearing: !!mine?.wearing,
            serial_number: mine?.serial_number ?? null
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })
