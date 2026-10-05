import { Elysia } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { siteSetting } from "../../settings";

const COOLDOWN = 60 * 60 * 12;


export const invites = new Elysia({ prefix: "/invites" })
    .use(session)
    .post("/generate", async ({ user, status }) => {
        if (!(await siteSetting("invites_enabled"))) {
            return status(403, {
                error: "Invite keys are turned off right now"
            });
        }
        const [row] = await sql`SELECT "lastInviteKeyCreated" FROM users WHERE id = ${user.id}`;
        const wait = row.lastInviteKeyCreated + COOLDOWN - now();

        if (wait > 0) {
            return status(403, {
                error: "You already made a key in the last 12 hours",
                retryIn: wait
            });
        }

        const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
        await sql`UPDATE users SET "lastInviteKeyCreated" = ${now()} WHERE id = ${user.id}`;
        await sql`INSERT INTO invites ("createdBy", "inviteKey", "createdAt") VALUES (${user.id}, ${key}, ${now()})`;

        return { key };
    }, {
        auth: true
    })
