<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, placeIcon } from "./develop";
    import { checkPlaceFile, uploadPlace } from "./upload";

    const id = $derived(Number(router.query.id) || 0);

    const tabs: [string, string][] = [
        ["basic", "Basic Settings"],
        ["file", "Place File"],
        ["thumbnail", "Thumbnail"],
        ["delete", "Delete Place"]
    ];

    const status = router.query.status;

    let place = $state<any>({});
    let title = $state("");
    let avatarType = $state("R6");
    let error = $state("");
    let success = $state("");
    let uploadLabel = $state("");
    let placeFiles = $state<FileList | null>(null);
    let thumbFiles = $state<FileList | null>(null);
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

    const load = async () => {
        const list = rows(await api("/develop/places").catch(() => null));
        const hit = list.find(p => p.id === id);
        if (hit) {
            place = hit;
            title = hit.title;
            avatarType = hit.avatar_type ?? "R6";
        } else if (list.length > 0) {
            router.replace("/develop/places");
        }
    };

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

    const save = async (e: Event) => {
        e.preventDefault();
        try {
            await api(`/develop/places/${id}`, {
                title,
                avatar_type: avatarType
            }, "PATCH");
            place.title = title;
            place.avatar_type = avatarType;
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

    const thumbnail = async (e: Event) => {
        e.preventDefault();
        const file = thumbFiles?.[0];
        if (!file) {
            return;
        }

        try {
            const form = new FormData();
            form.append("image", file);
            const d = await postForm(`/develop/places/${id}/thumbnail`, form);
            if (d.thumbnail) {
                place.thumbnail = d.thumbnail;
            }
            if (d.icon) {
                place.icon = d.icon;
            }
            thumbFiles = null;
            flash("Thumbnail updated.");
        } catch (err: any) {
            flash(err.message, false);
        }
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

<main class="develop-page">
    <div class="develop-container">
        <h1 class="develop-title">Configure Place</h1>
        <div class="develop-place">
            <img src={placeIcon(place)} alt="">
            <div class="develop-place-info">
                <a class="develop-name" href="/game?id={id}">{place.title ?? ""}</a>
                <span>Place ID: {id}</span>
            </div>
            <a class="develop-control" href="/develop/places">Back to Places</a>
        </div>
        <div class="develop-tabs">
            {#each tabs as [key, name]}
                <button class="develop-tab" class:active={tab === key} type="button" onclick={() => tab = key}>{name}</button>
            {/each}
        </div>
        <div class="develop-sheet develop-panel">
            {#if error}
                <div class="develop-error">{error}</div>
            {/if}
            {#if success}
                <div class="develop-success">{success}</div>
            {/if}

            {#if tab === "basic"}
                <h3 class="develop-section">Basic Settings</h3>
                <form onsubmit={save}>
                    <div class="develop-field">
                        <label class="develop-label" for="title">Name:</label>
                        <input id="title" class="develop-text" name="title" type="text" maxlength="100" bind:value={title} required>
                    </div>
                    <div class="develop-field">
                        <label class="develop-label" for="avatar_type">Avatar Type:</label>
                        <select id="avatar_type" class="develop-select" bind:value={avatarType}>
                            <option value="R6">R6, the classic blocky character</option>
                            <option value="R15">R15, the 15 part character</option>
                        </select>
                        <span class="develop-help">Everyone in this place gets this body. Old scripts that expect Torso or Left Arm need R6.</span>
                    </div>
                    <div class="develop-actions">
                        <button class="develop-btn" type="submit">Save</button>
                        <a class="develop-btn develop-btn-negative" href="/game?id={id}">View Place</a>
                    </div>
                </form>
            {:else if tab === "file"}
                <h3 class="develop-section">{hasFile ? "Replace Place File" : "Upload Place File"}</h3>
                <div class="develop-hint">{hasFile ? "A place file is currently uploaded. Uploading another .rbxl will safely replace it." : "This place does not have an .rbxl file yet."} Files up to 50 MB are uploaded in chunks.</div>
                <form class="develop-form" onsubmit={upload}>
                    <div class="develop-field">
                        <label class="develop-label" for="place_file">Place File:</label>
                        <input id="place_file" class="develop-file" name="place_file" type="file" accept=".rbxl" bind:files={placeFiles} required>
                        <span class="develop-help">.rbxl only, up to 50 MB. Your existing place file is kept if the replacement upload fails.</span>
                    </div>
                    <div class="develop-actions">
                        <button class="develop-btn" type="submit" disabled={!!uploadLabel}>{uploadLabel || (hasFile ? "Replace File" : "Upload File")}</button>
                    </div>
                </form>
            {:else if tab === "thumbnail"}
                <h3 class="develop-section">Thumbnail</h3>
                <div class="develop-hint">Upload your own image, or let RCC render one from the place itself.</div>
                <form class="develop-form" onsubmit={thumbnail}>
                    <div class="develop-previews">
                        <figure>
                            <img src={place.thumbnail || "/img/DefaultPlaceIcon.jpg"} alt="Current thumbnail">
                            <figcaption>Thumbnail{place.thumbnail ? "" : " (none yet)"}</figcaption>
                        </figure>
                        <figure>
                            <img class="square" src={placeIcon(place)} alt="Current icon">
                            <figcaption>Icon{place.icon ? "" : " (none yet)"}</figcaption>
                        </figure>
                    </div>
                    <div class="develop-field">
                        <label class="develop-label" for="thumbnail_file">Your Own Image:</label>
                        <input id="thumbnail_file" class="develop-file" name="thumbnail_file" type="file" accept="image/png,image/jpeg,image/gif" bind:files={thumbFiles} required>
                        <span class="develop-help">PNG, JPG or GIF up to 5 MB, at least 64x64. A 16:9 image looks best. This replaces the rendered one.</span>
                    </div>
                    <div class="develop-actions">
                        <button class="develop-btn" type="submit">Upload Thumbnail</button>
                        <button class="develop-control" type="button" disabled>Render From Place</button>
                    </div>
                    <span class="develop-help">Rendering is done by the RCC manager, not from here yet.</span>
                </form>
            {:else}
                <h3 class="develop-section">Delete Place</h3>
                <div class="develop-hint">This removes the place, its uploaded .rbxl file, icon and thumbnail.</div>
                <div class="develop-actions">
                    <button class="develop-btn develop-btn-negative" type="button" onclick={remove}>Delete Place</button>
                </div>
            {/if}
        </div>
    </div>
</main>
