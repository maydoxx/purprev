<script lang="ts">
    import { router } from "../../router.svelte";
    import { postForm } from "./develop";
    import { checkPlaceFile, uploadPlace } from "./upload";
    import Sidebar from "./Sidebar.svelte";

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
            if (error) return;
        }

        busy = "Creating...";
        try {
            const form = new FormData();
            form.append("title", title);
            const d = await postForm("/develop/places", form);
            const id = Number(d.id ?? d.placeId);
            if (!id) throw new Error("Could not create the place.");
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

<main class="develop-2016">
    <div class="develop-shell">
        <div class="develop-page-heading"><h1>Develop</h1></div>
        <div class="develop-panel">
            <Sidebar />
            <section class="develop-main">
                <h2>Create New Place</h2>
                <p class="develop-muted">Create a place and upload a Roblox Studio .rbxl file.</p>
                {#if error}<div class="develop-alert error">{error}</div>{/if}
                <form class="develop-form" onsubmit={submit}>
                    <div class="develop-field">
                        <label for="title">Name</label>
                        <input id="title" name="title" type="text" maxlength="100" bind:value={title} required>
                        <small>Up to 100 characters.</small>
                    </div>
                    <div class="develop-field">
                        <label for="place_file">Place File</label>
                        <input id="place_file" name="place_file" type="file" accept=".rbxl" bind:files>
                        <small>.rbxl only, up to 50 MB. Large files are uploaded in small chunks.</small>
                    </div>
                    <div class="develop-form-actions">
                        <button class="develop-primary-btn" type="submit" disabled={!!busy}>{busy || "Create Place"}</button>
                        <a class="develop-secondary-btn" href="/develop/places">Cancel</a>
                        {#if createdId}<a class="develop-secondary-btn" href="/develop/configure?id={createdId}">Open Configure</a>{/if}
                    </div>
                </form>
            </section>
        </div>
    </div>
</main>
