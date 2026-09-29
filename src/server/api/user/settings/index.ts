import { Elysia } from "elysia";

import { changebio } from "./changebio";
import { changeemail } from "./changeemail";
import { changepassword } from "./changepassword";
import { changeusername } from "./changeusername";

export const settings = new Elysia({ prefix: "/settings" })
    .use(changebio)
    .use(changeemail)
    .use(changepassword)
    .use(changeusername)
