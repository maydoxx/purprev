import { Elysia } from "elysia";

const CSP_POLICY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://challenges.cloudflare.com wss:",
    "frame-src https://challenges.cloudflare.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
].join("; ");

export const securityHeaders = new Elysia({ name: "security-headers" })
    .onAfterHandle({ as: "global" }, ({ response, request, set }) => {
        if (!response) return;

        const headers: Record<string, string> = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp"
        };

        // only for html, a csp on json breaks nothing but helps nobody
        const contentType = (response as any).headers?.get?.("content-type") || "";
        const accept = request.headers.get("accept") || "";
        const isHtml = contentType.includes("text/html") || accept.includes("text/html");

        if (isHtml) {
            headers["Content-Security-Policy"] = CSP_POLICY;
        }

        if (process.env.NODE_ENV === "production" && request.url.startsWith("https://")) {
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
        }

        headers["server"] = "";
        headers["x-powered-by"] = "";

        set.headers = {
            ...(set.headers as Record<string, string>),
            ...headers
        };
    });