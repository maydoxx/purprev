<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, placeIcon } from "./develop";
    import { checkPlaceFile, uploadPlace } from "./upload";
    import Sidebar from "./Sidebar.svelte";

    const id = $derived(Number(router.query.id) || 0);

    let place = $state<any>({});
    let title = $state("");
    let avatarType = $state("R6");
    let error = $state("");
    let success = $state("");
    let uploadLabel = $state("");
    let placeFiles = $state<FileList | null>(null);
    let thumbFiles = $state<FileList | null>(null);

    const hasFile = $derived(!!place.has_file);

    const status = router.query.status;
    if (status === "created") success = "Place created. Upload its .rbxl file below.";
    if (status === "uploaded") success = "Place file uploaded.";
    if (status === "upload-failed") error = "The place was created, but its file upload failed. Retry below.";

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
        if (!file) return;

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
        if (!file) return;

        try {
            const form = new FormData();
            form.append("image", file);
            const d = await postForm(`/develop/places/${id}/thumbnail`, form);
            if (d.thumbnail) place.thumbnail = d.thumbnail;
            if (d.icon) place.icon = d.icon;
            thumbFiles = null;
            flash("Thumbnail updated.");
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const remove = async () => {
        if (!confirm("Delete this place permanently?")) return;
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

<main class="develop-2016">
    <div class="develop-shell">
        <div class="develop-page-heading"><h1>Develop</h1><a class="develop-secondary-btn" href="/develop/places">Back to Places</a></div>
        <div class="develop-panel">
            <Sidebar />
            <section class="develop-main">
                <div class="develop-configure-head">
                    <img src={placeIcon(place)} alt="">
                    <div><h2>{place.title ?? ""}</h2><span>Place ID: {id}</span></div>
                </div>
                {#if error}<div class="develop-alert error">{error}</div>{/if}
                {#if success}<div class="develop-alert success">{success}</div>{/if}

                <form class="develop-form" onsubmit={save}>
                    <div class="develop-field">
                        <label for="title">Name</label>
                        <input id="title" name="title" type="text" maxlength="100" bind:value={title} required>
                    </div>
                    <div class="develop-field">
                        <label for="avatar_type">Avatar type</label>
                        <select id="avatar_type" bind:value={avatarType}>
                            <option value="R6">R6, the classic blocky character</option>
                            <option value="R15">R15, the 15 part character</option>
                        </select>
                        <small>Everyone in this place gets this body. Old scripts that expect Torso or Left Arm need R6.</small>
                    </div>
                    <div class="develop-form-actions">
                        <button class="develop-primary-btn" type="submit">Save</button>
                        <a class="develop-secondary-btn" href="/game?id={id}">View Place</a>
                    </div>
                </form>

                <div class="develop-divider"></div>
                <h3>{hasFile ? "Replace Place File" : "Upload Place File"}</h3>
                <p class="develop-muted">{hasFile ? "A place file is currently uploaded. Uploading another .rbxl will safely replace it." : "This place does not have an .rbxl file yet."} Files up to 50 MB are uploaded in chunks.</p>
                <form class="develop-form" onsubmit={upload}>
                    <div class="develop-field">
                        <label for="place_file">Place File</label>
                        <input id="place_file" name="place_file" type="file" accept=".rbxl" bind:files={placeFiles} required>
                        <small>.rbxl only, up to 50 MB. Your existing place file is kept if the replacement upload fails.</small>
                    </div>
                    <div class="develop-form-actions">
                        <button class="develop-primary-btn" type="submit" disabled={!!uploadLabel}>{uploadLabel || (hasFile ? "Replace File" : "Upload File")}</button>
                    </div>
                </form>

                <div class="develop-divider"></div>
                <h3>Thumbnail</h3>
                <p class="develop-muted">Upload your own image, or let RCC render one from the place itself.</p>

                <div class="develop-thumb-preview">
                    <figure>
                        <img src={place.thumbnail || "/img/DefaultPlaceIcon.jpg"} alt="Current thumbnail">
                        <figcaption>Thumbnail{place.thumbnail ? "" : " (none yet)"}</figcaption>
                    </figure>
                    <figure>
                        <img class="is-icon" src={placeIcon(place)} alt="Current icon">
                        <figcaption>Icon{place.icon ? "" : " (none yet)"}</figcaption>
                    </figure>
                </div>

                <form class="develop-form" onsubmit={thumbnail}>
                    <div class="develop-field">
                        <label for="thumbnail_file">Your own image</label>
                        <input id="thumbnail_file" name="thumbnail_file" type="file" accept="image/png,image/jpeg,image/gif" bind:files={thumbFiles} required>
                        <small>PNG, JPG or GIF up to 5 MB, at least 64x64. A 16:9 image looks best. This replaces the rendered one.</small>
                    </div>
                    <div class="develop-form-actions">
                        <button class="develop-primary-btn" type="submit">Upload Thumbnail</button>
                        <button class="develop-secondary-btn" type="button" disabled>Render From Place</button>
                    </div>
                    <small class="develop-muted">Rendering is done by the RCC manager, not from here yet.</small>
                </form>

                <div class="develop-divider"></div>
                <h3>Delete Place</h3>
                <p class="develop-muted">This removes the place, its uploaded .rbxl file, icon and thumbnail.</p>
                <button class="develop-danger-btn" type="button" onclick={remove}>Delete Place</button>
            </section>
        </div>
    </div>
</main>
