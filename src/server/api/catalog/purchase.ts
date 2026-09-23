import { Elysia, t } from "elysia";
import { stub } from "../stub";

// TODO: limiteds (stock + serials) go here too
export const purchase = new Elysia()
    .post("/purchase", stub, {
        body: t.Object({
            itemId: t.Numeric()
        })
    })
