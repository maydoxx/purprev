export const list = (x: unknown): any[] => Array.isArray(x) ? x : [];
export const num = (n: unknown) => Number(n || 0).toLocaleString("en-US");
export const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
export const forumUrl = (id: number) => `/forum/show?ForumID=${id}`;
export const threadUrl = (id: number) => `/forum/thread?PostID=${id}`;
export const pageNum = (v: string | undefined) => Math.max(1, Number(v) || 1);

const pad = (n: number) => String(n).padStart(2, "0");
const month = (d: Date) => d.toLocaleDateString("en-US", {
    month: "short"
});
const clock = (d: Date) => d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
});

export const fullDate = (t: number) => {
    if (!t) return "N/A";
    const d = new Date(t * 1000);
    return `${pad(d.getDate())} ${month(d)} ${d.getFullYear()} ${clock(d)}`;
};

export const shortDate = (t: number) => {
    if (!t) return "N/A";
    const d = new Date(t * 1000);
    return `${pad(d.getDate())} ${month(d)} ${d.getFullYear()}`;
};

export const activityTime = (t: number) => {
    if (!t) return "N/A";
    const d = new Date(t * 1000);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return clock(d);

    const secs = Math.max(0, Math.floor(now.getTime() / 1000) - t);
    const ago = (n: number, unit: string) => n === 1 ? `a ${unit} ago` : `${n} ${unit}s ago`;
    const day = 86400;
    if (secs < 7 * day) return ago(Math.max(1, Math.floor(secs / day)), "day");
    if (secs < 30 * day) return ago(Math.max(1, Math.floor(secs / (7 * day))), "week");
    if (secs < 365 * day) return ago(Math.max(1, Math.floor(secs / (30 * day))), "month");
    return ago(Math.max(1, Math.floor(secs / (365 * day))), "year");
};

export const currentTime = () => new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
});


const seenKey = "forum_seen_threads";

export const seenThreads = (): Set<number> => {
    try {
        return new Set(JSON.parse(sessionStorage.getItem(seenKey) ?? "[]"));
    } catch {
        return new Set();
    }
};

export const markSeen = (threadId: number) => {
    try {
        const seen = seenThreads();
        seen.add(threadId);
        sessionStorage.setItem(seenKey, JSON.stringify([...seen]));
    } catch {}
};
