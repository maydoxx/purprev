import { Elysia } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";

// account_deletion never comes back
const TERMINATED = 6;

export const moderation = new Elysia({ prefix: "/moderation" })
    .use(session)

    // the action behind /not-approved, {} when the account is fine
    .get("/", async ({ user }) => {
        if (!user.ongoing_action_id) {
            return {};
        }
        const [row] = await sql`
            SELECT moderation_actions.id, moderation_actions.action, moderation_actions.reason, moderation_actions.expiresAt,
                users.username AS moderator
            FROM moderation_actions
            LEFT JOIN users ON users.id = moderation_actions.moderatedBy
            WHERE moderation_actions.id = ${user.ongoing_action_id}
        `;
        return row ?? {};
    }, {
        auth: true
    })

    // warnings expire at 0 so they clear right away, bans once their time is up
    .post("/reactivate", async ({ user, status }) => {
        const [row] = await sql`SELECT action, expiresAt FROM moderation_actions WHERE id = ${user.ongoing_action_id ?? 0}`;
        if (!row || Number(row.action) === TERMINATED || Number(row.expiresAt) > now()) {
            return status(400, {
                error: "Your account cannot be reactivated yet."
            });
        }
        await sql`DELETE FROM moderation_actions WHERE user_id = ${user.id}`;
        await sql`UPDATE users SET ongoing_action_id = NULL WHERE id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true
    })
