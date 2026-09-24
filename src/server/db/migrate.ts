// bun run src/server/db/migrate.ts
import { sql } from ".";

const schema = await Bun.file(import.meta.dir + "/schema.sql").text();

for (const chunk of schema.split(";")) {
    // drop comment lines, a statement can have one right above it
    const stmt = chunk.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
    if (stmt === "") continue;
    await sql.unsafe(stmt);
}

console.log("done");
await sql.close();
