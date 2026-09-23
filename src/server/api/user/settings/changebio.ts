import { Elysia, t } from "elysia";
import { stub } from "../../stub";

export const changebio = new Elysia()
    .post("/changebio", stub, {
        body: t.Object({
            newBio: t.String()
        })
    })
