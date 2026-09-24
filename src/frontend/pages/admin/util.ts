export const rows = (d: any): any[] => Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.list) ? d.list : [];

export const total = (d: any) => Number(d?.total) || rows(d).length;

export const pages = (d: any) => Math.max(1, Number(d?.totalPages) || 1);

export const num = (n: any) => Number(n ?? 0).toLocaleString("en-US");

export type Flash = {
    type: string;
    message: string;
} | null;

export const adminDate = (t: any) => Number(t) > 0 ? new Date(Number(t) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
}) : "\u2014";

export const toInput = (t: any) => {
    if (!(Number(t) > 0)) return "";
    const d = new Date(Number(t) * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
