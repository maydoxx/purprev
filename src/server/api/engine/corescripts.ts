import { Elysia, t } from "elysia";
import { join } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";
import { session } from "../../session";
import { SITE_URL } from "../../site";
import { text } from "./sign";

const STATIC = join(import.meta.dir, "..", "..", "static", "corescripts");

// a skin is a folder: StarterScript.lua replaces the whole 2016 set, Skin.lua runs on top of it.
// the first comment line of whichever exists is the note on the settings page
const entry = (year: string) => {
    for (const name of ["StarterScript.lua", "Skin.lua"]) {
        if (existsSync(join(STATIC, year, name))) {
            return name;
        }
    }
    return null;
};

const note = (year: string, name: string) => {
    const first = readFileSync(join(STATIC, year, name), "utf8").split("\n")[0] ?? "";
    return first.replace(/^--\s*/, "").trim();
};

export const skins = () =>
    readdirSync(STATIC, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d{4}$/.test(d.name) && entry(d.name))
        .map(d => ({
            id: d.name,
            full: entry(d.name) === "StarterScript.lua",
            note: note(d.name, entry(d.name)!)
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

// the old scripts point at roblox for their images, the ones that died there sit next to the script
const lua = (year: string, name: string) => {
    const have = new Set(readdirSync(join(STATIC, year)));
    const image = (id: string) =>
        have.has(`${id}.png`) ? `${SITE_URL}/corescripts/${year}/${id}.png` : `${SITE_URL}/asset/?id=${id}`;
    return readFileSync(join(STATIC, year, name), "utf8")
        .replace(/https?:\/\/www\.roblox\.com\/asset\/\?id=(\d+)/g, (_, id) => image(id))
        .replace(/rbxassetid:\/\/(\d+)/g, (_, id) => image(id))
        .replace(/https?:\/\/www\.roblox\.com/g, SITE_URL)
        .replace(/www\.roblox\.com/g, new URL(SITE_URL).host);
};

export const corescripts = new Elysia({ prefix: "/corescripts" })
    .use(session)

    .get("/ui", ({ user }) => text(user?.game_ui ?? "2016"))

    .get("/skins", () => skins())

    .get("/:year/:name", ({ params, status }) => {
        if (!skins().some(s => s.id === params.year) || !existsSync(join(STATIC, params.year, params.name))) {
            return status(404, "no such file");
        }
        if (params.name.endsWith(".png")) {
            return new Response(Bun.file(join(STATIC, params.year, params.name)), {
                headers: {
                    "Content-Type": "image/png",
                    "Cache-Control": "public, max-age=86400"
                }
            });
        }
        return new Response(lua(params.year, params.name), {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache"
            }
        });
    }, {
        params: t.Object({
            year: t.String({ pattern: "^\\d{4}$" }),
            name: t.String({ pattern: "^[A-Za-z0-9]+\\.(lua|png)$" })
        })
    })
