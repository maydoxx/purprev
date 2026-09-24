import { Elysia, t } from "elysia";
import { stub } from "../stub";

import { getProfilePicture } from "./getProfilePicture";
import { invites } from "./invites";
import { presence } from "./presence";
import { settings } from "./settings";
import { friends } from "./friends";
import { avatar } from "./avatar";
import { profile } from "./profile";

export const user = new Elysia({ prefix: "/api/user" })
    .use(getProfilePicture)
    .use(invites)
    .use(presence)
    .use(settings)
    .use(friends)
    .use(avatar)
    .use(profile)

    // /my/inventory
    .get("/inventory", stub, {
        query: t.Object({
            category: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })
