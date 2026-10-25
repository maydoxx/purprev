import { SQL } from "bun";

const env = process.env;

export const sql = new SQL({
    adapter: "mysql",
    hostname: env.MARIADB_HOST ?? "localhost",
    port: Number(env.MARIADB_PORT ?? 3306),
    database: env.MARIADB_DATABASE ?? "nonerev",
    username: env.MARIADB_USER ?? "nonerev",
    password: env.MARIADB_PASSWORD ?? ""
});

export const now = () => Math.floor(Date.now() / 1000);

// JSON columns come back as strings or objects depending on the driver,
// accept either so callers do not have to know which storage type a column uses.
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
