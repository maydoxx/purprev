<script lang="ts">
    import { onMount } from "svelte";
    import * as THREE from "three";
    import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
    import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";

    let { userId, size = 300 }: { userId: number; size?: number } = $props();

    let canvas: HTMLCanvasElement;
    let state = $state<"loading" | "ready" | "missing" | "error">("loading");

    const text = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    const vec = (v: any) => new THREE.Vector3(Number(v?.x) || 0, Number(v?.y) || 0, Number(v?.z) || 0);

    onMount(() => {
        let frame = 0;
        let renderer: THREE.WebGLRenderer | null = null;
        let controls: OrbitControls | null = null;

        const load = async () => {
            const res = await fetch(`/api/user/avatar3d?userId=${userId}`, {
                cache: "no-store"
            });
            if (res.status === 404) {
                state = "missing";
                return;
            }
            if (!res.ok) {
                throw new Error(`avatar3d ${res.status}`);
            }
            const data = await res.json();
            const files = data.files ?? {};
            if (!files["scene.obj"] || !files["scene.mtl"]) {
                throw new Error("scene without obj");
            }

            // textures are named in the mtl, the loader asks for them by that name
            const textures: Record<string, string> = {};
            for (const [name, file] of Object.entries<any>(files)) {
                if (name.endsWith(".png")) {
                    textures[name] = `data:image/png;base64,${file.content}`;
                }
            }
            const manager = new THREE.LoadingManager();
            manager.setURLModifier(url => textures[url.split("/").pop() ?? ""] ?? url);

            const materials = new MTLLoader(manager).parse(text(files["scene.mtl"].content), "");
            materials.preload();
            const model = new OBJLoader(manager).setMaterials(materials).parse(text(files["scene.obj"].content));

            const scene = new THREE.Scene();
            scene.add(new THREE.AmbientLight(0xffffff, 1.6));
            const sun = new THREE.DirectionalLight(0xffffff, 1.4);
            sun.position.set(1, 2, 2);
            scene.add(sun);
            scene.add(model);

            const box = new THREE.Box3(vec(data.AABB?.min), vec(data.AABB?.max));
            const center = box.getCenter(new THREE.Vector3());
            const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
            camera.position.copy(vec(data.camera?.position));
            camera.lookAt(center);

            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true
            });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(size, size, false);

            controls = new OrbitControls(camera, canvas);
            controls.target.copy(center);
            controls.enablePan = false;
            controls.minDistance = 2;
            controls.maxDistance = 40;
            controls.update();

            state = "ready";
            const loop = () => {
                controls?.update();
                renderer?.render(scene, camera);
                frame = requestAnimationFrame(loop);
            };
            loop();
        };

        load().catch(() => {
            state = "error";
        });

        return () => {
            cancelAnimationFrame(frame);
            controls?.dispose();
            renderer?.dispose();
        };
    });
</script>

<div class="avatar-3d" style="width: {size}px; height: {size}px;">
    <canvas bind:this={canvas} width={size} height={size} hidden={state !== "ready"}></canvas>
    {#if state === "loading"}
        <span class="avatar-3d-note">Loading 3D...</span>
    {:else if state === "missing"}
        <span class="avatar-3d-note">No 3D view yet. It shows up after the next re-draw.</span>
    {:else if state === "error"}
        <span class="avatar-3d-note">The 3D view could not be loaded.</span>
    {/if}
</div>
