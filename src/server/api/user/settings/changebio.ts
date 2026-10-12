import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql, now } from "../../../db";

export const changebio = new Elysia()
    .use(session)
    .post("/changebio", async ({ body, user }) => {
        await sql`UPDATE users SET about = ${body.newBio.trim()} WHERE id = ${user.id}`;
        // a new bio replaces the moderated one
        await sql`UPDATE content_deletions SET restored_at = ${now()} WHERE kind = 'bio' AND target_id = ${user.id} AND restored_at = 0`;
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            newBio: t.String({ maxLength: 1000 })
        })
    })
