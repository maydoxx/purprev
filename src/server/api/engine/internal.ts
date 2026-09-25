// game servers hit the site on the lan url straight at bun, players come through caddy which always adds x-forwarded-for
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/;

export const isInternal = (request: Request, server: any) => {
    if (request.headers.has("x-forwarded-for") || request.headers.has("cf-connecting-ip")) {
        return false;
    }
    const ip = server?.requestIP?.(request)?.address ?? "";
    return PRIVATE.test(ip);
};
