import { Elysia, t } from "elysia";
import { session, getUser } from "../../session";
import { sql, now } from "../../db";
import { TIERS, PRICES, membershipOf } from "../../membership";

class BuyError extends Error {}

const PERIODS = {
    monthly: 30,
    annual: 365
};

export const membership = new Elysia({ prefix: "/api/membership" })
    .use(session)

    .get("/", ({ user }) => ({
        tiers: (Object.keys(PRICES) as (keyof typeof PRICES)[]).map(id => ({
            id,
            label: TIERS[id].label,
            stipend: TIERS[id].stipend,
            monthly: PRICES[id].monthly,
            annual: PRICES[id].annual
        })),
        me: user ? {
            membership: user.membership,
            expires: user.membership_expires,
            balance: user.currency
        } : null
    }))

    // paid in nonebux, same tier extends, a different tier starts over from today
    .post("/buy", async ({ body, user, status }) => {
        const tier = body.tier;
        const days = PERIODS[body.period];
        const price = PRICES[tier][body.period];

        try {
            await sql.begin(async tx => {
                const [me] = await tx`SELECT currency, membership, membership_expires FROM users WHERE id = ${user.id} FOR UPDATE`;
                const current = membershipOf(me);
                if (current === tier && Number(me.membership_expires) === 0) {
                    throw new BuyError("You already have that club and it never expires.");
                }
                if (Number(me.currency) < price) {
                    throw new BuyError("You do not have enough Nonebux.");
                }
                const from = current === tier ? Math.max(now(), Number(me.membership_expires)) : now();
                await tx`UPDATE users SET currency = currency - ${price}, membership = ${tier}, membership_expires = ${from + days * 86400} WHERE id = ${user.id}`;
            });
        } catch (err) {
            if (err instanceof BuyError) {
                return status(400, {
                    error: err.message
                });
            }
            throw err;
        }

        return {
            ok: true,
            user: await getUser(user.id)
        };
    }, {
        auth: true,
        body: t.Object({
            tier: t.Union([
                t.Literal("BC"),
                t.Literal("TBC"),
                t.Literal("OBC")
            ]),
            period: t.Union([
                t.Literal("monthly"),
                t.Literal("annual")
            ])
        })
    })
