export const bool = (value: boolean) => (value ? "true" : "false");

// <Value Type="boolean">, what SocialService and GamePassService read
export const xmlBool = (value: boolean) =>
    new Response(`<Value Type="boolean">${bool(value)}</Value>`, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8"
        }
    });
