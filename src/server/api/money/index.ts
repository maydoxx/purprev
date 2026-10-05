import { Elysia, t } from "elysia";
import { sql } from "../../db";
import { session } from "../../session";

export const money = new Elysia({ prefix: "/api/money" })
    .use(session)

    .post("/exchange", async ({ body, user, status }) => {
        const amount = Number(body.tix);
        if (!Number.isSafeInteger(amount) || amount < 10 || amount > 2000000000 || amount % 10 !== 0) {
            return status(400, {
                error: "Enter a Tix amount in multiples of 10"
            });
        }

        const credit = amount / 10;
        const exchanged = await sql`
            UPDATE users
            SET tix = tix - ${amount}, currency = currency + ${credit}
            WHERE id = ${user.id} AND tix >= ${amount} AND currency <= ${2147483647 - credit}
        `;

        if (!exchanged.count) {
            const [balance] = await sql`SELECT tix, currency FROM users WHERE id = ${user.id}`;
            if (Number(balance?.tix ?? 0) < amount) {
                return status(400, {
                    error: "You do not have enough Tix"
                });
            }
            if (Number(balance?.currency ?? 0) > 2147483647 - credit) {
                return status(400, {
                    error: "Your Nonebux balance is too high for this exchange"
                });
            }
            return status(400, {
                error: "The exchange could not be completed. Please try again"
            });
        }

        const [balance] = await sql`SELECT tix, currency FROM users WHERE id = ${user.id}`;
        return {
            ok: true,
            tix: Number(balance.tix),
            currency: Number(balance.currency)
        };
    }, {
        auth: true,
        body: t.Object({
            tix: t.Numeric()
        })
    });
