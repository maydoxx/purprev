import { Elysia } from "elysia";
import { sql, now, parseJson } from "./db";
import { membershipOf, type Tier } from "./membership";
import { COOKIE_SECURE, SITE_URL } from "./site";
import { auditRelevant, recordAdminAudit } from "./audit";
import { verifyApiKey, type ApiKeyScope } from "./api-keys";
import { digestToken } from "./crypto";

const TOKEN_LIFE = 60 * 60 * 24 * 7;

export const platformOf = (userAgent: string) => /android/i.test(userAgent) ? "Android"
    : /iphone|ipad|ipod/i.test(userAgent) ? "iOS"
    : /windows/i.test(userAgent) ? "Windows"
    : /cros/i.test(userAgent) ? "ChromeOS"
    : /macintosh|mac os/i.test(userAgent) ? "macOS"
    : /linux/i.test(userAgent) ? "Linux"
    : "Unknown";

export type User = {
    id: number;
    username: string;
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
    theme: "auto" | "classic" | "dark" | "oled" | "halloween" | "sakura";
    social_visibility: Record<string, boolean>;
    processing_consents: Record<string, boolean>;
    processing_objections: Record<string, boolean>;
    processing_restricted: boolean;
};

const USER_COLS = sql`users.id, users.username, users.about, users.admin, users.currency, users.tix, users.ongoing_action_id, users.membership, users.membership_expires, users.social_discord, users.social_twitter, users.social_youtube, users.theme, users.social_visibility, users.processing_consents, users.processing_objections, users.processing_restricted`;

export const claimDailyLoginRewards = async (userId: number) => {
    const day = Math.floor(now() / 86400);
    await sql`
        UPDATE users
        SET tix = LEAST(tix::bigint + 10, 2147483647), last_tix_day = ${day}
        WHERE id = ${userId} AND last_tix_day < ${day}
    `;
    await sql`
        UPDATE users
        SET currency = LEAST(currency::bigint + 5, 2147483647), last_nonebux_day = ${day}
        WHERE id = ${userId} AND last_nonebux_day < ${day}
    `;
};

const withMembership = (row: any): User | null => row ? {
    ...row,
    membership: membershipOf(row),
    membership_expires: Number(row.membership_expires),
    social_visibility: parseJson(row.social_visibility, { discord: true, twitter: true, youtube: true }),
    processing_consents: parseJson(row.processing_consents, { marketing: false, analytics: true, profiling: false, third_party_sharing: false }),
    processing_objections: parseJson(row.processing_objections, { marketing: false, analytics: false, profiling: false, third_party_sharing: false }),
    processing_restricted: Boolean(row.processing_restricted)
} : null;

const READS = ["GET", "HEAD", "OPTIONS"];
const MODERATED_ALLOWED = ["/api/user/moderation/reactivate", "/api/auth/logout"];
const PLAYING = /^\/(api\/games\/\d+\/launch|game\/(placelauncher|join|edit)\.ashx)$/i;

const SITE_HOST = (() => {
    try {
        return new URL(SITE_URL).host;
    } catch {
        return "";
    }
})();

export const getUser = async (id: number): Promise<User | null> => {
    const [user] = await sql`SELECT ${USER_COLS} FROM users WHERE id = ${id}`;
    return withMembership(user);
};

export const session = new Elysia({ name: "session" })
    .resolve({
        as: "global"
    }, async ({ cookie, request }) => {

        // Read from both for backward compat, but only set 'token' going forward
        const token = cookie.token?.value ?? cookie[".ROBLOSECURITY"]?.value;
        let user: User | null = null;
        let apiKey: { scopes: ApiKeyScope[] } | null = null;

        if (typeof token === "string" && token.length === 64) {
            const [row] = await sql`
                SELECT ${USER_COLS} FROM tokens
                JOIN users ON users.id = tokens.user_id
                WHERE token = ${await digestToken(token)} AND expires > ${now()}
            `;
            user = withMembership(row);
        }

        // Check for API key in Authorization header (for non-browser clients)
        if (!user) {
            const authHeader = request.headers.get("authorization");
            if (authHeader?.startsWith("Bearer ")) {
                const key = authHeader.slice(7);
                const verified = await verifyApiKey(key);
                if (verified) {
                    // Get user info for API key owner
                    const [row] = await sql`SELECT ${USER_COLS} FROM users WHERE id = ${verified.created_by}`;
                    user = withMembership(row);
                    apiKey = { scopes: verified.scopes };
                }
            }
        }

        // readable double submit token, the frontend echoes it back in a header
        if (typeof cookie.csrf?.value !== "string" || cookie.csrf.value.length !== 64) {
            cookie.csrf!.set({
                value: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex"),
                path: "/",
                httpOnly: false,
                secure: COOKIE_SECURE,
                sameSite: "lax"
            });
        }

        return {
            user,
            token: user ? (token as string) : null,
            apiKey,

            login: async (userId: number) => {
                const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
                const expires = now() + TOKEN_LIFE;
                const userAgent = request.headers.get("user-agent") ?? "";
                const platform = platformOf(userAgent);
                await sql`INSERT INTO tokens (user_id, token, expires, platform) VALUES (${userId}, ${await digestToken(token)}, ${expires}, ${platform})`;

                // Only set the modern 'token' cookie; .ROBLOSECURITY is deprecated
                cookie.token!.set({
                    value: token,
                    path: "/",
                    httpOnly: true,
                    secure: COOKIE_SECURE,
                    sameSite: "strict",
                    maxAge: TOKEN_LIFE
                });
                return token;
            },

            logout: async () => {
                if (typeof token === "string") {
                    await sql`DELETE FROM tokens WHERE token = ${await digestToken(token)}`;
                }
                cookie.token?.remove();
                // Also clear legacy cookie if present
                cookie[".ROBLOSECURITY"]?.remove();
            }
        };
    })

    // reject cross-site requests and require a double submit csrf token.
    // non-browser clients (game servers, studio, tooling) send no origin or
    // sec-fetch-site headers and are exempt.
    .onBeforeHandle({
        as: "global"
    }, ({ user, request, cookie, status }) => {
        if (READS.includes(request.method)) {
            return;
        }
        const site = request.headers.get("sec-fetch-site");
        const origin = request.headers.get("origin");

        // Check for API key authentication (Bearer token)
        const authHeader = request.headers.get("authorization");
        const isApiKey = authHeader?.startsWith("Bearer ") && authHeader.slice(7).startsWith("nrk_");

        if (!site && !origin && !isApiKey) {
            return;
        }

        // API key requests skip origin/CSRF checks
        if (isApiKey) {
            return;
        }

        if (site === "cross-site" || site === "same-site") {
            return status(403, {
                error: "cross-site request blocked"
            });
        }
        if (origin) {
            let host: string | null = null;
            try {
                host = new URL(origin).host;
            } catch {
                host = null;
            }
            const self = request.headers.get("host");
            if (host && host !== self && host !== SITE_HOST) {
                return status(403, {
                    error: "cross-site request blocked"
                });
            }
        }
        if (user) {
            const supplied = request.headers.get("x-csrf-token");
            const expected = cookie.csrf?.value;
            if (!supplied || !expected || supplied !== expected) {
                return status(403, {
                    error: "invalid csrf token"
                });
            }
        }
    })

    // moderated users can only read, reactivate and log out
    .onBeforeHandle({
        as: "global"
    }, ({ user, request, path, status }) => {
        if (!user?.ongoing_action_id || MODERATED_ALLOWED.includes(path)) {
            return;
        }
        if (READS.includes(request.method) && !PLAYING.test(path)) {
            return;
        }
        return status(403, {
            error: "Your account is under moderation."
        });
    })

    // record what admins do. admin-panel requests are logged even when they fail
    // (so unauthorised attempts are visible); other admins are logged for any
    // state change. secrets are stripped before anything is stored.
    .onAfterHandle({
        as: "global"
    }, async ({ user, request, path, body, set, server }) => {
        if (!auditRelevant(user, request.method, path)) {
            return;
        }
        const status = typeof set.status === "number" ? set.status : Number(set.status) || 200;
        await recordAdminAudit({ user, request, server, body, status });
    })

    .macro({
        auth: {
            resolve({ user, request, status }) {
                if (!user) {
                    return status(401, {
                        error: "not logged in"
                    });
                }
                return { user, request };
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
