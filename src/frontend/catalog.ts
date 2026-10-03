export const n = (v: unknown) => Number(v ?? 0).toLocaleString("en-US");

export const ago = (at: number) => {
    const secs = Math.max(0, Math.floor(Date.now() / 1000) - Number(at));
    const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"} ago`;
    const day = 86400;
    if (secs < 60) {
        return "just now";
    }
    if (secs < 3600) {
        return unit(Math.floor(secs / 60), "minute");
    }
    if (secs < day) {
        return unit(Math.floor(secs / 3600), "hour");
    }
    if (secs < 7 * day) {
        return unit(Math.floor(secs / day), "day");
    }
    if (secs < 30 * day) {
        return unit(Math.floor(secs / (7 * day)), "week");
    }
    if (secs < 365 * day) {
        return unit(Math.floor(secs / (30 * day)), "month");
    }
    return unit(Math.floor(secs / (365 * day)), "year");
};

export const shortDate = (at: number) => {
    const d = new Date(Number(at) * 1000);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US");
};

export const itemUrl = (item: { id: number }) => `/catalog/item?id=${item.id}`;

export const thumb = (item: { thumbnail?: string }) => item.thumbnail || "/img/pending.png";

export const isLimited = (item: any) => !!(item.is_limited || item.is_limited_unique);

export const isNew = (item: any) => Number(item.created_at) * 1000 > Date.now() - 14 * 86400 * 1000;

export const remaining = (item: any) => item.is_limited_unique && item.limited_stock !== null
    ? Math.max(0, Number(item.limited_stock) - Number(item.limited_sold))
    : null;

export const soldOut = (item: any) => remaining(item) === 0;

export const onSale = (item: any) => (item.price !== null || item.tix_price !== null) && !soldOut(item);
