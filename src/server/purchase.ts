import { sql, now } from "./db";
import type { User } from "./session";

export class PurchaseError extends Error {
    constructor(readonly status: string, message: string) {
        super(message);
    }
}

export type Currency = "nonebux" | "tix";

const charge = async (tx: any, buyerId: number, sellerId: number, price: number) => {
    if (price > 0) {
        await tx`UPDATE users SET currency = currency - ${price} WHERE id = ${buyerId}`;
        if (sellerId && sellerId !== buyerId) {
            await tx`UPDATE users SET currency = LEAST(currency::bigint + ${price}, 2147483647) WHERE id = ${sellerId}`;
        }
    }
};

export const buyItem = (user: User, itemId: number, method: Currency, expected?: number) => sql.begin(async tx => {
    const [item] = await tx`SELECT * FROM catalog_items WHERE id = ${itemId} FOR UPDATE`;
    if (!item) {
        throw new PurchaseError("InvalidProduct", "This item does not exist");
    }

    const [owned] = await tx`SELECT 1 FROM user_items WHERE user_id = ${user.id} AND item_id = ${itemId} FOR UPDATE`;
    if (owned) {
        throw new PurchaseError("AlreadyOwned", "You already own this item");
    }
    const priceValue = method === "tix" ? item.tix_price : item.price;
    if (priceValue === null) {
        throw new PurchaseError("NotForSale", "This item is off sale");
    }
    if (item.bc_only && user.membership === "None") {
        throw new PurchaseError("InsufficientMembership", "This item is for Builders Club members only");
    }

    const price = Number(priceValue);
    if (expected !== undefined && expected !== price) {
        throw new PurchaseError("PriceChanged", "The price of this item changed");
    }
    let serial: number | null = null;

    if (item.is_limited_unique) {
        // Atomic increment with RETURNING to prevent race conditions
        const [updated] = await tx`
            UPDATE catalog_items
            SET limited_sold = limited_sold + 1
            WHERE id = ${itemId}
              AND limited_sold < limited_stock
              AND limited_stock > 0
            RETURNING limited_sold
        `;
        if (!updated) {
            throw new PurchaseError("SoldOut", "This Limited U item is sold out");
        }
        serial = Number(updated.limited_sold);
    }

    const [me] = await tx`SELECT currency, tix FROM users WHERE id = ${user.id} FOR UPDATE`;
    if (Number(method === "tix" ? me.tix : me.currency) < price) {
        throw new PurchaseError("InsufficientFunds", `You do not have enough ${method === "tix" ? "Tix" : "Nonebux"} for this item`);
    }

    if (price > 0) {
        const debit = method === "tix"
            ? await tx`UPDATE users SET tix = tix - ${price} WHERE id = ${user.id} AND tix >= ${price}`
            : await tx`UPDATE users SET currency = currency - ${price} WHERE id = ${user.id} AND currency >= ${price}`;
        if (!debit.count) {
            throw new PurchaseError("InsufficientFunds", "Your balance changed. Please try again.");
        }
        if (item.creator_id && item.creator_id !== user.id) {
            if (method === "tix") {
                await tx`UPDATE users SET tix = LEAST(tix::bigint + ${price}, 2147483647) WHERE id = ${item.creator_id}`;
            } else {
                await tx`UPDATE users SET currency = LEAST(currency::bigint + ${price}, 2147483647) WHERE id = ${item.creator_id}`;
            }
        }
    }


    await tx`INSERT INTO user_items (user_id, item_id, wearing, purchased_at, serial_number) VALUES (${user.id}, ${itemId}, 0, ${now()}, ${serial})`;

    return {
        balance: Number(me.currency) - (method === "nonebux" ? price : 0),
        tixBalance: Number(me.tix) - (method === "tix" ? price : 0)
    };
});

export const buyPass = (userId: number, passId: number, expected?: number) => sql.begin(async tx => {
    const [pass] = await tx`SELECT * FROM game_passes WHERE id = ${passId} FOR UPDATE`;
    if (!pass) {
        throw new PurchaseError("InvalidProduct", "This game pass does not exist.");
    }
    if (pass.price === null) {
        throw new PurchaseError("NotForSale", "This game pass is off sale.");
    }

    const [owned] = await tx`SELECT 1 FROM user_game_passes WHERE user_id = ${userId} AND pass_id = ${passId} FOR UPDATE`;
    if (owned) {
        throw new PurchaseError("AlreadyOwned", "You already own this game pass.");
    }

    const price = Number(pass.price);
    if (expected !== undefined && expected !== price) {
        throw new PurchaseError("PriceChanged", "The price of this game pass changed.");
    }
    const [me] = await tx`SELECT currency FROM users WHERE id = ${userId} FOR UPDATE`;
    if (Number(me.currency) < price) {
        throw new PurchaseError("InsufficientFunds", "You do not have enough Nonebux.");
    }

    await charge(tx, userId, Number(pass.creator_id), price);
    await tx`INSERT INTO user_game_passes (user_id, pass_id, purchased_at) VALUES (${userId}, ${passId}, ${now()})`;

    return Number(me.currency) - price;
});

export const buyProduct = (userId: number, productId: number, placeId: number, expected?: number) => sql.begin(async tx => {
    const [product] = await tx`SELECT * FROM developer_products WHERE id = ${productId} AND game_id = ${placeId}`;
    if (!product) {
        throw new PurchaseError("InvalidProduct", "This developer product does not exist.");
    }
    if (product.price === null) {
        throw new PurchaseError("NotForSale", "This developer product is off sale.");
    }

    const price = Number(product.price);
    if (expected !== undefined && expected !== price) {
        throw new PurchaseError("PriceChanged", "The price of this developer product changed.");
    }
    const [me] = await tx`SELECT currency FROM users WHERE id = ${userId} FOR UPDATE`;
    if (Number(me.currency) < price) {
        throw new PurchaseError("InsufficientFunds", "You do not have enough Nonebux.");
    }

    await charge(tx, userId, Number(product.creator_id), price);
    const receipt = crypto.randomUUID();
    await tx`INSERT INTO product_receipts (receipt, user_id, game_id, product_id, price, created_at) VALUES (${receipt}, ${userId}, ${placeId}, ${productId}, ${price}, ${now()})`;

    return receipt;
});
