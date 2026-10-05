export const imageSize = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
        return {
            type: "png",
            width: view.getUint32(16),
            height: view.getUint32(20)
        };
    }
    if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return {
            type: "gif",
            width: view.getUint16(6, true),
            height: view.getUint16(8, true)
        };
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < bytes.length) {
            if (bytes[offset] !== 0xff) {
                return null;
            }
            const marker = bytes[offset + 1]!;

            if (marker === 0xff) {
                offset += 1;
                continue;
            }
            if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
                offset += 2;
                continue;
            }
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return {
                    type: "jpg",
                    width: view.getUint16(offset + 7),
                    height: view.getUint16(offset + 5)
                };
            }
            offset += 2 + view.getUint16(offset + 2);
        }
    }
    return null;
};
