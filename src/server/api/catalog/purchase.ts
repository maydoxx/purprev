import { Elysia, t } from "elysia";
import { session } from "../../session";
import { PurchaseError, buyItem } from "../../purchase";

export const purchase = new Elysia()
    .use(session)
    .post("/purchase", async ({ body, user, status }) => {
        try {
            const balance = await buyItem(user, body.itemId, body.currency ?? "nonebux");

            return {
                ok: true,
                ...balance
            };
        } catch (err) {
            if (err instanceof PurchaseError) {
                return status(400, {
                    error: err.message
                });
            }
            throw err;
        }
    }, {
        auth: true,
        body: t.Object({
            itemId: t.Numeric(),
            currency: t.Optional(t.Union([
                t.Literal("nonebux"),
                t.Literal("tix")
            ]))
        })
    })
