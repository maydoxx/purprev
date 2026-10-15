// keep only the network part of an address: enough to spot repeat offenders,
// not enough to single out a household
export const anonymizeIp = (ip: string): string => {
    const value = String(ip ?? "").trim();
    if (value === "" || value === "unknown") {
        return value;
    }
    if (value.includes(":")) {
        return value.split(":").slice(0, 4).join(":") + "::";
    }
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : value;
};

export const RETENTION_DAYS = {
    invite_log: 365,
    username_history: 365,
    admin_audit: 730,
    security_audit: 365,
    applications: 90
};
