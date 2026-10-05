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
