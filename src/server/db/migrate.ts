import { sql, now } from ".";
import { digestToken } from "../crypto";

const schema = await Bun.file(import.meta.dir + "/schema.sql").text();

for (const chunk of schema.split(";")) {
    const stmt = chunk.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
    if (stmt === "") continue;
    await sql.unsafe(stmt);
}

// Drop email column from users table if it exists
await sql`ALTER TABLE users DROP COLUMN IF EXISTS email`;

// Drop email column from applications table if it exists
await sql`ALTER TABLE applications DROP COLUMN IF EXISTS email`;

// Drop unique index on users.email if it exists
try {
    await sql`ALTER TABLE users DROP INDEX users_email_key`;
} catch {}

const columns: [string, string, string][] = [
    ["users", "membership", "varchar(8) NOT NULL DEFAULT 'None' CHECK (membership IN ('None', 'BC', 'TBC', 'OBC'))"],
    ["users", "membership_expires", "integer NOT NULL DEFAULT 0"],
    ["users", "last_stipend", "integer NOT NULL DEFAULT 0"],
    ["users", "social_discord", "varchar(40) NOT NULL DEFAULT ''"],
    ["users", "social_twitter", "varchar(60) NOT NULL DEFAULT ''"],
    ["users", "social_youtube", "varchar(120) NOT NULL DEFAULT ''"],
    ["users", "social_visibility", "JSON NOT NULL DEFAULT ('{\"discord\": true, \"twitter\": true, \"youtube\": true}')"],
    ["users", "processing_consents", "JSON NOT NULL DEFAULT ('{\"marketing\": false, \"analytics\": true, \"profiling\": false, \"third_party_sharing\": false}')"],
    ["users", "processing_objections", "JSON NOT NULL DEFAULT ('{\"marketing\": false, \"analytics\": false, \"profiling\": false, \"third_party_sharing\": false}')"],
    ["users", "processing_restricted", "smallint NOT NULL DEFAULT 0"],
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
    ["applications", "why", "text NOT NULL"],
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
    ["games", "description", "text NOT NULL"],
    ["games", "genre", "varchar(20) NOT NULL DEFAULT 'All'"],
    ["games", "max_players", "smallint NOT NULL DEFAULT 10"],
    ["games", "allowed_gear", "varchar(160) NOT NULL DEFAULT ''"],
    ["games", "copylocked", "smallint NOT NULL DEFAULT 1"],
    ["games", "access", "varchar(8) NOT NULL DEFAULT 'everyone' CHECK (access IN ('everyone', 'friends', 'private'))"],
    ["games", "featured", "smallint NOT NULL DEFAULT 0"],
    ["moderation_actions", "created_at", "integer NOT NULL DEFAULT 0"],
    ["catalog_items", "genre", "varchar(20) NOT NULL DEFAULT 'All'"],
    ["vip_servers", "access_code", "varchar(64) NOT NULL DEFAULT (UUID())"],
    ["vip_servers", "active", "smallint NOT NULL DEFAULT 1"],
    ["vip_servers", "allow_friends", "smallint NOT NULL DEFAULT 0"],
    ["users", "last_studio", "integer NOT NULL DEFAULT 0"],
    ["users", "studio_place_id", "integer NOT NULL DEFAULT 0"],
    ["users", "theme", "varchar(10) NOT NULL DEFAULT 'auto' CHECK (theme IN ('auto', 'classic', 'dark', 'oled', 'halloween', 'sakura'))"],
    ["users", "profile_accent", "varchar(7) NOT NULL DEFAULT '#7b2cbf'"],
    ["users", "profile_sections", "varchar(120) NOT NULL DEFAULT 'about,wearing,friends,collections,groups,favorites,siteBadges,playerBadges,statistics'"],
    ["users", "message_privacy", "varchar(10) NOT NULL DEFAULT 'everyone'"],
    ["users", "follow_privacy", "varchar(10) NOT NULL DEFAULT 'everyone'"],
    ["users", "friend_request_privacy", "varchar(10) NOT NULL DEFAULT 'everyone'"],
    ["tokens", "platform", "varchar(20) NOT NULL DEFAULT 'Unknown'"]
];

for (const [table, column, definition] of columns) {
    const [row] = await sql`SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}`;
    if (!row) {
        await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`added ${table}.${column}`);
    }
}

const catalogCategoryChecks = await sql`
    SELECT tc.CONSTRAINT_NAME as conname
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc 
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA 
      AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE()
      AND tc.TABLE_NAME = 'catalog_items'
      AND tc.CONSTRAINT_TYPE = 'CHECK'
      AND cc.CHECK_CLAUSE LIKE '%category%'
`;
for (const { conname } of catalogCategoryChecks) {
    const safeName = String(conname).replace(/`/g, '``');
    await sql.unsafe(`ALTER TABLE catalog_items DROP CHECK \`${safeName}\``);
}
await sql`ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_category_check CHECK (category IN ('Hat', 'Face', 'T-Shirt', 'Shirt', 'Pants', 'Gear', 'Package', 'Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg'))`;

const themeChecks = await sql`
    SELECT tc.CONSTRAINT_NAME as conname
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc 
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA 
      AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE()
      AND tc.TABLE_NAME = 'users'
      AND tc.CONSTRAINT_TYPE = 'CHECK'
      AND cc.CHECK_CLAUSE LIKE '%theme%'
`;
for (const { conname } of themeChecks) {
    const safeName = String(conname).replace(/`/g, '``');
    await sql.unsafe(`ALTER TABLE users DROP CHECK \`${safeName}\``);
}
await sql`ALTER TABLE users ADD CONSTRAINT users_theme_check CHECK (theme IN ('auto', 'classic', 'dark', 'oled', 'halloween', 'sakura'))`;

// Ensure unique index on vip_servers access_code
await sql`CREATE UNIQUE INDEX IF NOT EXISTS vip_servers_access_code ON vip_servers (access_code)`;

// Adjust AUTO_INCREMENT sequences for seeded fixed IDs
const autoIncs = await sql`
    SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name 
    FROM information_schema.columns 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND EXTRA LIKE '%auto_increment%'
`;
for (const { table_name, column_name } of autoIncs) {
    const [{ max_val }] = await sql.unsafe(`SELECT COALESCE(MAX(${column_name}), 0) + 1 as max_val FROM ${table_name}`);
    await sql.unsafe(`ALTER TABLE ${table_name} AUTO_INCREMENT = ${max_val}`);
}

await sql`
    UPDATE games 
    JOIN media ON media.kind = 'places' AND media.id = games.id 
    SET games.created_at = media.updated_at, games.updated_at = media.updated_at 
    WHERE games.created_at = 0
`;

// Session tokens moved from plaintext to hashed; convert existing ones once.
await sql`CREATE TABLE IF NOT EXISTS data_migrations (name varchar(64) PRIMARY KEY, applied_at integer NOT NULL DEFAULT 0)`;
const [existing] = await sql`SELECT name FROM data_migrations WHERE name = 'hash_session_tokens'`;
if (!existing) {
    await sql`INSERT INTO data_migrations (name, applied_at) VALUES ('hash_session_tokens', ${now()})`;
    const rows = await sql`SELECT id, token FROM tokens`;
    for (const row of rows) {
        await sql`UPDATE tokens SET token = ${await digestToken(String(row.token))} WHERE id = ${row.id}`;
    }
    console.log(`hashed ${rows.length} session tokens`);
}

console.log("done");
await sql.close();
