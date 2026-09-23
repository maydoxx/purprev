import { Elysia, t } from "elysia";
import { stub } from "../stub";

const userId = t.Object({
    userId: t.Numeric()
});

const routes = (prefix: string) => new Elysia({ prefix })
    // TODO: 403/403/404/409 from roblox has to be answered as 404, (409 will make it retry forever).
    .get("/", stub, {
        query: t.Object({
            id: t.Numeric()
        })
    })

    // body colors xml for Player.CharacterAppearance
    .get("/BodyColors.ashx", stub, {
        query: userId
    })

    // asset urls separated by ";", the first one is the BodyColors.ashx url
    // ?assetId= gives just the url of that one asset
    .get("/CharacterFetch.ashx", stub, {
        query: t.Object({
            userId: t.Optional(t.Numeric()),
            assetId: t.Optional(t.Numeric())
        })
    })

export const asset = new Elysia()
    .use(routes("/asset"))
    .use(routes("/Asset"))
