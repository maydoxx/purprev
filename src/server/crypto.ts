// session tokens are stored as a hash so a leaked database cannot be replayed
export const digestToken = async (token: string): Promise<string> =>
    Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
        byte => byte.toString(16).padStart(2, "0")
    ).join("");

// message text is encrypted at rest with a key derived from DATA_KEY. without
// the key the helpers pass text through, so a fresh install still works.
const PREFIX = "v1:";
const secret = process.env.DATA_KEY ?? "";

const key: CryptoKey | null = secret
    ? await crypto.subtle.importKey(
        "raw",
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    )
    : null;

const toB64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const fromB64 = (value: string) => new Uint8Array(Buffer.from(value, "base64"));

export const encryptText = async <T extends string | null | undefined>(value: T): Promise<T> => {
    if (!key || !value) {
        return value;
    }
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(value));
    return (PREFIX + toB64(nonce) + ":" + toB64(new Uint8Array(cipher))) as T;
};

export const decryptText = async <T extends string | null | undefined>(value: T): Promise<T> => {
    if (!key || typeof value !== "string" || !value.startsWith(PREFIX)) {
        return value;
    }
    try {
        const [nonce, cipher] = value.slice(PREFIX.length).split(":");
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(nonce!) }, key, fromB64(cipher!));
        return new TextDecoder().decode(plain) as T;
    } catch {
        return value;
    }
};
