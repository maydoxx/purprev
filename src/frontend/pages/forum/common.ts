export const list = (x: unknown): any[] => Array.isArray(x) ? x : [];
export const num = (n: unknown) => Number(n || 0).toLocaleString("en-US");
export const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
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

export const postDate = (t: number, loggedIn: boolean) => {
    if (!t) return "N/A";
    if (!loggedIn) return fullDate(t);
    const d = new Date(t * 1000);
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()} ${clock(d)}`;
};

export const shortDate = (t: number) => {
    if (!t) return "N/A";
    const d = new Date(t * 1000);
    return `${pad(d.getDate())} ${month(d)} ${d.getFullYear()}`;
};

export const searchDate = (t: number) => {
    if (!t) return "N/A";
    const d = new Date(t * 1000);
    const time = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${time}`;
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

export const pageList = (cur: number, last: number) => {
    const pages = new Set([1, 2, 3, cur - 1, cur, cur + 1, last - 1, last]);
    return [...pages].filter(p => p >= 1 && p <= last).sort((a, b) => a - b);
};

export const replies = (thread: any) => Math.max(0, Number(thread.post_count || 0) - 1);

export const threadIcon = (thread: any, seen: boolean) => {
    const popular = replies(thread) >= 20 || Number(thread.views || 0) >= 1000;
    const kind = popular ? "popular" : "thread";
    return {
        src: `/img/forum/${kind}-${seen ? "seen" : "unread"}.png`,
        title: `${popular ? "Popular post" : "Post"} (${seen ? "Read" : "Not Read"})`
    };
};

const seenKey = "forum_seen_threads";

export const seenThreads = (): Set<number> => {
    try {
        return new Set(JSON.parse(sessionStorage.getItem(seenKey) ?? "[]"));
    } catch {
        return new Set();
    }
};

export const markSeen = (...threadIds: number[]) => {
    try {
        const seen = seenThreads();
        for (const id of threadIds) {
            seen.add(id);
        }
        sessionStorage.setItem(seenKey, JSON.stringify([...seen]));
    } catch {}
};
