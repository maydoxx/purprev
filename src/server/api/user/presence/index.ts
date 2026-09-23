import { Elysia } from "elysia";

import { register } from "./register";

export const presence = new Elysia({ prefix: "/presence" })
    .use(register)
