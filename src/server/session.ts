import { Elysia } from "elysia";
import { sql, now } from "./db";
import { membershipOf, type Tier } from "./membership";


const TOKEN_LIFE = 60 * 60 * 24 * 7;

export type User = {
    id: number;
    username: string;
    email: string | null;
    about: string | null;
    admin: number;
    currency: number;
    tix: number;

    ongoing_action_id: number | null;
    membership: Tier;
    membership_expires: number;
    social_discord: string;
    social_twitter: string;
    social_youtube: string;
};

const USER_COLS = sql`users.id, users.username, users.email, users.about, users.admin, users.currency, users.tix, users.ongoing_action_id, users.membership, users.membership_expires, users.social_discord, users.social_twitter, users.social_youtube`;

export const claimDailyLoginRewards = async (userId: number) => {
    const day = Math.floor(now() / 86400);
    await sql`
        UPDATE users
        SET tix = LEAST(tix + 10, 2147483647), last_tix_day = ${day}
        WHERE id = ${userId} AND last_tix_day < ${day}
    `;
    await sql`
        UPDATE users
        SET currency = LEAST(currency + 5, 2147483647), last_nonebux_day = ${day}
        WHERE id = ${userId} AND last_nonebux_day < ${day}
    `;
};

const withMembership = (row: any): User | null => row ? {
    ...row,
    membership: membershipOf(row),
    membership_expires: Number(row.membership_expires)
} : null;

export const getUser = async (id: number): Promise<User | null> => {
    const [user] = await sql`SELECT ${USER_COLS} FROM users WHERE id = ${id}`;
    return withMembership(user);
};

export const session = new Elysia({ name: "session" })
    .resolve({
        as: "global"
    }, async ({ cookie }) => {

        const token = cookie.token?.value ?? cookie[".ROBLOSECURITY"]?.value;
        let user: User | null = null;

        if (typeof token === "string" && token.length === 64) {
            const [row] = await sql`
                SELECT ${USER_COLS} FROM tokens
                JOIN users ON users.id = tokens.user_id
                WHERE token = ${token} AND expires > ${now()}
            `;
            user = withMembership(row);
        }

        return {
            user,
            token: user ? (token as string) : null,

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
