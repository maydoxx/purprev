import { Elysia } from "elysia";
import { session } from "../../session";

import { login } from "./login";
import { logout } from "./logout";
import { register } from "./register";

export const auth = new Elysia({ prefix: "/api/auth" })
    .use(session)
    .use(login)
    .use(logout)
    .use(register)


    .get("/me", ({ user }) => user, {
        auth: true
    })


    .get("/ticket", ({ cookie }) => ({
        token: cookie.token?.value ?? null
    }), {
        auth: true
    })
