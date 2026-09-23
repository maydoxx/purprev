import { Elysia } from "elysia";
import { stub } from "../stub";

import { login } from "./login";
import { logout } from "./logout";
import { register } from "./register";

export const auth = new Elysia({ prefix: "/api/auth" })
    .use(login)
    .use(logout)
    .use(register)

    // /myAuthTicket gives the token for -t argument
    .get("/ticket", stub)
