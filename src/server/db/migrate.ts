import { sql } from ".";

const schema = await Bun.file(import.meta.dir + "/schema.sql").text();

for (const chunk of schema.split(";")) {

    const stmt = chunk.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
    if (stmt === "") continue;
    await sql.unsafe(stmt);
}

const columns: [string, string, string][] = [
    ["users", "membership", "enum('None','BC','TBC','OBC') NOT NULL DEFAULT 'None'"],
    ["users", "membership_expires", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["users", "last_stipend", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["users", "social_discord", "varchar(40) NOT NULL DEFAULT ''"],
    ["users", "social_twitter", "varchar(60) NOT NULL DEFAULT ''"],
    ["users", "social_youtube", "varchar(120) NOT NULL DEFAULT ''"],
    ["users", "game_ui", "enum('2014','2016','2021') NOT NULL DEFAULT '2016'"],
    ["catalog_items", "bc_only", "tinyint(1) NOT NULL DEFAULT 0"],
    ["catalog_items", "tix_price", "int(10) UNSIGNED DEFAULT NULL"],
    ["users", "tix", "int(11) NOT NULL DEFAULT 0"],
    ["users", "last_tix_day", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["users", "last_nonebux_day", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["catalog_items", "is_starter", "tinyint(1) NOT NULL DEFAULT 0"],
    ["catalog_items", "package_parts", "varchar(255) NOT NULL DEFAULT ''"],
    ["games", "created_at", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["games", "updated_at", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["games", "visits", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["games", "avatar_type", "enum('R6','R15') NOT NULL DEFAULT 'R6'"],
    ["user_avatar", "avatar_type", "enum('R6','R15') NOT NULL DEFAULT 'R6'"],
    ["applications", "why", "text NOT NULL"],
    ["applications", "revivals", "varchar(500) NOT NULL DEFAULT ''"],
    ["applications", "socials", "varchar(500) NOT NULL DEFAULT ''"],
    ["applications", "password", "varchar(255) NOT NULL DEFAULT ''"],
    ["applications", "decided_by_discord", "varchar(32) NOT NULL DEFAULT ''"],
    ["applications", "user_id", "int(10) UNSIGNED NOT NULL DEFAULT 0"],
    ["applications", "reason", "varchar(500) NOT NULL DEFAULT ''"]
];
for (const [table, column, definition] of columns) {
    const [row] = await sql`SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}`;
    if (!row) {
        await sql.unsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`added ${table}.${column}`);
    }
}

await sql`
    UPDATE games JOIN media ON media.kind = 'places' AND media.id = games.id
    SET games.created_at = media.updated_at, games.updated_at = media.updated_at
    WHERE games.created_at = 0
`;

console.log("done");
await sql.close();
