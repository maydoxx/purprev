import { Elysia, t } from "elysia";
import { session, getUser } from "../../session";
import { sql, now } from "../../db";
import { rcc } from "../../rcc";
import { siteSetting } from "../../settings";
import { claimInvite, logInvite } from "../../invites";


export const register = new Elysia()
    .use(session)
    .post("/register", async ({ body, login, status, request, server }) => {
        const username = body.username.trim();
        const inviteKey = body.invitekey.trim();

        if (!(await siteSetting("registration_enabled"))) {
            return status(403, {
                error: "Registration is closed right now"
            });
        }

        if (body.password !== body.confirmpassword) {
            return status(400, {
                error: "Passwords do not match"
            });
        }
        if (body.password.length < 8) {
            return status(400, {
                error: "Password must be at least 8 characters"
            });
        }
        if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
            return status(400, {
                error: "Username can only have letters and numbers"
            });
        }

        const [taken] = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (taken) {
            return status(400, {
                error: "Username is already taken"
            });
        }


        const invite = await claimInvite(inviteKey);
        if (!invite) {
            return status(400, {
                error: "Invalid invite key"
            });
        }

        const hash = await Bun.password.hash(body.password, "bcrypt");
        const created = await sql`INSERT INTO users (username, password, created_at) VALUES (${username}, ${hash}, ${now()})`;

        const id = Number(created.lastInsertRowid);
        await logInvite(invite, id, request, server);
        rcc.render.avatar(id);
        await login(id);
        return {
            ok: true,
            user: await getUser(id)
        };
    }, {
        body: t.Object({
            username: t.String({ maxLength: 32 }),
            password: t.String(),
            confirmpassword: t.String(),
            invitekey: t.String()
        })
    })
