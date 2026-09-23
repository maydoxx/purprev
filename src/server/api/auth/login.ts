import { Elysia, t } from "elysia";
import { stub } from "../stub";

// TODO: check password, make session, set cookie
export const login = new Elysia()
    .post("/login", stub, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
