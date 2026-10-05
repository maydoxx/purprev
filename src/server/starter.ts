import { sql, now } from "./db";
import { assetThumbnail, lookupRobloxAsset, lookupRobloxBundle, storeThumbnail } from "./roblox";

type Piece = [number, string, "Hat" | "Shirt" | "Pants"];

type StarterSet = {
    bundle: number;
    name: string;
    parts: number[];
    items: Piece[];
};

export const STARTER_SETS: StarterSet[] = [
    {
        bundle: 238,
        name: "Man",
        parts: [86500008, 86500036, 86500054, 86500064, 86500078],
        items: [
            [62234425, "Pal Hair", "Hat"],
            [144076358, "Blue and Black Motorcycle Shirt", "Shirt"],
            [144076760, "Dark Green Jeans", "Pants"]
        ]
    },
    {
        bundle: 239,
        name: "Woman",
        parts: [86499666, 86499698, 86499716, 86499753, 86499793],
        items: [
            [62724852, "Chestnut Bun", "Hat"],
            [144076436, "Grey Striped Shirt with Denim Jacket", "Shirt"],
            [144076512, "Pink Jeans", "Pants"]
        ]
    }
];

const SKIN = [1, 194, 208];
const TORSO = [1, 21, 23, 24, 26, 37, 102, 141, 194, 199, 208];
const LEGS = 102;

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)] as T;

const starterColors = async (userId: number) => {
    const skin = pick(SKIN);
    await sql`
        INSERT INTO user_avatar (user_id, head_color, torso_color, left_arm_color, right_arm_color, left_leg_color, right_leg_color, updated_at)
        VALUES (${userId}, ${skin}, ${pick(TORSO)}, ${skin}, ${skin}, ${LEGS}, ${LEGS}, ${now()}) ON CONFLICT DO NOTHING`;
};

// everyone starts as a bacon hair
export const giveStarterItems = async (userId: number) => {
    await starterColors(userId);
    const set = STARTER_SETS[0]!;
    const ids = set.items.map(i => i[0]);
    const items = await sql`
        SELECT id FROM catalog_items
        WHERE is_starter = 1 OR (category = 'Package' AND asset_id = ${set.bundle}) OR (category <> 'Package' AND asset_id IN ${sql(ids)})
        ORDER BY id
    `;
    for (const i of items) {
        await sql`INSERT INTO user_items (user_id, item_id, wearing, purchased_at) VALUES (${userId}, ${i.id}, 1, ${now()}) ON CONFLICT DO NOTHING`;
    }
};

const exists = async (category: string, assetId: number) =>
    (await sql`SELECT id FROM catalog_items WHERE category = ${category} AND asset_id = ${assetId}`).length > 0;

type Seed = {
    name: string;
    description: string;
    category: string;
    assetId: number;
    parts: number[];
    thumbnail: string;
};

const create = async (creator: number, i: Seed) => {
    const created = await sql`
        INSERT INTO catalog_items (name, description, creator_id, category, asset_id, price, thumbnail, is_featured, bc_only, is_starter, package_parts, is_limited, is_limited_unique, limited_stock, limited_sold, created_at, updated_at)
        VALUES (${i.name}, ${i.description}, ${creator}, ${i.category}, ${i.assetId}, 0, '', 0, 0, 0, ${i.parts.join(";")}, 0, 0, NULL, 0, ${now()}, ${now()}) RETURNING id`;
    const id = Number(created[0].id);
    // the item is already in, a missing picture must not stop the rest of the import
    if (i.thumbnail !== "") {
        await storeThumbnail(id, i.thumbnail).catch(err => console.warn(`no thumbnail for ${i.name}:`, String(err).split("\n")[0]));
    }
    console.log(`${i.category} ${i.name} -> ${id}`);
};

export const seedStarterItems = async () => {
    const [owner] = await sql`SELECT id FROM users ORDER BY admin DESC, id ASC LIMIT 1`;
    if (!owner) {
        throw new Error("no users yet, the items need an owner");
    }
    for (const set of STARTER_SETS) {
        if (!await exists("Package", set.bundle)) {
            const info = await lookupRobloxBundle(set.bundle).catch(() => null);
            await create(owner.id, {
                name: set.name,
                description: info?.description ?? "",
                category: "Package",
                assetId: set.bundle,
                parts: set.parts,
                thumbnail: info?.thumbnail ?? ""
            });
        }
        for (const [assetId, name, category] of set.items) {
            if (await exists(category, assetId)) {
                continue;
            }
            const info = await lookupRobloxAsset(assetId).catch(() => null);
            await create(owner.id, {
                name,
                description: info?.description ?? "",
                category,
                assetId,
                parts: [],
                thumbnail: info?.thumbnail ?? await assetThumbnail(assetId)
            });
        }
    }
};
