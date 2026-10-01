import { Elysia } from "elysia";

import { asset } from "./asset";
import { game } from "./game";
import { social } from "./social";
import { marketplace } from "./marketplace";
import { persistence } from "./persistence";
import { settings } from "./settings";
import { mobile } from "./mobile";
import { thumbs } from "./thumbs";
import { corescripts } from "./corescripts";

export const engine = new Elysia()
    .use(asset)
    .use(game)
    .use(social)
    .use(marketplace)
    .use(persistence)
    .use(settings)
    .use(mobile)
    .use(thumbs)
    .use(corescripts)

    .all("/Error/*", () => "")
    .all("/error/*", () => "")
