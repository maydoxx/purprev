import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

const sections = ["about", "wearing", "friends", "collections", "groups", "favorites", "siteBadges", "playerBadges", "statistics"] as const;
const colors = ["#7b2cbf", "#1677d2", "#008f72", "#d24b32", "#c23d83", "#b07800", "#34495e", "#202020"] as const;

export const profileCustomization = new Elysia()
    .use(session)
    .post("/profile-customization", async ({ body, user, status }) => {
        const order = body.sections;
        if (new Set(order).size !== sections.length || !sections.every(section => order.includes(section))) {
            return status(400, { error: "Choose each profile section exactly once." });
        }
        if (!colors.includes(body.accent as typeof colors[number])) {
            return status(400, { error: "Choose an accent color from the available palette." });
        }
        await sql`UPDATE users SET profile_accent = ${body.accent}, profile_sections = ${order.join(",")} WHERE id = ${user.id}`;
        return { ok: true, accent: body.accent, sections: order };
    }, {
        auth: true,
        body: t.Object({
            accent: t.String({ maxLength: 7 }),
            sections: t.Array(t.String(), { minItems: sections.length, maxItems: sections.length })
        })
    });
