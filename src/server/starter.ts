import { sql, now } from "./db";

// what a new account gets and wears, one random package when several are starters
export const giveStarterItems = async (userId: number) => {
    const items = await sql`SELECT id, category FROM catalog_items WHERE is_starter = 1 ORDER BY id`;
    const packages = items.filter((i: any) => i.category === "Package");
    const pick = packages.length ? packages[Math.floor(Math.random() * packages.length)] : null;
    for (const i of items) {
        if (i.category === "Package" && i !== pick) {
            continue;
        }
        await sql`INSERT IGNORE INTO user_items (user_id, item_id, wearing, purchased_at) VALUES (${userId}, ${i.id}, 1, ${now()})`;
    }
};
