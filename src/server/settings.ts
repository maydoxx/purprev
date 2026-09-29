import { sql, now } from "./db";

// admin toggles, cached so every signup doesnt hit the table
const DEFAULTS: Record<string, string> = {
    registration_enabled: "1",
    invites_enabled: "1"
};

let cache: Record<string, string> | null = null;
let loadedAt = 0;

const load = async () => {
    if (!cache || Date.now() - loadedAt > 30000) {
        const rows = await sql`SELECT name, value FROM site_settings`;
        cache = {
            ...DEFAULTS
        };
        for (const r of rows) {
            cache[r.name] = r.value;
        }
        loadedAt = Date.now();
    }
    return cache;
};

export const siteSettings = async () => {
    const all = await load();
    return {
        registration_enabled: all.registration_enabled === "1",
        invites_enabled: all.invites_enabled === "1"
    };
};

export const siteSetting = async (name: keyof typeof DEFAULTS) => (await load())[name] === "1";

export const setSiteSetting = async (name: keyof typeof DEFAULTS, on: boolean, by: number) => {
    const value = on ? "1" : "0";
    await sql`
        INSERT INTO site_settings (name, value, updated_at, updated_by) VALUES (${name}, ${value}, ${now()}, ${by})
        ON DUPLICATE KEY UPDATE value = ${value}, updated_at = ${now()}, updated_by = ${by}
    `;
    (await load())[name] = value;
};
