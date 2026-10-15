import { Elysia } from "elysia";

import { changebio } from "./changebio";
import { changepassword } from "./changepassword";
import { changeusername } from "./changeusername";
import { deleteaccount } from "./deleteaccount";
import { socials } from "./socials";
import { theme } from "./theme";
import { profileCustomization } from "./profileCustomization";
import { privacy } from "./privacy";
import { sessions } from "./sessions";

export const settings = new Elysia({ prefix: "/settings" })
    .use(changebio)
    .use(changepassword)
    .use(changeusername)
    .use(deleteaccount)
    .use(socials)
    .use(theme)
    .use(profileCustomization)
    .use(privacy)
    .use(sessions)
