import { sql, now } from "./db";
import { clientIp } from "./invites";
import type { User } from "./session";

// never store credentials in the audit trail
const SECRET = /pass|secret|token|authorization|api[_-]?key|turnstile|csrf|cookie/i;

const clean = (value: unknown, depth = 0): unknown => {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (depth > 3) {
        return "[deep]";
    }
    if (Array.isArray(value)) {
        return value.slice(0, 50).map(v => clean(v, depth + 1));
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        out[key] = SECRET.test(key) ? "[redacted]" : clean(val, depth + 1);
    }
    return out;
};

const detailsOf = (body: unknown) => {
    if (body === undefined || body === null || body === "") {
        return "";
    }
    try {
        const text = JSON.stringify(clean(body));
        return !text || text === "{}" ? "" : text.slice(0, 4000);
    } catch {
        return "";
    }
};

const targetOf = (path: string) => path.replace(/^\/api\//, "").slice(0, 120);

const isAdminArea = (path: string) => path === "/api/admin" || path.startsWith("/api/admin/");

// should this request show up in the admin audit log?
export const auditRelevant = (user: User | null, method: string, path: string) =>
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS" &&
    (isAdminArea(path) || !!user && user.admin >= 1);

export const recordAdminAudit = async (entry: {
    user: User | null;
    request: Request;
    server?: any;
    body?: unknown;
    status?: number;
}) => {
    try {
        const path = new URL(entry.request.url).pathname;
        await sql`
            INSERT INTO admin_audit (admin_id, admin_name, method, path, target, status, ip, details, created_at)
            VALUES (
                ${entry.user?.id ?? 0},
                ${(entry.user?.username ?? "").slice(0, 50)},
                ${entry.request.method.slice(0, 10)},
                ${path.slice(0, 255)},
                ${targetOf(path)},
                ${Number(entry.status ?? 0)},
                ${clientIp(entry.request, entry.server)},
                ${detailsOf(entry.body)},
                ${now()}
            )
        `;
    } catch {
        // auditing must never break the request it is recording
    }
};

// Security audit log for sensitive user actions (password change, etc.)
export type SecurityEventType =
    | "password_change"
    | "login"
    | "logout"
    | "failed_login"
    | "mfa_change"
    | "session_revoked"
    | "account_deleted"
    | "account_deletion_failed"
    | "data_export"
    | "data_export_failed"
    | "data_rectified"
    | "processing_restricted"
    | "processing_restriction_lifted"
    | "processing_objected"
    | "processing_objection_withdrawn";

export const recordSecurityAudit = async (entry: {
    userId: number;
    username: string;
    event: SecurityEventType;
    request: Request;
    server?: any;
    success: boolean;
    details?: string;
}) => {
    try {
        const path = new URL(entry.request.url).pathname;
        await sql`
            INSERT INTO security_audit (user_id, username, event, method, path, success, ip, details, created_at)
            VALUES (
                ${entry.userId},
                ${entry.username.slice(0, 50)},
                ${entry.event},
                ${entry.request.method.slice(0, 10)},
                ${path.slice(0, 255)},
                ${entry.success ? 1 : 0},
                ${clientIp(entry.request, entry.server)},
                ${entry.details ?? ""},
                ${now()}
            )
        `;
    } catch {
        // auditing must never break the request
    }
};
