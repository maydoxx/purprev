<script lang="ts">
    import { router } from "../../router.svelte";
    import { postForm } from "./develop";
    import { checkPlaceFile, uploadPlace } from "./upload";

    let title = $state("");
    let files = $state<FileList | null>(null);
    let error = $state("");
    let busy = $state("");
    let createdId = $state(0);

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";

        const file = files?.[0] ?? null;
        if (file) {
            error = checkPlaceFile(file);
            if (error) {
                return;
            }
        }

        busy = "Creating...";
        try {
            const form = new FormData();
            form.append("title", title);
            const d = await postForm("/develop/places", form);
            const id = Number(d.id ?? d.placeId);
            if (!id) {
                throw new Error("Could not create the place.");
            }
            createdId = id;

            let status = "created";
            if (file) {
                await uploadPlace(id, file, p => busy = `Uploading ${p}%`);
                status = "uploaded";
            }
            router.go(`/develop/configure?id=${id}&status=${status}`);
        } catch (err: any) {
            error = createdId ? `The place was created (ID ${createdId}), but the .rbxl upload failed: ${err.message} You can retry from Configure.` : err.message;
            busy = "";
        }
    };
</script>

<svelte:head>
    <title>Create Place - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

<main class="develop-page">
    <form class="develop-container" onsubmit={submit}>
        <h1 class="develop-title">Create Place</h1>
        <div class="develop-tabs">
            <span class="develop-tab active">Basic Settings</span>
        </div>
        <div class="develop-sheet develop-panel">
            <h3 class="develop-section">Basic Settings</h3>
            {#if error}
                <div class="develop-error">{error}</div>
            {/if}
            <div class="develop-field">
                <label class="develop-label" for="title">Name:</label>
                <input id="title" class="develop-text" name="title" type="text" maxlength="100" bind:value={title} required>
            </div>
            <div class="develop-field">
                <label class="develop-label" for="place_file">Place File:</label>
                <input id="place_file" class="develop-file" name="place_file" type="file" accept=".rbxl" bind:files>
                <span class="develop-help">.rbxl only, up to 50 MB. Large files are uploaded in small chunks.</span>
            </div>
        </div>
        <div class="develop-actions">
            <button class="develop-btn" type="submit" disabled={!!busy}>{busy || "Create Place"}</button>
            <a class="develop-btn develop-btn-negative" href="/develop/places">Cancel</a>
            {#if createdId}
                <a class="develop-control" href="/develop/configure?id={createdId}">Open Configure</a>
            {/if}
        </div>
    </form>
</main>
