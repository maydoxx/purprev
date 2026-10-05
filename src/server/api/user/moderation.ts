import { Elysia } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";


const TERMINATED = 6;

export const moderation = new Elysia({ prefix: "/moderation" })
    .use(session)


    .get("/", async ({ user }) => {
        if (!user.ongoing_action_id) {
            return {};
        }
        const [row] = await sql`
            SELECT moderation_actions.id, moderation_actions.action, moderation_actions.reason, moderation_actions."expiresAt",
                moderation_actions.created_at AS "createdAt", users.username AS moderator
            FROM moderation_actions
            LEFT JOIN users ON users.id = moderation_actions."moderatedBy"
            WHERE moderation_actions.id = ${user.ongoing_action_id}
        `;
        if (!row) {
            return {};
        }
        return {
            ...row,
            offenses: await sql`SELECT label, body FROM moderation_offenses WHERE action_id = ${row.id} ORDER BY id`
        };
    }, {
        auth: true
    })


    .post("/reactivate", async ({ user, status }) => {
        const [row] = await sql`SELECT action, "expiresAt" FROM moderation_actions WHERE id = ${user.ongoing_action_id ?? 0}`;
        if (!row || Number(row.action) === TERMINATED || Number(row.expiresAt) > now()) {
            return status(400, {
                error: "Your account cannot be reactivated yet."
            });
        }
        await sql`DELETE FROM moderation_offenses WHERE action_id IN (SELECT id FROM moderation_actions WHERE user_id = ${user.id})`;
        await sql`DELETE FROM moderation_actions WHERE user_id = ${user.id}`;
        await sql`UPDATE users SET ongoing_action_id = NULL WHERE id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true
    })
