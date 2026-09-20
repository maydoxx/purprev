console.log("Hello via Bun!");

import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { openapi } from '@elysia/openapi'

import { setup } from "./api/setup";
const app = new Elysia()
    .use(openapi({ documentation: { info: { title: "", version: "dev-1.0.0", description: "NoneAPI documentation"}}}))
    .use(setup)
    .get("/", () => "meow :3")
    .listen(3000);