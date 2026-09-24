export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
    let res: Response;
    try {
        res = await fetch("/api" + path, init);
    } catch (err) {
        console.error(`api ${init.method} ${path} -> no response`, err);
        throw new ApiError(0, "Could not reach the server");
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        // elysia validation errors have summary, ours have error
        const message = data.error ?? data.summary ?? data.message ?? res.statusText;
        console.error(`api ${init.method} ${path} -> ${res.status}: ${message}`, data);
        throw new ApiError(res.status, message);
    }

    return data;
};

export const api = <T = any>(path: string, body?: unknown, method = body ? "POST" : "GET") =>
    request<T>(path, {
        method,
        headers: body ? {
            "Content-Type": "application/json"
        } : undefined,
        body: body ? JSON.stringify(body) : undefined
    });

export const apiForm = <T = any>(path: string, form: FormData, method = "POST") =>
    request<T>(path, {
        method,
        body: form
    });
