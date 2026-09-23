import { Elysia, t } from "elysia";
import { stub } from "../../stub";

export const changeemail = new Elysia()
    .post("/changeemail", stub, {
        body: t.Object({
            newEmail: t.String({ format: "email" })
        })
    })
