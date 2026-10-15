import { SQL } from "bun";

const env = process.env;

export const sql = new SQL({
    adapter: "postgres",
    hostname: env.PG_HOST ?? "localhost",
    port: Number(env.PG_PORT ?? 5432),
    database: env.PG_DATABASE ?? "nonerev",
    username: env.PG_USER ?? "nonerev",
    password: env.PG_PASSWORD ?? ""
});


export const now = () => Math.floor(Date.now() / 1000);

// jsonb columns come back already decoded from Bun's postgres client, but text
// columns holding json come back as strings. accept either so callers do not
// have to know which storage type a column uses.
export const parseJson = <T>(value: unknown, fallback: T): T => {
    if (value === null || value === undefined) {
        return fallback;
    }
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }
    if (typeof value === "object") {
        return value as T;
    }
    return fallback;
};
