<script lang="ts">
    import { api, apiForm } from "../api";
    import { router } from "../router.svelte";

    const SIZES: [string, number, number, string][] = [
        ["banner", 728, 90, "Banner"],
        ["skyscraper", 160, 600, "Skyscraper"],
        ["rectangle", 300, 250, "Rectangle"]
    ];

    let targets = $state<[string, string, any[]][]>([]);
    let loaded = $state(false);
    let target = $state("");
    let fixed = $state<any>(null);
    let name = $state("");
    let file = $state<File | null>(null);
    let size = $state("");
    let error = $state("");
    let busy = $state(false);

    const total = $derived(targets.reduce((n, [, , list]) => n + list.length, 0));
    const detected = $derived(SIZES.find(s => s[0] === size));

    api("/ads/targets").then(d => {
        targets = [
            ["Places", "game", d.games],
            ["Groups", "group", d.groups],
            ["Items", "item", d.items]
        ];
        const wanted = `${router.query.targetType ?? ""}:${router.query.targetId ?? ""}`;
        for (const [, type, list] of targets) {
            const hit = list.find(t => `${type}:${t.id}` === wanted);
            if (hit) {
                target = wanted;
                fixed = hit;
            }
        }
        if (!target) {
            const first = targets.find(([, , list]) => list.length > 0);
            target = first ? `${first[1]}:${first[2][0].id}` : "";
        }
    }).catch(err => error = err.message).finally(() => loaded = true);

    const pick = async (e: Event) => {
        file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
        size = "";
        error = "";
        if (!file) {
            return;
        }
        try {
            const image = await createImageBitmap(file);
            const match = SIZES.find(([, w, h]) => w === image.width && h === image.height);
            if (match) {
                size = match[0];
            } else {
                error = `Ads must be 728x90, 160x600 or 300x250 pixels (this one is ${image.width}x${image.height}).`;
            }
            image.close();
        } catch {
            error = "That file is not an image.";
        }
    };

    const upload = async (e: Event) => {
        e.preventDefault();
        error = "";
        if (!target) {
            error = "Pick what you want to advertise.";
            return;
        }
        if (!file || !size) {
            error = error || "Choose an ad image to upload.";
            return;
        }
        if (!name.trim()) {
            error = "Give your ad a name.";
            return;
        }
        const [type, id] = target.split(":");
        const form = new FormData();
        form.append("name", name.trim());
        form.append("size", size);
        form.append("target_type", type!);
        form.append("target_id", id!);
        form.append("image", file);
        busy = true;
        try {
            await apiForm("/ads/create", form);
            router.go("/my/user-ads");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };
</script>

<svelte:head>
    <title>Create a User Ad - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
    <link rel="stylesheet" href="/css/ads.css">
</svelte:head>

<main class="develop-page">
    <div class="develop-container">
        <h1 class="develop-title">Create a User Ad</h1>
        <div class="create-ad">
            <h2>Instructions</h2>
            <p>On NoneRev, users can bid Nonebux or Tix to buy advertising for their places, groups and items.</p>
            <p>Download, Edit, and Upload one of the following templates:</p>
            <ul class="create-ad-templates">
                {#each SIZES as [key, w, h, label]}
                    <li>
                        <span>{w} x {h} {label}</span>
                        <a class="develop-control" href="/img/ads/{key}-template.png" download="{key}-template.png">Download</a>
                    </li>
                {/each}
            </ul>

            <form class="create-ad-form" onsubmit={upload}>
                <div class="create-ad-row">
                    <span>Advertise</span>
                    {#if fixed}
                        <a href={fixed.url}>{fixed.name}</a>
                    {:else if loaded && total === 0}
                        <span class="create-ad-size">You have nothing to advertise yet. Create a place, an item or a group first.</span>
                    {:else}
                        <select bind:value={target} disabled={busy || !loaded}>
                            {#each targets as [label, type, list]}
                                {#if list.length}
                                    <optgroup {label}>
                                        {#each list as t}
                                            <option value="{type}:{t.id}">{t.name}</option>
                                        {/each}
                                    </optgroup>
                                {/if}
                            {/each}
                        </select>
                    {/if}
                </div>
                <div class="create-ad-row">
                    <label for="ad-image">Upload an Ad</label>
                    <input id="ad-image" type="file" accept="image/png,image/jpeg,image/gif" disabled={busy} onchange={pick}>
                    {#if detected}
                        <span class="create-ad-size">{detected[1]} x {detected[2]} {detected[3]}</span>
                    {/if}
                </div>
                <div class="create-ad-row">
                    <label for="ad-name">Name Your Ad</label>
                    <input id="ad-name" type="text" maxlength="50" disabled={busy} bind:value={name}>
                </div>
                {#if error}
                    <p class="develop-error">{error}</p>
                {/if}
                <button class="develop-btn" type="submit" disabled={busy || (loaded && total === 0)}>Upload</button>
            </form>
            <p class="create-ad-note">The ad needs to be approved by a moderator before it can be launched from your <a href="/my/user-ads">User Ads</a> page.</p>
        </div>
    </div>
</main>
