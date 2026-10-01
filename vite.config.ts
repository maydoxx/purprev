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

export default defineConfig({
    plugins: [
        stylesheetVersions,
        svelte()
    ],

    server: {
        proxy: {

            "/api": process.env.API_URL ?? "http://localhost:3000",
            "/uploads": process.env.API_URL ?? "http://localhost:3000",

            "^/(Game|game|Asset|asset|Setting|Error|error|user|Friend|Badges)/": process.env.API_URL ?? "http://localhost:3000",
            "^/(marketplace|ownership|currency|persistence|thumbs|Thumbs|moderation|mobileapi|UserCheck|Login|device|notifications|sponsoredpage|v1\\.1|my/account|setup|discord|games/start|pe\\.png)(/|$)": process.env.API_URL ?? "http://localhost:3000",
            "^/GetAllowed": process.env.API_URL ?? "http://localhost:3000"
        }
    }
});
