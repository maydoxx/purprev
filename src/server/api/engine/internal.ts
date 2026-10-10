const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/;

const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

// extra proxies besides local caddy, e.g. TRUSTED_PROXIES=172.18.0.1
const TRUSTED = (process.env.TRUSTED_PROXIES ?? "").split(",").map(s => s.trim()).filter(Boolean);

const trustedProxy = (peer: string) => LOOPBACK.test(peer) || TRUSTED.includes(peer.replace(/^::ffff:/, ""));

// game servers call directly, forwarded means outside unless a trusted proxy says so
export const isInternal = (request: Request, server: any) => {
    if (request.headers.has("cf-connecting-ip")) {
        return false;
    }
    const peer: string = server?.requestIP?.(request)?.address ?? "";
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return trustedProxy(peer) && PRIVATE.test(forwarded.split(",").pop()!.trim());
    }
    return PRIVATE.test(peer);
};
