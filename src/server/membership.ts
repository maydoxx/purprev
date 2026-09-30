import { sql, now } from "./db";

export const TIERS = {
    None: {
        label: "None",
        enum: "None",
        stipend: 0
    },
    BC: {
        label: "Builders Club",
        enum: "BuildersClub",
        stipend: 15
    },
    TBC: {
        label: "Turbo Builders Club",
        enum: "TurboBuildersClub",
        stipend: 35
    },
    OBC: {
        label: "Outrageous Builders Club",
        enum: "OutrageousBuildersClub",
        stipend: 60
    }
};

export type Tier = keyof typeof TIERS;

export const PRICES = {
    BC: {
        monthly: 500,
        annual: 6000
    },
    TBC: {
        monthly: 1100,
        annual: 13200
    },
    OBC: {
        monthly: 1900,
        annual: 22800
    }
};

export const isTier = (s: unknown): s is Tier => typeof s === "string" && s in TIERS;

export const membershipOf = (row: { membership?: string | null, membership_expires?: number | string | null }): Tier => {
    const tier = row.membership ?? "None";
    if (!isTier(tier)) {
        return "None";
    }
    const expires = Number(row.membership_expires ?? 0);
    return expires > 0 && expires < now() ? "None" : tier;
};

export const claimStipend = async (userId: number) => {
    const [row] = await sql`SELECT membership, membership_expires, last_stipend FROM users WHERE id = ${userId}`;
    if (!row) {
        return 0;
    }
    const stipend = TIERS[membershipOf(row)].stipend;
    const today = Math.floor(now() / 86400) * 86400;
    if (stipend === 0 || Number(row.last_stipend) >= today) {
        return 0;
    }
    const done = await sql`UPDATE users SET currency = currency + ${stipend}, last_stipend = ${now()} WHERE id = ${userId} AND last_stipend < ${today}`;
    return done.affectedRows ? stipend : 0;
};
