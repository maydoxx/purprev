const SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY ?? "";

export const turnstileOn = () => SECRET !== "" && TURNSTILE_SITE_KEY !== "";

export const verifyTurnstile = async (token: string | undefined, ip: string) => {
    if (!turnstileOn()) {
        return true;
    }
    if (!token) {
        return false;
    }
    try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                secret: SECRET,
                response: token,
                remoteip: ip
            }),
            signal: AbortSignal.timeout(10000)
        });
        const data = await res.json() as any;
        if (!data.success) {
            console.warn("turnstile:", (data["error-codes"] ?? []).join(", "));
        }
        return !!data.success;
    } catch (err) {
        console.warn("turnstile:", err instanceof Error ? err.message : err);
        return false;
    }
};
