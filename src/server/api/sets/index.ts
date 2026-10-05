import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { thumbUrl } from "../studio/toolbox";

const SETS_MAX = 50;
const ITEMS_MAX = 500;
const SET_TYPES = ["Model", "Decal"];

class SetError extends Error {}

const id = t.Object({
    id: t.Numeric()
});

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 50);
const cleanDescription = (text: string) => text.replace(/\r\n/g, "\n").trim().slice(0, 500);

const ownedSet = async (setId: number, userId: number) => {
    const [set] = await sql`SELECT id, user_id, name, description, created_at, updated_at FROM sets WHERE id = ${setId}`;
    if (!set || Number(set.user_id) !== userId) {
        throw new SetError("That set does not exist.");
    }
    return set;
};

const setRow = async (set: any) => {
    const [count] = await sql`SELECT COUNT(*)::int AS n FROM set_items WHERE set_id = ${set.id}`;
    const [first] = await sql`SELECT asset_id FROM set_items WHERE set_id = ${set.id} ORDER BY position, id LIMIT 1`;
    return {
        id: Number(set.id),
        name: set.name,
        description: set.description,
        items: Number(count.n),
        icon: first ? thumbUrl(Number(first.asset_id)) : "",
        created_at: Number(set.created_at),
        updated_at: Number(set.updated_at)
    };
};

export type SetItem = {
    id: number;
    asset_id: number;
    name: string;
    type: string;
    creator: string;
    created_at: number;
    thumbnail: string;
};

export const setItems = async (setId: number): Promise<SetItem[]> => {
    const rows = await sql`
        SELECT set_items.id, set_items.asset_id, set_items.position, assets.name, assets.type, assets.creator_id, assets.created_at, users.username
        FROM set_items
        JOIN assets ON assets.id = set_items.asset_id
        LEFT JOIN users ON users.id = assets.creator_id
        WHERE set_items.set_id = ${setId}
        ORDER BY set_items.position, set_items.id
    `;
    return rows.map((r: any) => ({
        id: Number(r.id),
        asset_id: Number(r.asset_id),
        name: r.name,
        type: r.type,
        creator: r.username ?? "NoneRev",
        created_at: Number(r.created_at),
        thumbnail: thumbUrl(Number(r.asset_id))
    }));
};

export const setsOf = async (userId: number) => {
    const rows = await sql`SELECT id, user_id, name, description, created_at, updated_at FROM sets WHERE user_id = ${userId} ORDER BY name, id`;
    return Promise.all(rows.map(setRow));
};

const handle = (err: unknown, status: any) => {
    if (err instanceof SetError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

export const sets = new Elysia({ prefix: "/api/sets" })
    .use(session)

    .get("/", async ({ user }) => ({
        list: await setsOf(user.id)
    }), {
        auth: true
    })

    .get("/assets", async ({ query, user }) => {
        const q = (query.q ?? "").trim().slice(0, 100);
        const like = `%${q.replace(/[%_]/g, "")}%`;
        const rows = await sql`
            SELECT id, name, type, created_at FROM assets
            WHERE creator_id = ${user.id} AND parent_id IS NULL AND type IN ${sql(SET_TYPES)} AND name ILIKE ${like}
            ORDER BY id DESC LIMIT 200
        `;
        return {
            list: rows.map((r: any) => ({
                id: Number(r.id),
                name: r.name,
                type: r.type,
                created_at: Number(r.created_at),
                thumbnail: thumbUrl(Number(r.id))
            }))
        };
    }, {
        auth: true,
        query: t.Object({
            q: t.Optional(t.String())
        })
    })

    .get("/:id", async ({ params, user, status }) => {
        try {
            const set = await ownedSet(params.id, user.id);
            return {
                set: await setRow(set),
                items: await setItems(params.id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .post("/", async ({ body, user, status }) => {
        try {
            const name = cleanName(body.name);
            if (name === "") {
                throw new SetError("Give the set a name.");
            }
            const [count] = await sql`SELECT COUNT(*)::int AS n FROM sets WHERE user_id = ${user.id}`;
            if (Number(count.n) >= SETS_MAX) {
                throw new SetError(`You can have up to ${SETS_MAX} sets.`);
            }
            const [dupe] = await sql`SELECT id FROM sets WHERE user_id = ${user.id} AND name = ${name}`;
            if (dupe) {
                throw new SetError("You already have a set with that name.");
            }
            const created = await sql`
                INSERT INTO sets (user_id, name, description, created_at, updated_at)
                VALUES (${user.id}, ${name}, ${cleanDescription(body.description ?? "")}, ${now()}, ${now()}) RETURNING id`;
            return {
                ok: true,
                id: Number(created[0].id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            name: t.String({
                maxLength: 100
            }),
            description: t.Optional(t.String({
                maxLength: 1000
            }))
        })
    })

    .post("/:id", async ({ params, body, user, status }) => {
        try {
            await ownedSet(params.id, user.id);
            const name = cleanName(body.name);
            if (name === "") {
                throw new SetError("Give the set a name.");
            }
            const [dupe] = await sql`SELECT id FROM sets WHERE user_id = ${user.id} AND name = ${name} AND id != ${params.id}`;
            if (dupe) {
                throw new SetError("You already have a set with that name.");
            }
            await sql`
                UPDATE sets SET name = ${name}, description = ${cleanDescription(body.description ?? "")}, updated_at = ${now()}
                WHERE id = ${params.id}
            `;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            name: t.String({
                maxLength: 100
            }),
            description: t.Optional(t.String({
                maxLength: 1000
            }))
        })
    })

    .delete("/:id", async ({ params, user, status }) => {
        try {
            await ownedSet(params.id, user.id);
            await sql`DELETE FROM set_items WHERE set_id = ${params.id}`;
            await sql`DELETE FROM sets WHERE id = ${params.id}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .post("/:id/items", async ({ params, body, user, status }) => {
        try {
            await ownedSet(params.id, user.id);
            const [asset] = await sql`SELECT id, type FROM assets WHERE id = ${body.assetId} AND creator_id = ${user.id} AND parent_id IS NULL`;
            if (!asset || !SET_TYPES.includes(asset.type)) {
                throw new SetError("You can only add your own models and decals.");
            }
            const [count] = await sql`SELECT COUNT(*)::int AS n FROM set_items WHERE set_id = ${params.id}`;
            if (Number(count.n) >= ITEMS_MAX) {
                throw new SetError(`A set can hold up to ${ITEMS_MAX} items.`);
            }
            const [last] = await sql`SELECT MAX(position) AS p FROM set_items WHERE set_id = ${params.id}`;
            const added = await sql`
                INSERT INTO set_items (set_id, asset_id, position, added_at)
                VALUES (${params.id}, ${body.assetId}, ${Number(last?.p ?? 0) + 1}, ${now()}) ON CONFLICT DO NOTHING`;
            if (!added.count) {
                throw new SetError("That item is already in this set.");
            }
            await sql`UPDATE sets SET updated_at = ${now()} WHERE id = ${params.id}`;
            return {
                ok: true,
                items: await setItems(params.id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            assetId: t.Integer()
        })
    })

    .post("/:id/move", async ({ params, body, user, status }) => {
        try {
            await ownedSet(params.id, user.id);
            const target = await ownedSet(body.setId, user.id);
            const [item] = await sql`SELECT asset_id FROM set_items WHERE id = ${body.itemId} AND set_id = ${params.id}`;
            if (!item) {
                throw new SetError("That item is not in this set.");
            }
            if (Number(target.id) === params.id) {
                throw new SetError("You can't move an item to the set it's currently in.");
            }
            const [last] = await sql`SELECT MAX(position) AS p FROM set_items WHERE set_id = ${target.id}`;
            const moved = await sql`
                UPDATE IGNORE set_items SET set_id = ${target.id}, position = ${Number(last?.p ?? 0) + 1}
                WHERE id = ${body.itemId}
            `;
            if (!moved.count) {
                throw new SetError("That item is already in the other set.");
            }
            await sql`UPDATE sets SET updated_at = ${now()} WHERE id IN (${params.id}, ${target.id})`;
            return {
                ok: true,
                items: await setItems(params.id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            itemId: t.Integer(),
            setId: t.Integer()
        })
    })

    .post("/:id/order", async ({ params, body, user, status }) => {
        try {
            await ownedSet(params.id, user.id);
            for (const [i, itemId] of body.items.entries()) {
                await sql`UPDATE set_items SET position = ${i + 1} WHERE id = ${itemId} AND set_id = ${params.id}`;
            }
            await sql`UPDATE sets SET updated_at = ${now()} WHERE id = ${params.id}`;
            return {
                ok: true,
                items: await setItems(params.id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            items: t.Array(t.Integer(), {
                maxItems: ITEMS_MAX
            })
        })
    })

    .delete("/:id/items/:item", async ({ params, user, status }) => {
        try {
            await ownedSet(params.id, user.id);
            await sql`DELETE FROM set_items WHERE id = ${params.item} AND set_id = ${params.id}`;
            await sql`UPDATE sets SET updated_at = ${now()} WHERE id = ${params.id}`;
            return {
                ok: true,
                items: await setItems(params.id)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            item: t.Numeric()
        })
    })
