<script lang="ts">
    import { api } from "../../api";
    import { rows, postForm, placeIcon } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    let places = $state<any[]>([]);
    let loaded = $state(false);
    let label = $state<Record<number, string>>({});
    let target = 0;
    let picker = $state<HTMLInputElement>();

    api("/develop/places").then(d => {
        places = rows(d);
    }).catch(() => {}).finally(() => loaded = true);

    const pick = (id: number) => {
        target = id;
        picker?.click();
    };

    const upload = async () => {
        const file = picker?.files?.[0];
        const id = target;
        if (picker) picker.value = "";
        if (!file) return;

        label[id] = "Uploading...";
        try {
            const form = new FormData();
            form.append("image", file);
            const d = await postForm(`/develop/places/${id}/thumbnail`, form);
            const place = places.find(p => p.id === id);
            if (place && d.icon) place.icon = d.icon;
            label[id] = "Uploaded";
        } catch (err: any) {
            label[id] = "Failed";
            alert(err.message);
        }
        setTimeout(() => delete label[id], 1600);
    };
</script>

<svelte:head>
    <title>Develop - Places - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

<main class="develop-2016">
    <div class="develop-shell">
        <div class="develop-page-heading">
            <h1>Develop</h1>
            <a class="develop-primary-btn" href="/develop/create">Create New Place</a>
        </div>
        <div class="develop-panel">
            <Sidebar />
            <section class="develop-main">
                <div class="develop-section-heading develop-top-heading">
                    <div>
                        <h2>Places</h2>
                        <p class="develop-muted">Create, configure and render your places.</p>
                    </div>
                    <span class="develop-count">{places.length.toLocaleString()} Place{places.length === 1 ? "" : "s"}</span>
                </div>
                {#if !loaded}
                    <div class="develop-empty compact"><p>Loading...</p></div>
                {:else if places.length === 0}
                    <div class="develop-empty">
                        <h4>You haven't created any places yet.</h4>
                        <p>Your places will show up here after you create one.</p>
                        <a class="develop-primary-btn" href="/develop/create">Create New Place</a>
                    </div>
                {:else}
                    <div class="develop-place-list">
                        {#each places as place}
                            <article class="develop-place-row">
                                <a href="/game?id={place.id}" class="develop-place-thumb">
                                    <img src={placeIcon(place)} alt={place.title}>
                                </a>
                                <div class="develop-place-info">
                                    <a class="develop-place-title" href="/game?id={place.id}">{place.title}</a>
                                    <div class="develop-place-meta">Place ID: {place.id}</div>
                                    <div class="develop-place-status" class:ready={place.has_file} class:missing={!place.has_file}>{place.has_file ? "Place file uploaded" : "Place file missing"}</div>
                                </div>
                                <div class="develop-place-actions">
                                    <a class="develop-secondary-btn" href="/develop/configure?id={place.id}">Configure</a>
                                    <a class="develop-secondary-btn" href="/game?id={place.id}">View</a>
                                    <button type="button" class="develop-secondary-btn" disabled title="Rendering is done by the RCC manager">Render</button>
                                    <button type="button" class="develop-secondary-btn" disabled={!!label[place.id]} onclick={() => pick(place.id)}>{label[place.id] ?? "Upload thumbnail"}</button>
                                </div>
                            </article>
                        {/each}
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/gif" bind:this={picker} onchange={upload} hidden>
                {/if}
            </section>
        </div>
    </div>
</main>
