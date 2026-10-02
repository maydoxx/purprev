import { Elysia } from "elysia";

import { getProfilePicture } from "./getProfilePicture";
import { invites } from "./invites";
import { presence } from "./presence";
import { settings } from "./settings";
import { friends } from "./friends";
import { avatar } from "./avatar";
import { profile } from "./profile";
import { inventory } from "./inventory";
import { moderation } from "./moderation";
import { favorites } from "./favorites";
import { chat } from "./chat";

export const user = new Elysia({ prefix: "/api/user" })
    .use(getProfilePicture)
    .use(invites)
    .use(presence)
    .use(settings)
    .use(friends)
    .use(avatar)
    .use(profile)
    .use(inventory)
    .use(moderation)
    .use(favorites)
    .use(chat)
