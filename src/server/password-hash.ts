import { sql } from "./db";

export type HashAlgorithm = "bcrypt" | "argon2id";

export const DEFAULT_HASH_ALGORITHM: HashAlgorithm = "argon2id";

export const SUPPORTED_ALGORITHMS: HashAlgorithm[] = ["bcrypt", "argon2id"];

export const hashPassword = async (password: string, algorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM): Promise<string> => {
    switch (algorithm) {
        case "argon2id":
            // bun's types do not cover the argon2id options yet
            return Bun.password.hash(password, {
                algorithm: "argon2id",
                memory: 65536,
                iterations: 3,
                parallelism: 4
            } as any);
        case "bcrypt":
        default:
            return Bun.password.hash(password, "bcrypt");
    }
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    try {
        return await Bun.password.verify(password, hash);
    } catch {
        return false;
    }
};

export const needsRehash = (hash: string): boolean => {
    if (hash.startsWith("$2b$") || hash.startsWith("$2a$") || hash.startsWith("$2y$")) {
        return (DEFAULT_HASH_ALGORITHM as HashAlgorithm) !== "bcrypt";
    }
    if (hash.startsWith("$argon2id$")) {
        return false;
    }
    return true;
};

export const getHashAlgorithm = (hash: string): HashAlgorithm | "unknown" => {
    if (hash.startsWith("$2b$") || hash.startsWith("$2a$") || hash.startsWith("$2y$")) {
        return "bcrypt";
    }
    if (hash.startsWith("$argon2id$")) {
        return "argon2id";
    }
    return "unknown";
};

// called on a successful login, the plaintext is only available here
export const verifyAndMaybeRehash = async (
    userId: number,
    password: string,
    storedHash: string
): Promise<{ verified: boolean; newHash?: string }> => {
    if (!(await verifyPassword(password, storedHash))) {
        return { verified: false };
    }
    if (needsRehash(storedHash)) {
        return { verified: true, newHash: await hashPassword(password) };
    }
    return { verified: true };
};

export const updateUserPasswordHash = async (userId: number, newHash: string): Promise<void> => {
    await sql`UPDATE users SET password = ${newHash} WHERE id = ${userId}`;
};
