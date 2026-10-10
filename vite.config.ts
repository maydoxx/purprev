import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const versionStylesheets = (source: string) => source.replace(
    /(["'])\/css\/([a-zA-Z0-9_.-]+\.css)(?=["'])/g,
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
        if (!id.endsWith(".svelte")) return;
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

export default defineConfig({
    plugins: [
        stylesheetVersions,
        svelte()
    ],

    server: {
        proxy: {

            "^/+(api|uploads)/": api,

            "^/+(Game|game|Asset|asset|Setting|Error|error|user|users|userblock|Friend|marketplace|ownership|currency|gametransactions|points|reservedservers|persistence|thumbs|Thumbs|moderation|AbuseReport|adimpression|mobileapi|UserCheck|Login|login|device|notifications|sponsoredpage|client-status|v1\\.0|v1\\.1|my/account|IDE|ide|Data|UI|universes|developerproducts|setup|openapi)/": api,
            "^/+(Asset|asset|my/friendsonline|My/Places\\.aspx|my/places\\.aspx|discord|games/start|pe\\.png|openapi)(\\?|$)": api,
            "^/+(groups|assets)/[0-9]+(/|\\?|$)": api,
            "^/+GetAllowed": api
        }
    }
});
