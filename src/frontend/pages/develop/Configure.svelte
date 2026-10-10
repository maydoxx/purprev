<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, placeIcon } from "./develop";
    import { checkPlaceFile, uploadPlace, placeLimitLabel } from "./upload";

    const id = $derived(Number(router.query.id) || 0);

    const tabs: [string, string][] = [
        ["basic", "Basic Settings"],
        ["icon", "Game Icon"],
        ["thumbnail", "Thumbnails"],
        ["access", "Access"],
        ["permissions", "Permissions"],
        ["versions", "Version History"],
        ["file", "Place File"],
        ["delete", "Delete Place"]
    ];

    const GENRES = [
        "All",
        "Town and City",
        "Medieval",
        "Sci-Fi",
        "Fighting",
        "Horror",
        "Naval",
        "Adventure",
        "Sports",
        "Comedy",
        "Western",
        "Military",
        "Building",
        "FPS",
        "RPG"
    ];

    const GEAR: [string, string][] = [
        ["MeleeWeapon", "Melee Weapons"],
        ["PowerUp", "Power Ups"],
        ["RangedWeapon", "Ranged Weapons"],
        ["NavigationEnhancer", "Navigation Enhancers"],
        ["Explosive", "Explosives"],
        ["MusicalInstrument", "Musical Instruments"],
        ["SocialItem", "Social Items"],
        ["PersonalTransport", "Personal Transport"],
        ["BuildingTool", "Building Tools"]
    ];

    const ACCESS: [string, string][] = [
        ["everyone", "Everyone"],
        ["friends", "Friends"],
        ["private", "Private"]
    ];

    const status = router.query.status;

    let place = $state<any>({});
    let title = $state("");
    let avatarType = $state("R6");
    let description = $state("");
    let genre = $state("All");
    let maxPlayers = $state(10);
    let playerLimit = $state(30);
    let allowedGear = $state<string[]>([]);
    let copylocked = $state(true);
    let access = $state("everyone");
    let versions = $state<any[]>([]);
    let current = $state<any>(null);
    let restoring = $state(0);
    let error = $state("");
    let success = $state("");
    let uploadLabel = $state("");
    let placeFiles = $state<FileList | null>(null);
    let thumbFiles = $state<FileList | null>(null);
    let iconFiles = $state<FileList | null>(null);
    let tab = $state(status === "created" || status === "upload-failed" ? "file" : "basic");

    const hasFile = $derived(!!place.has_file);

    if (status === "created") {
        success = "Place created. Upload its .rbxl file below.";
    }
    if (status === "uploaded") {
        success = "Place file uploaded.";
    }
    if (status === "upload-failed") {
        error = "The place was created, but its file upload failed. Retry below.";
    }

    const fill = (hit: any) => {
        title = hit.title;
        avatarType = hit.avatar_type ?? "R6";
        description = hit.description ?? "";
        genre = GENRES.includes(hit.genre) ? hit.genre : "All";
        maxPlayers = Number(hit.max_players) || 10;
        allowedGear = Array.isArray(hit.allowed_gear) ? hit.allowed_gear : String(hit.allowed_gear ?? "").split(",").filter(Boolean);
        copylocked = hit.copylocked === undefined ? true : !!hit.copylocked;
        access = hit.access ?? "everyone";
    };

    const load = async () => {
        const list = rows(await api("/develop/places").catch(() => null));
        const hit = list.find(p => p.id === id);
        if (hit) {
            place = hit;
            fill(hit);
        } else if (list.length > 0) {
            router.replace("/develop/places");
        }
        const limits = await api(`/develop/places/${id}/settings`).catch(() => null);
        if (limits?.max_players) {
            playerLimit = Number(limits.max_players);
        }
    };

    const loadVersions = async () => {
        const d = await api(`/develop/places/${id}/versions`).catch(() => null);
        versions = d?.versions ?? [];
        current = d?.current ?? null;
    };

    $effect(() => {
        if (tab === "versions" && id) {
            loadVersions();
        }
    });

    $effect(() => {
        if (!id) {
            router.replace("/develop/places");
            return;
        }
        load();
    });

    const flash = (msg: string, ok = true) => {
        error = ok ? "" : msg;
        success = ok ? msg : "";
    };

    const open = (key: string) => {
        tab = key;
        error = "";
        success = "";
    };

    const cancel = () => {
        fill(place);
        error = "";
        success = "";
    };

    const save = async (e: Event) => {
        e.preventDefault();
        try {
            await api(`/develop/places/${id}`, {
                title,
                avatar_type: avatarType,
                description,
                genre,
                max_players: maxPlayers,
                allowed_gear: allowedGear,
                copylocked,
                access
            }, "PATCH");
            Object.assign(place, {
                title,
                avatar_type: avatarType,
                description,
                genre,
                max_players: maxPlayers,
                allowed_gear: allowedGear,
                copylocked,
                access
            });
            flash("Your place settings have been updated.");
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const upload = async (e: Event) => {
        e.preventDefault();
        const file = placeFiles?.[0];
        if (!file) {
            return;
        }

        const bad = checkPlaceFile(file);
        if (bad) {
            flash(bad, false);
            return;
        }

        try {
            await uploadPlace(id, file, p => uploadLabel = `Uploading ${p}%`);
            place.has_file = true;
            placeFiles = null;
            flash("Place file uploaded successfully.");
        } catch (err: any) {
            flash(err.message, false);
        }
        uploadLabel = "";
    };

    const image = async (e: Event, kind: "thumbnail" | "icon", files: FileList | null, done: string) => {
        e.preventDefault();
        const file = files?.[0];
        if (!file) {
            return;
        }

        try {
            const form = new FormData();
            form.append("image", file);
            const d = await postForm(`/develop/places/${id}/${kind}`, form);
            if (d.thumbnail) {
                place.thumbnail = d.thumbnail;
            }
            if (d.icon) {
                place.icon = d.icon;
            }
            thumbFiles = null;
            iconFiles = null;
            flash(done);
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const toggleGear = (key: string) => {
        allowedGear = allowedGear.includes(key) ? allowedGear.filter(k => k !== key) : [...allowedGear, key];
    };

    const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

    const when = (at: number) => new Date(at * 1000).toLocaleString("en-US");

    const restore = async (version: number) => {
        if (!confirm(`Restore version ${version}? The current file is kept as a new version.`)) {
            return;
        }
        restoring = version;
        try {
            await api(`/develop/places/${id}/versions/${version}/restore`, {});
            place.has_file = true;
            await loadVersions();
            flash(`Version ${version} is now the live place file.`);
        } catch (err: any) {
            flash(err.message, false);
        }
        restoring = 0;
    };

    const remove = async () => {
        if (!confirm("Delete this place permanently?")) {
            return;
        }
        try {
            await api(`/develop/places/${id}`, undefined, "DELETE");
            router.go("/develop/places");
        } catch (err: any) {
            flash(err.message, false);
        }
    };
</script>

<svelte:head>
    <title>Configure Place - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

{#snippet messages()}
    {#if error}
        <div class="develop-error">{error}</div>
    {/if}
    {#if success}
        <div class="develop-success">{success}</div>
    {/if}
{/snippet}

{#snippet buttons()}
    <div class="develop-buttons">
        <button class="develop-btn develop-btn-neutral" type="submit">Save</button>
        <button class="develop-btn develop-btn-negative" type="button" onclick={cancel}>Cancel</button>
    </div>
{/snippet}

<main class="develop-page">
    <div class="develop-container">
        <h1 class="develop-title">Configure Place</h1>
        <div class="develop-settings">
            <nav class="develop-settings-nav">
                {#each tabs as [key, name]}
                    <button class="develop-settings-link" class:active={tab === key} type="button" onclick={() => open(key)}>{name}</button>
                {/each}
            </nav>
            <div class="develop-settings-content">
                {#if tab === "basic"}
                    <form onsubmit={save}>
                        <h2 class="develop-heading">Basic Settings</h2>
                        {@render messages()}
                        <label class="develop-label" for="title">Name:</label>
                        <input id="title" class="develop-text" name="title" type="text" maxlength="100" bind:value={title} required>
                        <label class="develop-label" for="description">Description:</label>
                        <textarea id="description" class="develop-text" name="description" maxlength="2000" bind:value={description}></textarea>
                        <label class="develop-label" for="genre">Genre:</label>
                        <select id="genre" class="develop-select" bind:value={genre}>
                            {#each GENRES as g}
                                <option value={g}>{g}</option>
                            {/each}
                        </select>
                        {@render buttons()}
                    </form>
                {:else if tab === "icon"}
                    <form onsubmit={e => image(e, "icon", iconFiles, "Icon updated.")}>
                        <h2 class="develop-heading">Game Icon</h2>
                        {@render messages()}
                        <div class="develop-icon">
                            <img class="develop-icon-preview" src={placeIcon(place)} alt="Current icon">
                            <div class="develop-icon-side">
                                <h3>Change the Icon</h3>
                                <input id="icon_file" class="develop-file" name="icon_file" type="file" accept="image/png,image/jpeg,image/gif" bind:files={iconFiles} required>
                                <button class="develop-btn develop-btn-neutral" type="submit">Upload Image</button>
                                <div class="develop-icon-note">Icon must be square.</div>
                            </div>
                        </div>
                    </form>
                {:else if tab === "thumbnail"}
                    <form onsubmit={e => image(e, "thumbnail", thumbFiles, "Thumbnail updated.")}>
                        <h2 class="develop-heading">Thumbnails</h2>
                        {@render messages()}
                        <div class="develop-icon">
                            <img class="develop-thumbnail" src={place.thumbnail || "/img/DefaultPlaceIcon.jpg"} alt="Current thumbnail">
                            <div class="develop-icon-side">
                                <h3>Your Own Image</h3>
                                <input id="thumbnail_file" class="develop-file" name="thumbnail_file" type="file" accept="image/png,image/jpeg,image/gif" bind:files={thumbFiles} required>
                                <button class="develop-btn develop-btn-neutral" type="submit">Upload Image</button>
                                <div class="develop-icon-note">PNG, JPG or GIF up to 5 MB, at least 64x64. A 16:9 image looks best.</div>
                                <div class="develop-icon-render">
                                    <button class="develop-control" type="button" disabled>Render From Place</button>
                                    <span class="develop-help">Rendering is done by the RCC manager, not from here yet.</span>
                                </div>
                            </div>
                        </div>
                    </form>
                {:else if tab === "access"}
                    <form onsubmit={save}>
                        <h2 class="develop-heading">Access</h2>
                        {@render messages()}
                        <label class="develop-label" for="max_players">Maximum Player Count:</label>
                        <select id="max_players" class="develop-select" bind:value={maxPlayers}>
                            {#each Array.from({ length: Math.max(playerLimit, maxPlayers) }, (_, i) => i + 1) as n}
                                <option value={n}>{n}</option>
                            {/each}
                        </select>
                        <label class="develop-label" for="access">Who Can Play:</label>
                        <select id="access" class="develop-select" bind:value={access}>
                            {#each ACCESS as [key, name]}
                                <option value={key}>{name}</option>
                            {/each}
                        </select>
                        <label class="develop-label" for="avatar_type">Avatar Type:</label>
                        <select id="avatar_type" class="develop-select develop-select-help" bind:value={avatarType}>
                            <option value="R6">R6, the classic blocky character</option>
                            <option value="R15">R15, the 15 part character</option>
                        </select>
                        <span class="develop-help">Everyone in this place gets this body. Old scripts that expect Torso or Left Arm need R6.</span>
                        {@render buttons()}
                    </form>
                {:else if tab === "permissions"}
                    <form onsubmit={save}>
                        <h2 class="develop-heading">Gear Permissions</h2>
                        {@render messages()}
                        <span class="develop-label">Gear types:</span>
                        <ul class="develop-gear-list">
                            {#each GEAR as [key, name] (key)}
                                <li>
                                    <label>
                                        <input type="checkbox" checked={allowedGear.includes(key)} onchange={() => toggleGear(key)}>
                                        {name}
                                    </label>
                                </li>
                            {/each}
                        </ul>
                        <div class="develop-rule"></div>
                        <h2 class="develop-heading">Other Permissions</h2>
                        <label class="develop-check">
                            <input type="checkbox" bind:checked={copylocked}>
                            Copy Locked
                        </label>
                        <span class="develop-help">Nobody else can open a copy of this place in Studio while it is copy locked.</span>
                        {@render buttons()}
                    </form>
                {:else if tab === "versions"}
                    <h2 class="develop-heading">Version History</h2>
                    {@render messages()}
                    <p class="develop-hint">Every upload keeps the file it replaced. Restoring a version makes it the live place file and keeps the current one as a new version.</p>
                    <table class="develop-versions">
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Size</th>
                                <th>Uploaded</th>
                                <th>By</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#if current}
                                <tr class="develop-version-current">
                                    <td>Current</td>
                                    <td>{size(current.size)}</td>
                                    <td>{when(current.uploaded_at)}</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            {/if}
                            {#each versions as v (v.version)}
                                <tr>
                                    <td>{v.version}</td>
                                    <td>{size(v.size)}</td>
                                    <td>{when(v.uploaded_at)}</td>
                                    <td>{v.uploaded_by_name}</td>
                                    <td>
                                        <button class="develop-control" type="button" disabled={restoring !== 0} onclick={() => restore(v.version)}>{restoring === v.version ? "Restoring" : "Restore"}</button>
                                    </td>
                                </tr>
                            {/each}
                            {#if !current && versions.length === 0}
                                <tr>
                                    <td colspan="5" class="develop-empty">No place file has been uploaded yet.</td>
                                </tr>
                            {/if}
                        </tbody>
                    </table>
                {:else if tab === "file"}
                    <form onsubmit={upload}>
                        <h2 class="develop-heading">{hasFile ? "Replace Place File" : "Upload Place File"}</h2>
                        {@render messages()}
                        <p class="develop-hint">{hasFile ? "A place file is currently uploaded. Uploading another .rbxl will safely replace it." : "This place does not have an .rbxl file yet."} Files up to {placeLimitLabel()} are uploaded in chunks.</p>
                        <label class="develop-label" for="place_file">Place File:</label>
                        <input id="place_file" class="develop-file" name="place_file" type="file" accept=".rbxl" bind:files={placeFiles} required>
                        <span class="develop-help">.rbxl only, up to {placeLimitLabel()}. Your existing place file is kept if the replacement upload fails.</span>
                        <div class="develop-buttons">
                            <button class="develop-btn" type="submit" disabled={!!uploadLabel}>{uploadLabel || (hasFile ? "Replace File" : "Upload File")}</button>
                        </div>
                    </form>
                {:else}
                    <h2 class="develop-heading">Delete Place</h2>
                    {@render messages()}
                    <p class="develop-hint">This removes the place, its uploaded .rbxl file, icon and thumbnail.</p>
                    <div class="develop-buttons">
                        <button class="develop-btn develop-btn-negative" type="button" onclick={remove}>Delete Place</button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</main>
