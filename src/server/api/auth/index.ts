import { Elysia } from "elysia";
import { session, getUser, claimDailyLoginRewards } from "../../session";

import { login } from "./login";
import { logout } from "./logout";
import { register } from "./register";
import { passwordReset } from "./passwordreset";

export const auth = new Elysia({ prefix: "/api/auth" })
    .use(session)
    .use(login)
    .use(logout)
    .use(register)
    .use(passwordReset)


    .get("/me", async ({ user }) => {
        await claimDailyLoginRewards(user.id);
        return getUser(user.id);
    }, {
        auth: true
    })


    .get("/ticket", ({ cookie }) => ({
        token: cookie.token?.value ?? null
    }), {
        auth: true
    })
