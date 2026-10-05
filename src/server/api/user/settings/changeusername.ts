import { Elysia, t } from "elysia";
import { session, getUser } from "../../../session";
import { sql, now } from "../../../db";
import { clientIp } from "../../../invites";

export const USERNAME_PRICE = 1000;

export const changeusername = new Elysia()
    .use(session)
    .post("/changeusername", async ({ body, user, request, server, status }) => {
        const username = body.newUsername.trim();

        if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
            return status(400, {
                error: "Username can only have letters and numbers"
            });
        }
        if (username.toLowerCase() === user.username.toLowerCase()) {
            return status(400, {
                error: "That is already your username"
            });
        }

        const [row] = await sql`SELECT password FROM users WHERE id = ${user.id}`;
        if (!(await Bun.password.verify(body.password, row.password))) {
            return status(401, {
                error: "Password is wrong"
            });
        }

        if (user.currency < USERNAME_PRICE) {
            return status(403, {
                error: `You need ${USERNAME_PRICE.toLocaleString("en-US")} Nonebux to change your username`
            });
        }

        const [taken] = await sql`SELECT id FROM users WHERE username = ${username}`;
        const [used] = await sql`SELECT id FROM username_history WHERE old_username = ${username} AND user_id != ${user.id}`;
        if (taken || used) {
            return status(400, {
                error: "Username is already taken"
            });
        }

        const paid = await sql`UPDATE users SET username = ${username}, currency = currency - ${USERNAME_PRICE} WHERE id = ${user.id} AND currency >= ${USERNAME_PRICE}`;
        if (!paid.count) {
            return status(403, {
                error: `You need ${USERNAME_PRICE.toLocaleString("en-US")} Nonebux to change your username`
            });
        }
        await sql`INSERT INTO username_history (user_id, old_username, new_username, changed_at, ip) VALUES (${user.id}, ${user.username}, ${username}, ${now()}, ${clientIp(request, server)})`;

        return {
            ok: true,
            user: await getUser(user.id)
        };
    }, {
        auth: true,
        body: t.Object({
            newUsername: t.String({ maxLength: 32 }),
            password: t.String()
        })
    })
