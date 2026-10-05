import { sql, now } from "./db";
import { giveStarterItems, seedStarterItems } from "./starter";

// a fresh install has nobody who can open the admin panel, change this password after the first login
const ensureFirstUser = async () => {
    const [anyone] = await sql`SELECT 1 FROM users LIMIT 1`;
    if (anyone) {
        return null;
    }
    const username = process.env.FIRST_USER_NAME || "NONEREV";
    const hash = await Bun.password.hash(process.env.FIRST_USER_PASSWORD || "meowmeow727", "bcrypt");
    const [row] = await sql`
        INSERT INTO users (username, password, created_at, admin) VALUES (${username}, ${hash}, ${now()}, 1)
        ON CONFLICT DO NOTHING
        RETURNING id
    `;
    if (row) {
        console.log(`no users yet, created ${username}`);
    }
    return row ? Number(row.id) : null;
};

// the starter items need an owner, so the first user comes before them and gets them after
export const firstRun = async () => {
    const first = await ensureFirstUser();
    await seedStarterItems();
    if (first !== null) {
        await giveStarterItems(first);
    }
};
