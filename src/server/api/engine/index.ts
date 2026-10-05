import { Elysia } from "elysia";

import { asset } from "./asset";
import { game } from "./game";
import { social } from "./social";
import { people } from "./people";
import { marketplace } from "./marketplace";
import { persistence } from "./persistence";
import { settings } from "./settings";
import { mobile } from "./mobile";
import { thumbs } from "./thumbs";

export const engine = new Elysia()
    .use(asset)
    .use(game)
    .use(social)
    .use(people)
    .use(marketplace)
    .use(persistence)
    .use(settings)
    .use(mobile)
    .use(thumbs)

    .all("/Error/*", () => "")
    .all("/error/*", () => "")

    .post("/v1.0/MultiIncrement", () => ({
        success: true
    }))

    .post("/client-status/set", () => "")

    .post("/adimpression/validate-request", () => ({
        success: false,
        errorMessage: "no video ads here"
    }))

    .post("/adimpression/record-impression", () => "")
