import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { brickcolors } from "../../brickcolors";

const DEFAULT_COLORS = {
    head_color: 24,
    torso_color: 23,
    left_arm_color: 24,
    right_arm_color: 24,
    left_leg_color: 119,
    right_leg_color: 119
};

// how many of each you can wear at once
const WEAR_LIMITS: Record<string, number> = {
    Hat: 3,
    Face: 1,
    Shirt: 1,
    Pants: 1,
    "T-Shirt": 1
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
    SELECT catalog_items.id, catalog_items.name, catalog_items.category FROM user_items
    JOIN catalog_items ON catalog_items.id = user_items.item_id
    WHERE user_items.user_id = ${userId} AND user_items.wearing = 1
    ORDER BY catalog_items.category, catalog_items.id
`;

// TODO: colors and wear should ask rcc manager to re-render after
export const avatar = new Elysia({ prefix: "/avatar" })
    .use(session)
    .get("/", async ({ user }) => ({
        colors: await bodyColors(user.id),
        wearing: await wornItems(user.id),
        palette: brickcolors
    }), {
        auth: true
    })

    // brickcolor numbers, unknown ones get ignored
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

    // wear or take off something you own, oldest worn one gets bumped when over the limit
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
            const [item] = await sql`SELECT category, asset_id FROM catalog_items WHERE id = ${body.itemId}`;
            const limit = item ? WEAR_LIMITS[item.category] : undefined;

            if (!limit) {
                return status(400, {
                    error: "This kind of item cannot be worn"
                });
            }
            if (!item.asset_id) {
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
