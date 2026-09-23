console.log("Hello via Bun!");

import { Elysia } from "elysia";
import { openapi } from '@elysia/openapi'

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