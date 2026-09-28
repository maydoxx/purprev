import { SQL } from "bun";

const env = process.env;

export const sql = new SQL({
    adapter: "mysql",
    hostname: env.MYSQL_HOST ?? "localhost",
    port: Number(env.MYSQL_PORT ?? 3306),
    database: env.MYSQL_DATABASE ?? "nonerev",
    username: env.MYSQL_USER ?? "nonerev",
    password: env.MYSQL_PASSWORD ?? "",
    allowPublicKeyRetrieval: true
});


export const now = () => Math.floor(Date.now() / 1000);
