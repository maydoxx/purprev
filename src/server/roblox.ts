import { mediaPut } from "./media";

const TIMEOUT = 10000;

export const ROBLOX_TYPES: Record<number, string> = {
    2: "T-Shirt",
    8: "Hat",
    11: "Shirt",
    12: "Pants",
    18: "Face",
    19: "Gear",
    32: "Package",
    41: "Hat",
    42: "Hat",
    43: "Hat",
    44: "Hat",
    45: "Hat",
    46: "Hat",
    47: "Hat"
};

// torso, arms, legs, hats and accessories, face, mesh head
const BODY_TYPES = [27, 28, 29, 30, 31, 8, 41, 42, 43, 44, 45, 46, 47, 18, 17];

const fetchJson = async (url: string) => {
    const res = await fetch(url, {
        headers: {
            Accept: "application/json"
        },
        signal: AbortSignal.timeout(TIMEOUT)
    });
    if (!res.ok) {
        throw new Error(`roblox answered ${res.status}`);
    }
    return res.json() as Promise<any>;
};

export const lookupRobloxAsset = async (assetId: number) => {
    const details = await fetchJson(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    if (!details?.Name) {
        throw new Error(`Roblox does not know asset ${assetId}`);
    }
    return {
        name: String(details.Name).slice(0, 80),
        description: String(details.Description ?? ""),
        category: ROBLOX_TYPES[Number(details.AssetTypeId)] ?? null,
        thumbnail: await assetThumbnail(assetId)
    };
};

// thumbnails outlive the economy entry
export const assetThumbnail = async (assetId: number) => {
    const thumbs = await fetchJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`).catch(() => null);
    const thumb = thumbs?.data?.[0];
    return thumb?.state === "Completed" && thumb.imageUrl ? String(thumb.imageUrl) : "";
};

export const lookupRobloxBundle = async (bundleId: number) => {
    const details = await fetchJson(`https://catalog.roblox.com/v1/bundles/${bundleId}/details`);
    if (!details?.name) {
        throw new Error(`Roblox does not know bundle ${bundleId}`);
    }
    const thumbs = await fetchJson(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundleId}&size=420x420&format=Png`).catch(() => null);
    const thumb = thumbs?.data?.[0];
    // newer bundles carry dynamic heads, moods and animations the 2016 client cannot load
    const parts: number[] = [];
    for (const i of (details.items ?? []).filter((i: any) => i.type === "Asset")) {
        const d = await fetchJson(`https://economy.roblox.com/v2/assets/${i.id}/details`).catch(() => null);
        if (d && BODY_TYPES.includes(Number(d.AssetTypeId))) {
            parts.push(Number(i.id));
        }
    }
    return {
        name: String(details.name).slice(0, 80),
        description: String(details.description ?? ""),
        parts,
        thumbnail: thumb?.state === "Completed" && thumb.imageUrl ? String(thumb.imageUrl) : ""
    };
};

export const storeThumbnail = async (itemId: number, url: string) => {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(20000)
    }).catch(() => null);
    if (!res?.ok) {
        return;
    }
    const png = new Uint8Array(await res.arrayBuffer());
    if (png.length < 4 || png[0] !== 0x89 || png[1] !== 0x50) {
        return;
    }
    await mediaPut("catalog", itemId, "png", png);
};
