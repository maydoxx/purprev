import { sql, now } from "./db";
import { RETENTION_DAYS } from "./utils/privacy";

const cutoff = (days: number) => now() - days * 86400;

// rows older than their retention window are dropped. a timestamp of 0 means
// the row predates the column and is left alone.
export const runRetention = async (): Promise<Record<string, number>> => {
    const jobs: [string, () => Promise<{ count: number }>][] = [
        ["admin_audit", () => sql`DELETE FROM admin_audit WHERE created_at > 0 AND created_at < ${cutoff(RETENTION_DAYS.admin_audit)}`],
        ["security_audit", () => sql`DELETE FROM security_audit WHERE created_at > 0 AND created_at < ${cutoff(RETENTION_DAYS.security_audit)}`],
        ["invite_log", () => sql`DELETE FROM invite_log WHERE created_at > 0 AND created_at < ${cutoff(RETENTION_DAYS.invite_log)}`],
        ["username_history", () => sql`DELETE FROM username_history WHERE changed_at > 0 AND changed_at < ${cutoff(RETENTION_DAYS.username_history)}`],
        ["applications", () => sql`DELETE FROM applications WHERE decided_at > 0 AND decided_at < ${cutoff(RETENTION_DAYS.applications)}`]
    ];

    const removed: Record<string, number> = {};
    for (const [table, job] of jobs) {
        try {
            const result = await job();
            if (result.count) {
                removed[table] = result.count;
            }
        } catch (err) {
            console.warn(`retention: ${table} failed`, err);
        }
    }
    return removed;
};

setInterval(() => {
    runRetention().catch(() => {});
}, 24 * 60 * 60 * 1000);
