import { Elysia, t } from "elysia";
import { stub } from "../stub";

// username is letters and numbers only
// TODO: check username is free, check invite key, delete key after
export const register = new Elysia()
    .post("/register", stub, {
        body: t.Object({
            username: t.String({ maxLength: 32 }),
            password: t.String(),
            confirmpassword: t.String(),
            invitekey: t.String()
        })
    })
