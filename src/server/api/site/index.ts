import { Elysia } from "elysia";
import { sql, now } from "../../db";
import { siteSettings } from "../../settings";
import { TURNSTILE_SITE_KEY, turnstileOn } from "../../turnstile";

import { search } from "./search";
import { feed } from "./feed";
import { blog } from "./blog";

const DOWNLOADS = [
    {
        title: "None 2016 Client",
        description: "Re-experience old roblox games here on None!",
        fileUrl: "/api/setup/download"
    },
    {
        title: "None 2016 Client (Linux, native)",
        description: "Native Linux build. Extract it into a folder, then run ./NoneRevPlayer --register once so the Play button opens it.",
        fileUrl: "/api/setup/download?os=linux-native"
    },
    {
        title: "None 2016 Client (Android)",
        description: "The app for your phone. Allow installs from unknown sources, then open the apk.",
        fileUrl: "/api/setup/download?os=android"
    },
    {
        title: "None 2016 Studio",
        description: "Build your own games. Extract the zip anywhere and run RobloxStudioBeta.exe.",
        fileUrl: "/api/setup/download?os=studio"
    }
];

export const site = new Elysia({ prefix: "/api/site" })
    .use(search)
    .use(feed)
    .use(blog)


    .get("/banners", async () => {
        const rows = await sql`
            SELECT id, message, "linkText", "linkUrl", style, dismissible, "updatedAt" FROM site_banners
            WHERE enabled = 1
            AND ("startsAt" = 0 OR "startsAt" <= ${now()})
            AND ("endsAt" = 0 OR "endsAt" >= ${now()})
            ORDER BY id ASC
        `;
        return rows.map((b: any) => ({
            ...b,
            dismissible: !!b.dismissible
        }));
    })

    .get("/downloads", () => DOWNLOADS)

    .get("/settings", async () => ({
        ...await siteSettings(),
        turnstile_site_key: turnstileOn() ? TURNSTILE_SITE_KEY : ""
    }))
