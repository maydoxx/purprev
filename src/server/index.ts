console.log("Hello via Bun!");

import { Elysia } from "elysia";
import { openapi } from '@elysia/openapi'

import { session } from "./session";
import { setup } from "./api/setup";
import { auth } from "./api/auth";
import { user } from "./api/user";
import { site } from "./api/site";
import { catalog } from "./api/catalog";
import { games } from "./api/games";
import { develop } from "./api/develop";
import { forum } from "./api/forum";
import { groups } from "./api/groups";
import { messages } from "./api/messages";
import { trade } from "./api/trade";
import { admin } from "./api/admin";
import { engine } from "./api/engine";
const app = new Elysia()
    .use(openapi({ documentation: { info: { title: "PurpRev API", version: "dev-1.0.0", description: "PurpRev is a frontend and backend for NoneRev. The name 'PurpRev' came from the NoneRev logo being purple."}}}))

    // every error goes to the console, validation and 404 keep elysias answer
    .onError({ as: "global" }, ({ code, error, request, set }) => {
        const where = `${request.method} ${new URL(request.url).pathname}`;
        const message = error instanceof Error ? error.message : String(error);

        if (code === "VALIDATION" || code === "NOT_FOUND") {
            console.warn(`${where} -> ${code}: ${message.split("\n")[0]}`);
            return;
        }

        console.error(`${where} -> ${code}:`, error);
        set.status = 500;
        return {
            error: message
        };
    })

    .use(session)
    .use(setup)
    .use(auth)
    .use(user)
    .use(site)
    .use(catalog)
    .use(games)
    .use(develop)
    .use(forum)
    .use(groups)
    .use(messages)
    .use(trade)
    .use(admin)
    .use(engine)
    .get("/", () => "meow :3")
    .listen(3000);