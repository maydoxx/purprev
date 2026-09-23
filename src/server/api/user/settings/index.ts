import { Elysia } from "elysia";

import { changebio } from "./changebio";
import { changeemail } from "./changeemail";
import { changepassword } from "./changepassword";

export const settings = new Elysia({ prefix: "/settings" })
    .use(changebio)
    .use(changeemail)
    .use(changepassword)
