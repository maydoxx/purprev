import { Elysia } from "elysia";
import { stub } from "../stub";

import { search } from "./search";
import { feed } from "./feed";
import { blog } from "./blog";

export const site = new Elysia({ prefix: "/api/site" })
    .use(search)
    .use(feed)
    .use(blog)

    // only the active ones
    .get("/banners", stub)

    // downloads.json
    .get("/downloads", stub)
