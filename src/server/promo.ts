import { sql, now } from "./db";
import { mediaUrl } from "./paths";

export class PromoError extends Error {}

export const PROMO_CODE = /^[A-Z0-9!_-]{3,40}$/;

// spaces and dots dont count
export const cleanPromo = (code: string) => code.toUpperCase().replace(/[\s.]/g, "");

export const promoItems = async (codeIds: number[]) => {
    if (!codeIds.length) return new Map<number, any[]>();
    const rows = await sql`
        SELECT promo_code_items.code_id, catalog_items.id, catalog_items.name, catalog_items.thumbnail FROM promo_code_items
        JOIN catalog_items ON catalog_items.id = promo_code_items.item_id
        WHERE promo_code_items.code_id IN ${sql(codeIds)}
        ORDER BY catalog_items.name
    `;
    const items = new Map<number, any[]>();
    for (const row of rows) {
        const list = items.get(row.code_id) ?? [];
        list.push({
            id: row.id,
            name: row.name,
            thumbnail: row.thumbnail || await mediaUrl("catalog", row.id)
        });
        items.set(row.code_id, list);
    }
    return items;
};

export const redeemPromo = async (userId: number, typed: string) => {
    const code = cleanPromo(typed);
    if (!PROMO_CODE.test(code)) {
        throw new PromoError("That promo code is not valid.");
    }
    const result = await sql.begin(async tx => {
        const [promo] = await tx`SELECT * FROM promo_codes WHERE code = ${code} FOR UPDATE`;
        const time = now();
        if (!promo || !promo.active) {
            throw new PromoError("That promo code is not valid.");
        }
        if (promo.starts_at > time) {
            throw new PromoError("That promo code is not active yet.");
        }
        if (promo.expires_at > 0 && promo.expires_at <= time) {
            throw new PromoError("That promo code has expired.");
        }
        if (promo.max_uses > 0 && promo.uses >= promo.max_uses) {
            throw new PromoError("That promo code has been used up.");
        }
        const claimed = await tx`INSERT INTO promo_redemptions (code_id, user_id, redeemed_at) VALUES (${promo.id}, ${userId}, ${time}) ON CONFLICT DO NOTHING`;
        if (!claimed.count) {
            throw new PromoError("You have already redeemed this promo code.");
        }
        const items = await tx`SELECT item_id FROM promo_code_items WHERE code_id = ${promo.id}`;
        const added: number[] = [];
        for (const { item_id } of items) {
            const given = await tx`INSERT INTO user_items (user_id, item_id, wearing, purchased_at) VALUES (${userId}, ${item_id}, 0, ${time}) ON CONFLICT DO NOTHING`;
            if (given.count) added.push(Number(item_id));
        }
        if (promo.nonebux > 0) {
            await tx`UPDATE users SET currency = LEAST(currency::bigint + ${promo.nonebux}, 2147483647) WHERE id = ${userId}`;
        }
        if (promo.tix > 0) {
            await tx`UPDATE users SET tix = LEAST(tix::bigint + ${promo.tix}, 2147483647) WHERE id = ${userId}`;
        }
        await tx`UPDATE promo_codes SET uses = uses + 1 WHERE id = ${promo.id}`;
        return {
            id: Number(promo.id),
            code: promo.code,
            nonebux: Number(promo.nonebux),
            tix: Number(promo.tix),
            added
        };
    });
    const items = (await promoItems([result.id])).get(result.id) ?? [];
    return {
        code: result.code,
        nonebux: result.nonebux,
        tix: result.tix,
        items: items.map(item => ({
            ...item,
            owned: !result.added.includes(item.id)
        }))
    };
};
