const MAGIC = "<roblox!";

// lz4 block, no frame
const lz4 = (src: Uint8Array, size: number) => {
    const out = new Uint8Array(size);
    let i = 0;
    let o = 0;
    while (i < src.length) {
        const token = src[i++]!;
        let literal = token >> 4;
        if (literal === 15) {
            let b;
            do {
                b = src[i++]!;
                literal += b;
            } while (b === 255);
        }
        out.set(src.subarray(i, i + literal), o);
        i += literal;
        o += literal;
        if (i >= src.length) {
            break;
        }
        const offset = src[i]! | (src[i + 1]! << 8);
        i += 2;
        let match = (token & 15) + 4;
        if ((token & 15) === 15) {
            let b;
            do {
                b = src[i++]!;
                match += b;
            } while (b === 255);
        }
        let from = o - offset;
        while (match-- > 0) {
            out[o++] = out[from++]!;
        }
    }
    return out;
};

type Chunk = {
    name: string;
    data: Uint8Array;
};

const chunks = (file: Uint8Array) => {
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
    const list: Chunk[] = [];
    let p = 32;
    while (p + 16 <= file.length) {
        const name = String.fromCharCode(...file.subarray(p, p + 4)).replace(/\0+$/, "");
        const packed = view.getUint32(p + 4, true);
        const size = view.getUint32(p + 8, true);
        const body = file.subarray(p + 16, p + 16 + (packed || size));
        list.push({
            name,
            data: packed ? lz4(body, size) : body
        });
        p += 16 + (packed || size);
        if (name === "END") {
            break;
        }
    }
    return list;
};

const str = (data: Uint8Array, p: number) => {
    const n = new DataView(data.buffer, data.byteOffset).getUint32(p, true);
    return {
        value: new TextDecoder().decode(data.subarray(p + 4, p + 4 + n)),
        next: p + 4 + n
    };
};

const interleaved = (data: Uint8Array, p: number, count: number, width: number) => {
    const values: bigint[] = [];
    for (let i = 0; i < count; i++) {
        let v = 0n;
        for (let j = 0; j < width; j++) {
            v = (v << 8n) | BigInt(data[p + j * count + i]!);
        }
        values.push(v);
    }
    return values;
};

const zigzag = (v: bigint) => (v >> 1n) ^ -(v & 1n);

export type CharacterMesh = {
    name: string;
    bodyPart: number;
    meshId: number;
    baseTextureId: number;
    overlayTextureId: number;
};

export const characterMesh = (file: Uint8Array): CharacterMesh | null => {
    if (new TextDecoder().decode(file.subarray(0, 8)) !== MAGIC) {
        return null;
    }
    const classes = new Map<number, string>();
    const counts = new Map<number, number>();
    const cm: Partial<CharacterMesh> = {};
    let found = false;
    for (const c of chunks(file)) {
        const view = new DataView(c.data.buffer, c.data.byteOffset);
        if (c.name === "INST") {
            const id = view.getUint32(0, true);
            const name = str(c.data, 4);
            classes.set(id, name.value);
            counts.set(id, view.getUint32(name.next + 1, true));
            if (name.value === "CharacterMesh") {
                found = true;
            }
        }
        if (c.name === "PROP") {
            const id = view.getUint32(0, true);
            if (classes.get(id) !== "CharacterMesh" || counts.get(id) !== 1) {
                continue;
            }
            const prop = str(c.data, 4);
            const type = c.data[prop.next]!;
            const p = prop.next + 1;
            if (prop.value === "Name" && type === 1) {
                cm.name = str(c.data, p).value;
            } else if (prop.value === "BodyPart" && type === 0x12) {
                cm.bodyPart = Number(interleaved(c.data, p, 1, 4)[0]);
            } else if (type === 0x1b || type === 3) {
                const v = Number(zigzag(interleaved(c.data, p, 1, type === 3 ? 4 : 8)[0]!));
                if (prop.value === "MeshId") {
                    cm.meshId = v;
                } else if (prop.value === "BaseTextureId") {
                    cm.baseTextureId = v;
                } else if (prop.value === "OverlayTextureId") {
                    cm.overlayTextureId = v;
                }
            }
        }
    }
    if (!found || cm.meshId === undefined || cm.bodyPart === undefined) {
        return null;
    }
    return {
        name: cm.name ?? "CharacterMesh",
        bodyPart: cm.bodyPart,
        meshId: cm.meshId,
        baseTextureId: cm.baseTextureId ?? 0,
        overlayTextureId: cm.overlayTextureId ?? 0
    };
};

const ENTITIES: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;"
};

const xml = (s: string) => s.replace(/[<>&"]/g, c => ENTITIES[c]!);

export const characterMeshXml = (cm: CharacterMesh) => `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
\t<External>null</External>
\t<External>nil</External>
\t<Item class="CharacterMesh" referent="RBX0">
\t\t<Properties>
\t\t\t<int name="BaseTextureId">${cm.baseTextureId}</int>
\t\t\t<token name="BodyPart">${cm.bodyPart}</token>
\t\t\t<int name="MeshId">${cm.meshId}</int>
\t\t\t<string name="Name">${xml(cm.name)}</string>
\t\t\t<int name="OverlayTextureId">${cm.overlayTextureId}</int>
\t\t</Properties>
\t</Item>
</roblox>
`;
