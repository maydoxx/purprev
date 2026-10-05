import { sql } from ".";

const schema = await Bun.file(import.meta.dir + "/schema.sql").text();

for (const chunk of schema.split(";")) {
    const stmt = chunk.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
    if (stmt === "") continue;
    await sql.unsafe(stmt);
}

const columns: [string, string, string][] = [
    ["users", "membership", "varchar(8) NOT NULL DEFAULT 'None' CHECK (membership IN ('None', 'BC', 'TBC', 'OBC'))"],
    ["users", "membership_expires", "integer NOT NULL DEFAULT 0"],
    ["users", "last_stipend", "integer NOT NULL DEFAULT 0"],
    ["users", "social_discord", "varchar(40) NOT NULL DEFAULT ''"],
    ["users", "social_twitter", "varchar(60) NOT NULL DEFAULT ''"],
    ["users", "social_youtube", "varchar(120) NOT NULL DEFAULT ''"],
    ["catalog_items", "bc_only", "smallint NOT NULL DEFAULT 0"],
    ["catalog_items", "tix_price", "integer DEFAULT NULL"],
    ["users", "tix", "integer NOT NULL DEFAULT 0"],
    ["users", "last_tix_day", "integer NOT NULL DEFAULT 0"],
    ["users", "last_nonebux_day", "integer NOT NULL DEFAULT 0"],
    ["catalog_items", "is_starter", "smallint NOT NULL DEFAULT 0"],
    ["catalog_items", "package_parts", "varchar(255) NOT NULL DEFAULT ''"],
    ["games", "created_at", "integer NOT NULL DEFAULT 0"],
    ["games", "updated_at", "integer NOT NULL DEFAULT 0"],
    ["games", "visits", "integer NOT NULL DEFAULT 0"],
    ["games", "avatar_type", "varchar(8) NOT NULL DEFAULT 'R6' CHECK (avatar_type IN ('R6', 'R15'))"],
    ["user_avatar", "avatar_type", "varchar(8) NOT NULL DEFAULT 'R6' CHECK (avatar_type IN ('R6', 'R15'))"],
    ["applications", "why", "text NOT NULL DEFAULT ''"],
    ["applications", "revivals", "varchar(500) NOT NULL DEFAULT ''"],
    ["applications", "socials", "varchar(500) NOT NULL DEFAULT ''"],
    ["applications", "password", "varchar(255) NOT NULL DEFAULT ''"],
    ["applications", "decided_by_discord", "varchar(32) NOT NULL DEFAULT ''"],
    ["applications", "user_id", "integer NOT NULL DEFAULT 0"],
    ["applications", "reason", "varchar(500) NOT NULL DEFAULT ''"],
    ["users", "signing_bonus", "smallint NOT NULL DEFAULT 0"],
    ["site_groups", "bc_only", "smallint NOT NULL DEFAULT 0"],
    ["site_groups", "shout_by", "integer NOT NULL DEFAULT 0"],
    ["site_groups", "shout_at", "integer NOT NULL DEFAULT 0"],
    ["games", "description", "text NOT NULL DEFAULT ''"],
    ["games", "genre", "varchar(20) NOT NULL DEFAULT 'All'"],
    ["games", "max_players", "smallint NOT NULL DEFAULT 10"],
    ["games", "allowed_gear", "varchar(160) NOT NULL DEFAULT ''"],
    ["games", "copylocked", "smallint NOT NULL DEFAULT 1"],
    ["games", "access", "varchar(8) NOT NULL DEFAULT 'everyone' CHECK (access IN ('everyone', 'friends', 'private'))"],
    ["games", "featured", "smallint NOT NULL DEFAULT 0"]
];
for (const [table, column, definition] of columns) {
    const [row] = await sql`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}`;
    if (!row) {
        await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`added ${table}.${column}`);
    }
}

// seeds insert fixed ids
const identities = await sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND is_identity = 'YES'`;
for (const { table_name, column_name } of identities) {
    await sql.unsafe(`SELECT setval(pg_get_serial_sequence('${table_name}', '${column_name}'), COALESCE((SELECT MAX(${column_name}) FROM ${table_name}), 0) + 1, false)`);
}

await sql`
    UPDATE games SET created_at = media.updated_at, updated_at = media.updated_at
    FROM media WHERE media.kind = 'places' AND media.id = games.id AND games.created_at = 0
`;

console.log("done");
await sql.close();
