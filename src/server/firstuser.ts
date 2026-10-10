import { sql, now } from "./db";
import { giveStarterItems, seedStarterItems } from "./starter";

// a fresh install has nobody who can open the admin panel, change this password after the first login
const ensureFirstUser = async () => {
    const [anyone] = await sql`SELECT 1 FROM users LIMIT 1`;
    if (anyone) {
        return null;
    }
    const username = process.env.FIRST_USER_NAME || "NONEREV";
    // random unless .env sets one
    const given = process.env.FIRST_USER_PASSWORD ?? "";
    const password = given || Buffer.from(crypto.getRandomValues(new Uint8Array(15))).toString("base64url");
    const hash = await Bun.password.hash(password, "bcrypt");
    const [row] = await sql`
        INSERT INTO users (username, password, created_at, admin) VALUES (${username}, ${hash}, ${now()}, 1)
        ON CONFLICT DO NOTHING
        RETURNING id
    `;
    if (row) {
        console.log(given ? `no users yet, created ${username}` : `no users yet, created ${username} with password ${password}, it is only shown this once`);
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
