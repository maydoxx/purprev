<script lang="ts">
    import { api } from "../../api";
    import { rows, postForm, placeIcon } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    let places = $state<any[]>([]);
    let loaded = $state(false);
    let label = $state<Record<number, string>>({});
    let menu = $state(0);
    let activeOnly = $state(false);
    let target = 0;
    let picker = $state<HTMLInputElement>();

    const shown = $derived(activeOnly ? places.filter(p => p.has_file) : places);

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
        if (picker) {
            picker.value = "";
        }
        if (!file) {
            return;
        }

        label[id] = "Uploading...";
        try {
            const form = new FormData();
            form.append("image", file);
            const d = await postForm(`/develop/places/${id}/thumbnail`, form);
            const place = places.find(p => p.id === id);
            if (place && d.icon) {
                place.icon = d.icon;
            }
            label[id] = "Uploaded";
        } catch (err: any) {
            label[id] = "Failed";
            alert(err.message);
        }
        setTimeout(() => delete label[id], 1600);
    };

    const toggle = (e: Event, id: number) => {
        e.stopPropagation();
        menu = menu === id ? 0 : id;
    };

    const day = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "N/A";
</script>

<svelte:window onclick={() => menu = 0} />

<svelte:head>
    <title>Develop - Places - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

<main class="develop-page">
    <div class="develop-container">
        <div class="develop-tabs">
            <a class="develop-tab active" href="/develop">My Creations</a>
        </div>
        <div class="develop-sheet">
            <div class="develop-creations">
                <Sidebar />
                <section class="develop-content">
                    <a class="develop-btn develop-create-new" href="/develop/create">Create New Place</a>
                    <div class="develop-header develop-header-filters">
                        <h2 class="develop-heading">Places</h2>
                        <span class="develop-aside">{places.length.toLocaleString()} place{places.length === 1 ? "" : "s"} created</span>
                        <div class="develop-filters">
                            <div class="develop-sort">
                                <label for="created-by">Created by:</label>
                                <select id="created-by">
                                    <option>Me</option>
                                </select>
                            </div>
                            <label class="develop-active-only">
                                <input type="checkbox" bind:checked={activeOnly}>
                                Show Active Only
                            </label>
                        </div>
                    </div>
                    {#if loaded && shown.length === 0}
                        <div class="develop-empty">You haven't created any places yet. Your places will show up here after you create one.</div>
                    {/if}
                    {#each shown as place}
                        <div class="develop-item">
                            <div class="develop-thumb">
                                <a href="/game?id={place.id}">
                                    <img src={placeIcon(place)} alt={place.title}>
                                </a>
                            </div>
                            <div class="develop-name-col">
                                <a class="develop-name" href="/game?id={place.id}">{place.title}</a>
                                <div class="develop-details">
                                    <div class="develop-status-cell">
                                        <a class="develop-status" class:off={!place.has_file} href="/develop/configure?id={place.id}" title={place.has_file ? "Place file uploaded" : "Place file missing"}>{place.has_file ? "Active" : "Inactive"}</a>
                                    </div>
                                    <span>Updated {day(place.updated_at)}</span>
                                    {#if label[place.id]}
                                        <span class="develop-note">{label[place.id]}</span>
                                    {/if}
                                </div>
                            </div>
                            <div class="develop-stats">
                                <div>
                                    Total Visitors:
                                    <span>{Number(place.visits ?? 0).toLocaleString()}</span>
                                </div>
                                <div>
                                    Place ID:
                                    <span>{place.id}</span>
                                </div>
                            </div>
                            <div class="develop-edit-col">
                                <a class="develop-control" href="/develop/configure?id={place.id}">Edit</a>
                            </div>
                            <div class="develop-menu-col">
                                <div class="develop-gear-wrap" class:open={menu === place.id}>
                                    <button class="develop-gear" class:open={menu === place.id} type="button" aria-label="Place menu" onclick={e => toggle(e, place.id)}></button>
                                    {#if menu === place.id}
                                        <div class="develop-menu">
                                            <a href="/develop/configure?id={place.id}">Configure Place</a>
                                            <a href="/my/create-user-ad?targetType=game&targetId={place.id}">Advertise</a>
                                            <a href="/develop/badges?place={place.id}">Create Badge</a>
                                            <a href="/develop/game-passes?place={place.id}">Create Game Pass</a>
                                            <a class="develop-menu-split" href="/game?id={place.id}">View Place</a>
                                            <button type="button" disabled={!!label[place.id]} onclick={() => pick(place.id)}>Upload Thumbnail</button>
                                            <button type="button" disabled title="Rendering is done by the RCC manager">Render</button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="develop-separator"></div>
                    {/each}
                    <input type="file" accept="image/png,image/jpeg,image/gif" bind:this={picker} onchange={upload} hidden>
                </section>
            </div>
        </div>
    </div>
</main>
