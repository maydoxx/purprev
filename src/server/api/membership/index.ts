import { Elysia, t } from "elysia";
import { session, getUser } from "../../session";
import { sql, now } from "../../db";
import { TIERS, PRICES, LIMITS, SIGNING_BONUS, FREE_STIPEND, membershipOf } from "../../membership";

class BuyError extends Error {}

const PERIODS = {
    monthly: 30,
    annual: 365
};

const cleanCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const membership = new Elysia({ prefix: "/api/membership" })
    .use(session)

    .get("/", ({ user }) => ({
        free: {
            stipend: FREE_STIPEND,
            ...LIMITS.None
        },
        signingBonus: SIGNING_BONUS,
        tiers: (Object.keys(PRICES) as (keyof typeof PRICES)[]).map(id => ({
            id,
            label: TIERS[id].label,
            stipend: TIERS[id].stipend,
            monthly: PRICES[id].monthly,
            annual: PRICES[id].annual,
            ...LIMITS[id]
        })),
        me: user ? {
            membership: user.membership,
            expires: user.membership_expires,
            balance: user.currency
        } : null
    }))

    .post("/buy", async ({ body, user, status }) => {
        const tier = body.tier;
        const days = PERIODS[body.period];
        const price = PRICES[tier][body.period];

        try {
            await sql.begin(async tx => {
                const [me] = await tx`SELECT currency, membership, membership_expires, signing_bonus FROM users WHERE id = ${user.id} FOR UPDATE`;
                const current = membershipOf(me);
                if (current === tier && Number(me.membership_expires) === 0) {
                    throw new BuyError("You already have that club and it never expires.");
                }
                if (Number(me.currency) < price) {
                    throw new BuyError("You do not have enough Nonebux.");
                }
                const from = current === tier ? Math.max(now(), Number(me.membership_expires)) : now();
                const bonus = Number(me.signing_bonus) ? 0 : SIGNING_BONUS;
                await tx`
                    UPDATE users
                    SET currency = currency - ${price} + ${bonus}, membership = ${tier}, membership_expires = ${from + days * 86400}, signing_bonus = 1
                    WHERE id = ${user.id}
                `;
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

    .post("/redeem", async ({ body, user, status }) => {
        const code = cleanCode(body.code);
        if (code.length !== 16) {
            return status(400, {
                error: "Game card codes are 16 letters and numbers."
            });
        }
        const pretty = code.match(/.{4}/g)!.join("-");
        const claimed = await sql`
            UPDATE game_cards
            SET redeemed_by = ${user.id}, redeemed_at = ${now()}
            WHERE code = ${pretty} AND redeemed_by = 0
        `;
        if (!claimed.affectedRows) {
            return status(400, {
                error: "That code is not valid or has already been redeemed."
            });
        }
        const [card] = await sql`SELECT amount FROM game_cards WHERE code = ${pretty}`;
        const amount = Number(card.amount);
        await sql`UPDATE users SET currency = currency + ${amount} WHERE id = ${user.id}`;
        return {
            ok: true,
            amount,
            user: await getUser(user.id)
        };
    }, {
        auth: true,
        body: t.Object({
            code: t.String({
                maxLength: 40
            })
        })
    })
