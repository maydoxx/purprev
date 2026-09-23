// bun run src/server/db/migrate.ts
import { sql } from ".";

const schema = await Bun.file(import.meta.dir + "/schema.sql").text();

for (const stmt of schema.split(";")) {
    if (stmt.trim() === "" || stmt.trim().startsWith("--")) continue;
    await sql.unsafe(stmt);
}

console.log("done");
await sql.close();
