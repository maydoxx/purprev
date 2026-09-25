import { createSign } from "crypto";
import { readFileSync } from "fs";

// the public half is baked into the 2016 client and rcc, everything they fetch has to be signed with this
const load = (env: string, fallback: string) => {
    const path = process.env[env] ?? fallback;
    try {
        return readFileSync(path, "utf8");
    } catch {
        console.warn(`${env}: cannot read ${path}, join scripts will fail`);
        return "";
    }
};

const JOIN_KEY = load("JOIN_PRIVATE_KEY", "keys/PrivateKey.pem");
const STUDIO_KEY = load("STUDIO_PRIVATE_KEY", "keys/StudioPrivateKey.pem") || JOIN_KEY;

export const sign = (data: string, key = JOIN_KEY) => {
    if (!key) {
        throw new Error("no signing key");
    }
    return createSign("RSA-SHA1").update(data).sign(key, "base64");
};

// what the client and rcc expect: --rbxsig%<sig>%\r\n<body>, the \r\n is part of the signed bytes
export const rbxsig = (body: string) => "--rbxsig%" + sign("\r\n" + body) + "%\r\n" + body;

export const studiosig = (body: string) => "%" + sign("\r\n" + body, STUDIO_KEY) + "%\r\n" + body;

export const text = (body: string) =>
    new Response(body, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8"
        }
    });
