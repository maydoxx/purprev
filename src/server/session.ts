import { Elysia } from "elysia";
import { sql, now } from "./db";

// 7 days to die
const TOKEN_LIFE = 60 * 60 * 24 * 7;

export type User = {
    id: number;
    username: string;
    email: string | null;
    about: string | null;
    admin: number;
    currency: number;
    // set when banned/warned, /not-approved
    ongoing_action_id: number | null;
};

const USER_COLS = sql`users.id, users.username, users.email, users.about, users.admin, users.currency, users.ongoing_action_id`;

export const getUser = async (id: number): Promise<User | null> => {
    const [user] = await sql`SELECT ${USER_COLS} FROM users WHERE id = ${id}`;
    return user ?? null;
};

export const session = new Elysia({ name: "session" })
    .resolve({
        as: "global"
    }, async ({ cookie }) => {
        const token = cookie.token?.value;
        let user: User | null = null;

        if (typeof token === "string" && token.length === 64) {
            const [row] = await sql`
                SELECT ${USER_COLS} FROM tokens
                JOIN users ON users.id = tokens.user_id
                WHERE token = ${token} AND expires > ${now()}
            `;
            user = row ?? null;
        }

        return {
            user,

            login: async (userId: number) => {
                const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
                const expires = now() + TOKEN_LIFE;
                await sql`INSERT INTO tokens (user_id, token, expires) VALUES (${userId}, ${token}, ${expires})`;

                for (const name of ["token", ".ROBLOSECURITY"]) {
                    cookie[name]!.set({
                        value: token,
                        path: "/",
                        httpOnly: true,
                        sameSite: "lax",
                        maxAge: TOKEN_LIFE
                    });
                }
                return token;
            },

            logout: async () => {
                if (typeof token === "string") {
                    await sql`DELETE FROM tokens WHERE token = ${token}`;
                }
                cookie.token?.remove();
                cookie[".ROBLOSECURITY"]?.remove();
            }
        };
    })

    // auth: true on a route = 401 when not logged in, and user is never null in there
    // admin: true = same but 403 when not admin
    .macro({
        auth: {
            resolve({ user, status }) {
                if (!user) {
                    return status(401, {
                        error: "not logged in"
                    });
                }
                return { user };
            }
        },
        admin: {
            resolve({ user, status }) {
                if (!user) {
                    return status(401, {
                        error: "not logged in"
                    });
                }
                if (user.admin < 1) {
                    return status(403, {
                        error: "not allowed"
                    });
                }
                return { user };
            }
        }
    });
