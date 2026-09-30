import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { brickcolors } from "../../brickcolors";
import { rcc } from "../../rcc";
import { mediaUrl, withThumbnail } from "../../paths";

const DEFAULT_COLORS = {
    head_color: 24,
    torso_color: 23,
    left_arm_color: 24,
    right_arm_color: 24,
    left_leg_color: 119,
    right_leg_color: 119
};


const WEAR_LIMITS: Record<string, number> = {
    Hat: 3,
    Face: 1,
    Shirt: 1,
    Pants: 1,
    "T-Shirt": 1,
    Package: 1
};

const bodyColors = async (userId: number) => {
    const [row] = await sql`SELECT * FROM user_avatar WHERE user_id = ${userId}`;
    const colors = { ...DEFAULT_COLORS };
    if (row) {
        for (const k of Object.keys(colors) as (keyof typeof colors)[]) {
            colors[k] = row[k];
        }
    }
    return colors;
};

const wornItems = (userId: number) => sql`
    SELECT catalog_items.id, catalog_items.name, catalog_items.category, catalog_items.thumbnail FROM user_items
    JOIN catalog_items ON catalog_items.id = user_items.item_id
    WHERE user_items.user_id = ${userId} AND user_items.wearing = 1
    ORDER BY catalog_items.category, catalog_items.id
`;

export const avatar = new Elysia({ prefix: "/avatar" })
    .use(session)
    .get("/", async ({ user }) => ({
        colors: await bodyColors(user.id),
        avatar_type: (await sql`SELECT avatar_type FROM user_avatar WHERE user_id = ${user.id}`)[0]?.avatar_type ?? "R6",
        wearing: await Promise.all((await wornItems(user.id)).map(withThumbnail)),

        owned: await Promise.all((await sql`
            SELECT catalog_items.id, catalog_items.name, catalog_items.category, catalog_items.thumbnail, catalog_items.asset_id, catalog_items.package_parts, user_items.wearing
            FROM user_items JOIN catalog_items ON catalog_items.id = user_items.item_id
            WHERE user_items.user_id = ${user.id}
            ORDER BY user_items.purchased_at DESC, catalog_items.id DESC
        `).map(withThumbnail)),
        palette: brickcolors
    }), {
        auth: true
    })


    .post("/colors", async ({ body, user, status }) => {
        const colors = await bodyColors(user.id);
        let changed = false;

        for (const k of Object.keys(colors) as (keyof typeof colors)[]) {
            const v = body[k];
            if (v !== undefined && v in brickcolors) {
                colors[k] = v;
                changed = true;
            }
        }

        if (!changed) {
            return status(400, {
                error: "no colors given"
            });
        }

        await sql`
            REPLACE INTO user_avatar (user_id, head_color, torso_color, left_arm_color, right_arm_color, left_leg_color, right_leg_color, updated_at)
            VALUES (${user.id}, ${colors.head_color}, ${colors.torso_color}, ${colors.left_arm_color}, ${colors.right_arm_color}, ${colors.left_leg_color}, ${colors.right_leg_color}, ${now()})
        `;

        rcc.render.avatar(user.id);
        return {
            ok: true,
            colors
        };
    }, {
        auth: true,
        body: t.Object({
            head_color: t.Optional(t.Numeric()),
            torso_color: t.Optional(t.Numeric()),
            left_arm_color: t.Optional(t.Numeric()),
            right_arm_color: t.Optional(t.Numeric()),
            left_leg_color: t.Optional(t.Numeric()),
            right_leg_color: t.Optional(t.Numeric())
        })
    })


    .post("/wear", async ({ body, user, status }) => {
        const [owned] = await sql`SELECT item_id FROM user_items WHERE user_id = ${user.id} AND item_id = ${body.itemId}`;
        if (!owned) {
            return status(400, {
                error: "You do not own this item"
            });
        }

        if (!body.wear) {
            await sql`UPDATE user_items SET wearing = 0 WHERE user_id = ${user.id} AND item_id = ${body.itemId}`;
        } else {
            const [item] = await sql`SELECT category, asset_id, package_parts FROM catalog_items WHERE id = ${body.itemId}`;
            const limit = item ? WEAR_LIMITS[item.category] : undefined;

            if (!limit) {
                return status(400, {
                    error: "This kind of item cannot be worn"
                });
            }
            if (!item.asset_id && !item.package_parts) {
                return status(400, {
                    error: "This item has no asset attached yet"
                });
            }

            const same = await sql`
                SELECT user_items.item_id FROM user_items
                JOIN catalog_items ON catalog_items.id = user_items.item_id
                WHERE user_items.user_id = ${user.id} AND user_items.wearing = 1
                AND catalog_items.category = ${item.category} AND user_items.item_id != ${body.itemId}
                ORDER BY user_items.purchased_at ASC
            `;
            for (const drop of same.slice(0, Math.max(0, same.length - limit + 1))) {
                await sql`UPDATE user_items SET wearing = 0 WHERE user_id = ${user.id} AND item_id = ${drop.item_id}`;
            }

            await sql`UPDATE user_items SET wearing = 1 WHERE user_id = ${user.id} AND item_id = ${body.itemId}`;
        }

        rcc.render.avatar(user.id);
        return {
            ok: true,
            wearing: await wornItems(user.id)
        };
    }, {
        auth: true,
        body: t.Object({
            itemId: t.Numeric(),
            wear: t.Boolean()
        })
    })


    .post("/type", async ({ body, user }) => {
        const colors = await bodyColors(user.id);
        await sql`
            INSERT INTO user_avatar (user_id, head_color, torso_color, left_arm_color, right_arm_color, left_leg_color, right_leg_color, avatar_type, updated_at)
            VALUES (${user.id}, ${colors.head_color}, ${colors.torso_color}, ${colors.left_arm_color}, ${colors.right_arm_color}, ${colors.left_leg_color}, ${colors.right_leg_color}, ${body.type}, ${now()})
            ON DUPLICATE KEY UPDATE avatar_type = ${body.type}, updated_at = ${now()}
        `;
        return {
            ok: await rcc.render.avatar(user.id),
            avatar_type: body.type
        };
    }, {
        auth: true,
        body: t.Object({
            type: t.Union([
                t.Literal("R6"),
                t.Literal("R15")
            ])
        })
    })

    .post("/render", async ({ user }) => ({
        ok: await rcc.render.avatar(user.id),
        full: await mediaUrl("avatars", user.id)
    }), {
        auth: true
    })

    .get("/outfits", async ({ user }) => {
        const rows = await sql`SELECT id, name, created_at FROM avatar_outfits WHERE user_id = ${user.id} ORDER BY created_at DESC, id DESC`;
        return rows;
    }, { auth: true })

    .post("/outfits", async ({ body, user, status }) => {
        const name = body.name.trim();
        if (!name) return status(400, { error: "Give the outfit a name" });
        const [count] = await sql`SELECT COUNT(*) AS n FROM avatar_outfits WHERE user_id = ${user.id}`;
        if (Number(count.n) >= 50) return status(400, { error: "You can save up to 50 outfits" });
        const colors = await bodyColors(user.id);
        const worn = await sql`SELECT item_id FROM user_items WHERE user_id = ${user.id} AND wearing = 1`;
        await sql`INSERT INTO avatar_outfits (user_id, name, colors, items, created_at) VALUES (${user.id}, ${name}, ${JSON.stringify(colors)}, ${JSON.stringify(worn.map((r: any) => Number(r.item_id)))}, ${now()})`;
        return { ok: true };
    }, { auth: true, body: t.Object({ name: t.String({ maxLength: 60 }) }) })

    .post("/outfits/:id/wear", async ({ params, user, status }) => {
        const [outfit] = await sql`SELECT colors, items FROM avatar_outfits WHERE id = ${params.id} AND user_id = ${user.id}`;
        if (!outfit) return status(404, { error: "Outfit not found" });
        const colors = JSON.parse(outfit.colors);
        const items: number[] = JSON.parse(outfit.items);
        await sql.begin(async tx => {
            await tx`UPDATE user_items SET wearing = 0 WHERE user_id = ${user.id}`;
            for (const itemId of items) {
                await tx`UPDATE user_items SET wearing = 1 WHERE user_id = ${user.id} AND item_id = ${itemId}`;
            }
            await tx`INSERT INTO user_avatar (user_id, head_color, torso_color, left_arm_color, right_arm_color, left_leg_color, right_leg_color, updated_at) VALUES (${user.id}, ${colors.head_color}, ${colors.torso_color}, ${colors.left_arm_color}, ${colors.right_arm_color}, ${colors.left_leg_color}, ${colors.right_leg_color}, ${now()}) ON DUPLICATE KEY UPDATE head_color = VALUES(head_color), torso_color = VALUES(torso_color), left_arm_color = VALUES(left_arm_color), right_arm_color = VALUES(right_arm_color), left_leg_color = VALUES(left_leg_color), right_leg_color = VALUES(right_leg_color), updated_at = VALUES(updated_at)`;
        });
        rcc.render.avatar(user.id);
        return { ok: true };
    }, { auth: true, params: t.Object({ id: t.Numeric() }) })

    .delete("/outfits/:id", async ({ params, user }) => {
        await sql`DELETE FROM avatar_outfits WHERE id = ${params.id} AND user_id = ${user.id}`;
        return { ok: true };
    }, { auth: true, params: t.Object({ id: t.Numeric() }) })
