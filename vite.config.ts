import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readThemeMeta, syncSiteThemes, themeSource } from "./scripts/site-themes.ts";

syncSiteThemes();

const themeMetaId = "virtual:site-themes";

const siteThemes: Plugin = {
    name: "nonerev-site-themes",
    resolveId(id) {
        if (id === themeMetaId) return "\0" + themeMetaId;
    },
    load(id) {
        if (id === "\0" + themeMetaId) return `export default ${JSON.stringify(readThemeMeta())};`;
    },
    configureServer(server) {
        const roots = [`${themeSource}css`, `${themeSource}assets`].map(path => path.replace(/\\/g, "/"));
        server.watcher.add(roots);
        const sync = (path: string) => {
            if (!roots.some(root => path.replace(/\\/g, "/").startsWith(root + "/"))) return;
            try {
                syncSiteThemes();
                const meta = server.moduleGraph.getModuleById("\0" + themeMetaId);
                if (meta) server.moduleGraph.invalidateModule(meta);
                server.ws.send({ type: "full-reload" });
            } catch (err) {
                server.config.logger.error(String(err));
            }
        };
        server.watcher.on("change", sync).on("add", sync).on("unlink", sync);
        server.httpServer?.once("close", () => {
            server.watcher.off("change", sync).off("add", sync).off("unlink", sync);
        });
    }
};

const versionStylesheets = (source: string) => source.replace(
    /(["'])\/css\/((?:themes\/)?[a-zA-Z0-9_.-]+\.css)(?=["'])/g,
    (_url, quote: string, filename: string) => {
        const contents = readFileSync(new URL(`./public/css/${filename}`, import.meta.url));
        const version = createHash("sha256").update(contents).digest("hex").slice(0, 12);
        return `${quote}/css/${filename}?v=${version}`;
    }
);

const stylesheetVersions: Plugin = {
    name: "nonerev-stylesheet-versions",
    apply: "build",
    enforce: "pre",
    transform(source, id) {
        if (!/\.(svelte|ts)$/.test(id)) return;
        const code = versionStylesheets(source);
        return code === source ? undefined : { code, map: null };
    },
    transformIndexHtml: {
        order: "pre",
        handler: versionStylesheets
    }
};

const api = {
    target: process.env.API_URL ?? "http://localhost:3000",
    xfwd: true
};

const previewBots = /discordbot|twitterbot|facebookexternalhit|facebot|slackbot|telegrambot|whatsapp|linkedinbot|redditbot|embedly|skypeuripreview|mastodon|pleroma|misskey|cardyb|iframely|vkshare|pinterestbot/i;

export default defineConfig({
    plugins: [
        siteThemes,
        stylesheetVersions,
        svelte()
    ],

    server: {
        proxy: {

            "^/+(api|uploads)/": api,

            "^/+(Game|game|Asset|asset|Setting|Error|error|user|users|userblock|Friend|marketplace|ownership|currency|gametransactions|points|reservedservers|persistence|thumbs|Thumbs|moderation|AbuseReport|adimpression|mobileapi|UserCheck|Login|login|device|notifications|sponsoredpage|client-status|v1\\.0|v1\\.1|my/account|IDE|ide|Data|UI|universes|developerproducts|setup|openapi)/": api,
            "^/+(Asset|asset|my/friendsonline|My/Places\\.aspx|my/places\\.aspx|discord|games/start|pe\\.png|openapi)(\\?|$)": api,
            "^/+(groups|assets)/[0-9]+(/|\\?|$)": api,
            "^/+GetAllowed": api,

            "^/+(?!@)[^.?]*(\\?|$)": {
                ...api,
                changeOrigin: true,
                bypass: req => previewBots.test(req.headers["user-agent"] ?? "") ? undefined : req.url,
                rewrite: url => `/api/embed${url}`
            }
        }
    }
});
