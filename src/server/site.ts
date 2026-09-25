// public url the client gets in join scripts, internal one is how rcc reaches us (lan, never through cloudflare)
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const SITE_INTERNAL_URL = (process.env.SITE_INTERNAL_URL ?? SITE_URL).replace(/\/+$/, "");

export const appearanceUrl = (userId: number) => `${SITE_URL}/Asset/CharacterFetch.ashx?userId=${userId}`;

export const assetUrl = (assetId: number) => `${SITE_URL}/asset/?id=${assetId}`;
