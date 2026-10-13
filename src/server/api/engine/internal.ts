// extra proxies besides local caddy, e.g. TRUSTED_PROXIES=172.18.0.1
const TRUSTED = (process.env.TRUSTED_PROXIES ?? "").split(",").map(s => s.trim()).filter(Boolean);

const strip = (raw: string) => raw.trim().replace(/^\[|\]$/g, "");

const mappedV4 = (ip: string) => {
    const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
    return m ? m[1]! : null;
};

const privateV4 = (ip: string) => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if (!m) {
        return false;
    }
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (m.slice(1).some(o => Number(o) > 255)) {
        return false;
    }
    if (a === 0 || a === 127 || a === 10) {
        return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    if (a === 169 && b === 254) {
        return true;
    }
    // carrier grade nat
    return a === 100 && b >= 64 && b <= 127;
};

const isPrivate = (raw: string) => {
    const ip = strip(raw);
    if (!ip) {
        return false;
    }
    if (ip.includes(":")) {
        const mapped = mappedV4(ip);
        if (mapped) {
            return privateV4(mapped);
        }
        const low = ip.toLowerCase();
        if (low === "::" || low === "::1") {
            return true;
        }
        // unique local addresses fc00::/7
        return /^f[cd][0-9a-f]{0,2}:/.test(low);
    }
    return privateV4(ip);
};

const isLoopback = (raw: string) => {
    const ip = strip(raw);
    const mapped = mappedV4(ip);
    if (mapped) {
        return privateV4(mapped) && mapped.startsWith("127.");
    }
    if (ip.includes(":")) {
        return ip.toLowerCase() === "::1";
    }
    return ip.startsWith("127.");
};

// a proxy we allow to set x-forwarded-for: local caddy (loopback peer) or the
// docker bridge gateway when the api runs in a container behind that caddy.
// both are on the private network, which is also what makes a client "internal".
// this assumes the api is never published to the public internet; if it is, the
// port mapping would show every caller as the gateway and xff could be spoofed.
const trustedProxy = (peer: string) =>
    isLoopback(peer) || isPrivate(peer) || TRUSTED.includes(peer.replace(/^::ffff:/, ""));

// game servers call directly, forwarded means outside unless a trusted proxy says so
export const isInternal = (request: Request, server: any) => {
    if (request.headers.has("cf-connecting-ip")) {
        return false;
    }
    const peer: string = server?.requestIP?.(request)?.address ?? "";
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return trustedProxy(peer) && isPrivate(forwarded.split(",").pop()!);
    }
    return isPrivate(peer);
};
