export const n = (v: unknown) => Number(v ?? 0).toLocaleString("en-US");

export const ago = (at: number) => {
    const secs = Math.max(0, Math.floor(Date.now() / 1000) - Number(at));
    const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"} ago`;
    const day = 86400;
    if (secs < 60) {
        return "just now";
    }
    if (secs < 3600) {
        return unit(Math.floor(secs / 60), "minute");
    }
    if (secs < day) {
        return unit(Math.floor(secs / 3600), "hour");
    }
    if (secs < 7 * day) {
        return unit(Math.floor(secs / day), "day");
    }
    if (secs < 30 * day) {
        return unit(Math.floor(secs / (7 * day)), "week");
    }
    if (secs < 365 * day) {
        return unit(Math.floor(secs / (30 * day)), "month");
    }
    return unit(Math.floor(secs / (365 * day)), "year");
};

export const shortDate = (at: number) => {
    const d = new Date(Number(at) * 1000);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US");
};

export const itemUrl = (item: { id: number }) => `/catalog/item?id=${item.id}`;

export const thumb = (item: { thumbnail?: string }) => item.thumbnail || "/img/pending.png";

export const isLimited = (item: any) => !!(item.is_limited || item.is_limited_unique);

export const isNew = (item: any) => Number(item.created_at) * 1000 > Date.now() - 14 * 86400 * 1000;

export const remaining = (item: any) => item.is_limited_unique && item.limited_stock !== null
    ? Math.max(0, Number(item.limited_stock) - Number(item.limited_sold))
    : null;

export const soldOut = (item: any) => remaining(item) === 0;

export const onSale = (item: any) => (item.price !== null || item.tix_price !== null) && !soldOut(item);

const text = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

export const scene3d = (url: string, done: (ok: boolean) => void) => (canvas: HTMLCanvasElement) => {
    let frame = 0;
    let stopped = false;
    let dispose = () => {};

    const show = async () => {
        const [THREE, { OBJLoader }, { MTLLoader }, { OrbitControls }] = await Promise.all([
            import("three"),
            import("three/addons/loaders/OBJLoader.js"),
            import("three/addons/loaders/MTLLoader.js"),
            import("three/addons/controls/OrbitControls.js")
        ]);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`3d ${res.status}`);
        }
        const data = await res.json();
        const files = data.files ?? {};
        if (stopped || !files["scene.obj"] || !files["scene.mtl"]) {
            throw new Error("no scene");
        }

        // the mtl names its textures, the loader asks for them by that name
        const textures: Record<string, string> = {};
        for (const [name, file] of Object.entries<any>(files)) {
            if (name.endsWith(".png")) {
                textures[name] = `data:image/png;base64,${file.content}`;
            }
        }
        const manager = new THREE.LoadingManager();
        manager.setURLModifier(u => textures[u.split("/").pop() ?? ""] ?? u);
        const materials = new MTLLoader(manager).parse(text(files["scene.mtl"].content), "");
        materials.preload();
        const model = new OBJLoader(manager).setMaterials(materials).parse(text(files["scene.obj"].content));

        const vec = (v: any) => new THREE.Vector3(Number(v?.x) || 0, Number(v?.y) || 0, Number(v?.z) || 0);
        const scene = new THREE.Scene();
        const sun = new THREE.DirectionalLight(0xffffff, 1.4);
        sun.position.set(1, 2, 2);
        scene.add(new THREE.AmbientLight(0xffffff, 1.6), sun, model);
        const center = new THREE.Box3(vec(data.AABB?.min), vec(data.AABB?.max)).getCenter(new THREE.Vector3());
        const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
        camera.position.copy(vec(data.camera?.position));
        camera.lookAt(center);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(canvas.width, canvas.height, false);
        const controls = new OrbitControls(camera, canvas);
        controls.target.copy(center);
        controls.enablePan = false;
        controls.update();
        dispose = () => {
            controls.dispose();
            renderer.dispose();
        };

        const loop = () => {
            controls.update();
            renderer.render(scene, camera);
            frame = requestAnimationFrame(loop);
        };
        loop();
        done(true);
    };

    show().catch(() => {
        if (!stopped) {
            done(false);
        }
    });

    return () => {
        stopped = true;
        cancelAnimationFrame(frame);
        dispose();
    };
};
