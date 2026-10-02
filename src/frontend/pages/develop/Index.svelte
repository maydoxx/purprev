<script lang="ts">
    import { api } from "../../api";
    import { rows, placeIcon } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const stats: [string, string, string][] = [
        ["places", "Places", "/places"],
        ["badges", "Badges", "/badges"],
        ["game-passes", "Game Passes", "/game-passes"],
        ["audio", "Audio", "/audio"],
        ["shirts", "Shirts", "/clothing/shirts"],
        ["t-shirts", "T-Shirts", "/clothing/t-shirts"],
        ["pants", "Pants", "/clothing/pants"]
    ];

    let counts = $state<Record<string, number>>({});
    let recent = $state<any[]>([]);
    let loaded = $state(false);

    for (const [key, , path] of stats) {
        api("/develop" + path).then(d => {
            const list = rows(d);
            counts[key] = list.length;
            if (key === "places") {
                recent = list.slice(0, 4);
                loaded = true;
            }
        }).catch(() => {});
    }
</script>

<svelte:head>
    <title>Develop - NoneRev</title>
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
                    <a class="develop-btn" href="/develop/create">Create New Place</a>
                    <div class="develop-header">
                        <h2 class="develop-heading">Overview</h2>
                        <span class="develop-count">Manage the things you have created on NoneRev.</span>
                    </div>
                    <div class="develop-counts">
                        {#each stats as [key, label]}
                            <a href="/develop/{key}">
                                <span>{label}</span>
                                <b>{(counts[key] ?? 0).toLocaleString()}</b>
                            </a>
                        {/each}
                    </div>
                    <div class="develop-subheader">
                        <h3 class="develop-subheading">Recent Places</h3>
                        <a href="/develop/places">See All</a>
                    </div>
                    {#if loaded && recent.length === 0}
                        <div class="develop-empty">You haven't created any places yet. Upload a place file to get started.</div>
                    {:else}
                        <div class="develop-list">
                            {#each recent as place}
                                <div class="develop-item">
                                    <div class="develop-thumb">
                                        <a href="/develop/configure?id={place.id}">
                                            <img src={placeIcon(place)} alt="">
                                        </a>
                                    </div>
                                    <div class="develop-info develop-info-wide">
                                        <a class="develop-name" href="/develop/configure?id={place.id}">{place.title}</a>
                                        <div class="develop-meta">Place ID: {place.id}</div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>
            </div>
        </div>
    </div>
</main>
