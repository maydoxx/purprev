import { Elysia, t } from "elysia";
import { stub } from "../stub";

import { getProfilePicture } from "./getProfilePicture";
import { invites } from "./invites";
import { presence } from "./presence";
import { settings } from "./settings";
import { friends } from "./friends";
import { avatar } from "./avatar";

export const user = new Elysia({ prefix: "/api/user" })
    .use(getProfilePicture)
    .use(invites)
    .use(presence)
    .use(settings)
    .use(friends)
    .use(avatar)

    // /my/inventory
    .get("/inventory", stub, {
        query: t.Object({
            category: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    // the /user?id= page: bio, friends, badges, games, online status
    .get("/profile/:id", stub, {
        params: t.Object({
            id: t.Numeric()
        })
    })
