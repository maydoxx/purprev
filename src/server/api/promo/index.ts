import { Elysia, t } from "elysia";
import { session, getUser } from "../../session";
import { PromoError, redeemPromo } from "../../promo";

const MISS_WINDOW = 10 * 60 * 1000;
const MAX_MISSES = 10;

// word codes are easy to guess
const misses = new Map<number, number[]>();

const recentMisses = (userId: number) => {
    const since = Date.now() - MISS_WINDOW;
    const recent = (misses.get(userId) ?? []).filter(at => at > since);
    misses.set(userId, recent);
    return recent;
};

export const promo = new Elysia({ prefix: "/api/promocodes" })
    .use(session)

    .post("/redeem", async ({ body, user, status }) => {
        const recent = recentMisses(user.id);
        if (recent.length >= MAX_MISSES) {
            return status(429, {
                error: "Too many tries. Wait a few minutes and try again."
            });
        }
        try {
            const result = await redeemPromo(user.id, body.code);
            return {
                ok: true,
                ...result,
                user: await getUser(user.id)
            };
        } catch (err) {
            if (err instanceof PromoError) {
                recent.push(Date.now());
                return status(400, {
                    error: err.message
                });
            }
            throw err;
        }
    }, {
        auth: true,
        body: t.Object({
            code: t.String({
                maxLength: 60
            })
        })
    });
