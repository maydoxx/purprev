import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vendoredThemeSource = fileURLToPath(new URL("../vendor/site-themes/", import.meta.url));
const siblingThemeSource = fileURLToPath(new URL("../../site-themes/", import.meta.url));
export const themeSource = existsSync(resolve(vendoredThemeSource, "css/dark.css")) ? vendoredThemeSource : siblingThemeSource;
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));

const writeChanged = (path: string, contents: string | Buffer) => {
    const data = Buffer.from(contents);
    if (!existsSync(path) || !readFileSync(path).equals(data)) writeFileSync(path, data);
};

const themeNames = ["dark", "oled", "halloween", "sakura"];

export type ThemeCredit = {
    text: string;
    url: string;
};

export type ThemeMeta = {
    name: string;
    author: string;
    description: string;
    credits: ThemeCredit[];
};

// the first comment of a theme file holds "@key value" lines
const parseThemeMeta = (file: string, css: string): ThemeMeta => {
    const meta: ThemeMeta = {
        name: file,
        author: "",
        description: "",
        credits: []
    };
    const header = css.match(/^\s*\/\*([\s\S]*?)\*\//)?.[1] ?? "";
    for (const line of header.split(/\r?\n/)) {
        const match = line.match(/^[\s*]*@(name|author|description|credit)\s+(.+?)\s*$/);
        if (!match) continue;
        const key = match[1] as "name" | "author" | "description" | "credit";
        const value = match[2]!;
        if (key === "credit") {
            const url = value.match(/\s(https:\/\/\S+)$/)?.[1] ?? "";
            meta.credits.push({
                text: url ? value.slice(0, -url.length).trim() : value,
                url
            });
        } else {
            meta[key] = value;
        }
    }
    return meta;
};

export const readThemeMeta = () => Object.fromEntries(themeNames.map(name => [
    name,
    parseThemeMeta(name, readFileSync(resolve(themeSource, `css/${name}.css`), "utf8"))
]));

export const syncSiteThemes = () => {
    if (!existsSync(resolve(themeSource, "css/dark.css"))) {
        throw new Error("no theme sources, clone https://github.com/nonerev/site-themes.git into vendor/site-themes");
    }
    const cssTarget = resolve(publicRoot, "css/themes");
    const assetTarget = resolve(publicRoot, "img/themes");
    mkdirSync(cssTarget, { recursive: true });
    mkdirSync(assetTarget, { recursive: true });
    const assets = new Map<string, string>();
    for (const file of readdirSync(resolve(themeSource, "assets"), { withFileTypes: true })) {
        if (!file.isFile()) continue;
        const contents = readFileSync(resolve(themeSource, "assets", file.name));
        const hash = createHash("sha256").update(contents).digest("hex").slice(0, 12);
        assets.set(file.name, `/img/themes/${file.name}?v=${hash}`);
        writeChanged(resolve(assetTarget, file.name), contents);
    }
    for (const name of themeNames) {
        const css = readFileSync(resolve(themeSource, `css/${name}.css`), "utf8").replace(
            /url\(["']?\.\.\/assets\/([^"')]+)["']?\)/g,
            (_url, file: string) => {
                const url = assets.get(file);
                if (!url) throw new Error(`missing theme asset ${file}`);
                return `url("${url}")`;
            }
        );
        writeChanged(resolve(cssTarget, `${name}.css`), `/* generated from site-themes, edit the source there */\n${css}`);
    }
};

if (import.meta.main) {
    syncSiteThemes();
    console.log("themes synced");
}
