import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { withThumbnail } from "../../paths";

const MAX_ITEMS = 6;

export const collectionOf = async (userId: number) => {
    const rows = await sql`
        SELECT c.id, c.name, c.thumbnail FROM user_collections uc
        JOIN catalog_items c ON c.id = uc.item_id
        JOIN user_items ui ON ui.user_id = uc.user_id AND ui.item_id = uc.item_id
        WHERE uc.user_id = ${userId}
        ORDER BY uc.position ASC, uc.item_id ASC
        LIMIT ${MAX_ITEMS}
    `;
    return await Promise.all(rows.map(withThumbnail));
};

export const collections = new Elysia({ prefix: "/collections" })
    .use(session)
    .get("/owned", async ({ user }) => {
        const rows = await sql`
            SELECT c.id, c.name, c.thumbnail, c.category FROM user_items ui
            JOIN catalog_items c ON c.id = ui.item_id
            WHERE ui.user_id = ${user.id}
            ORDER BY ui.purchased_at DESC, c.id DESC
            LIMIT 300
        `;
        return await Promise.all(rows.map(withThumbnail));
    }, {
        auth: true
    })

    .get("/:id", async ({ params }) => await collectionOf(params.id), {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .post("/", async ({ body, user, status }) => {
        const ids = [...new Set(body.items.map(Number))].filter(n => n > 0);
        if (ids.length > MAX_ITEMS) {
            return status(400, {
                error: `You can show up to ${MAX_ITEMS} items.`
            });
        }
        if (ids.length > 0) {
            const owned = await sql`SELECT item_id FROM user_items WHERE user_id = ${user.id} AND item_id IN ${sql(ids)}`;
            if (owned.length !== ids.length) {
                return status(400, {
                    error: "You can only show items you own."
                });
            }
        }
        await sql.begin(async tx => {
            await tx`DELETE FROM user_collections WHERE user_id = ${user.id}`;
            for (const [position, itemId] of ids.entries()) {
                await tx`INSERT INTO user_collections (user_id, item_id, position) VALUES (${user.id}, ${itemId}, ${position})`;
            }
        });
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            items: t.Array(t.Numeric())
        })
    })
