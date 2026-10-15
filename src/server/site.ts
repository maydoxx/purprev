
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const SITE_INTERNAL_URL = (process.env.SITE_INTERNAL_URL ?? SITE_URL).replace(/\/+$/, "");

// session cookies get the Secure flag whenever the site is served over https
export const COOKIE_SECURE = SITE_URL.startsWith("https://");

export const appearanceUrl = (userId: number) => `${SITE_URL}/Asset/CharacterFetch.ashx?userId=${userId}`;

export const assetUrl = (assetId: number) => `${SITE_URL}/asset/?id=${assetId}`;
