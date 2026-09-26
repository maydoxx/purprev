export const bool = (value: boolean) => (value ? "true" : "false");


export const xml = (type: string, value: string | number | boolean) =>
    new Response(`<Value Type="${type}">${value}</Value>`, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8"
        }
    });

export const xmlBool = (value: boolean) => xml("boolean", bool(value));
