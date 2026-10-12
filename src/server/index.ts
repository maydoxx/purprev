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
import { notifications } from "./api/notifications";
import { money } from "./api/money";
import { trade } from "./api/trade";
import { admin } from "./api/admin";
import { servers } from "./api/admin/servers";
import { content } from "./api/admin/content";
import { engine } from "./api/engine";
import { uploads } from "./api/uploads";
import { rcc } from "./api/rcc";
import { membership } from "./api/membership";
import { studio } from "./api/studio";
import { applications } from "./api/applications";
import { publicApi } from "./api/public";
import { abuse } from "./api/site/abuse";
import { sets } from "./api/sets";
import { comments } from "./api/comments";
import { ads } from "./api/ads";
import { embed } from "./api/embed";
import { promo } from "./api/promo";
import { firstRun } from "./firstuser";
const app = new Elysia()
    .use(openapi({ documentation: { info: { title: "PurpRev API", version: "dev-1.0.0", description: "PurpRev is a frontend and backend for NoneRev. The name 'PurpRev' came from the NoneRev logo being purple."}}}))


    .onRequest(({ request }): Promise<Response> | undefined => {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/{2,}/g, "/");
        if (path !== url.pathname) {
            url.pathname = path;
            // a new Request would lose requestIP, which isInternal needs
            Object.defineProperty(request, "url", {
                value: url.href
            });
            return app.handle(request);
        }
    })

    .onError({ as: "global" }, ({ code, error, request, set, status }) => {
        const where = `${request.method} ${new URL(request.url).pathname}`;
        const message = error instanceof Error ? error.message : String(error);

        if (code === "NOT_FOUND") {
            console.warn(`${where} -> ${code}`);
            return status(404, {
                error: "not found"
            });
        }

        if (code === "VALIDATION") {
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
    .use(notifications)
    .use(money)
    .use(trade)
    .use(admin)
    .use(servers)
    .use(content)
    .use(engine)
    .use(uploads)
    .use(rcc)
    .use(membership)
    .use(studio)
    .use(applications)
    .use(abuse)
    .use(sets)
    .use(comments)
    .use(ads)
    .use(embed)
    .use(promo)
    .use(process.env.PUBLIC_API === "1" ? publicApi : new Elysia())
    .get("/", () => new Response([
        " /\\_/\\",
        "( o.o )  you found the backend",
        " > ^ <   the site lives on the other port, shoo :3",
        ""
    ].join("\n"), {
        headers: {
            "Content-Type": "text/plain; charset=utf-8"
        }
    }))
    .get("/api", () => "meow :3 nothing to see here, the real stuff is under /api/<thing>")
    .listen({
        hostname: process.env.API_HOST || "0.0.0.0",
        port: Number(process.env.API_PORT ?? 3000)
    });


for (const addr of (process.env.ALSO_LISTEN ?? "").split(",").filter(Boolean)) {
    const [host, port] = addr.includes(":") ? addr.split(":") : ["0.0.0.0", addr];
    Bun.serve({
        hostname: host,
        port: Number(port),
        fetch: app.fetch
    });
}

firstRun().catch(err => console.error("first run setup failed:", err));
