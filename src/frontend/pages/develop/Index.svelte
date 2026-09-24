<script lang="ts">
    import { api } from "../../api";
    import { rows, placeIcon } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const stats: [string, string, string][] = [
        ["places", "Places", "/places"],
        ["audio", "Audio", "/audio"],
        ["shirts", "Shirts", "/clothing/shirts"],
        ["t-shirts", "T-Shirts", "/clothing/t-shirts"],
        ["pants", "Pants", "/clothing/pants"],
        ["game-passes", "Game Passes", "/game-passes"],
        ["badges", "Badges", "/badges"]
    ];

    let counts = $state<Record<string, number>>({});
    let recent = $state<any[]>([]);

    for (const [key, , path] of stats) {
        api("/develop" + path).then(d => {
            const list = rows(d);
            counts[key] = list.length;
            if (key === "places") recent = list.slice(0, 4);
        }).catch(() => {});
    }
</script>

<svelte:head>
    <title>Develop - NoneRev</title>
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
                <h2>Overview</h2>
                <p class="develop-muted">Manage the things you have created on NoneRev.</p>
                <div class="develop-stat-list">
                    {#each stats as [key, label]}
                        <a href="/develop/{key}"><span>{label}</span><strong>{(counts[key] ?? 0).toLocaleString()}</strong></a>
                    {/each}
                </div>
                <div class="develop-section-heading">
                    <h3>Recent Places</h3>
                    <a href="/develop/places">See All</a>
                </div>
                {#if recent.length === 0}
                    <div class="develop-empty">
                        <h4>You haven't created any places yet.</h4>
                        <p>Upload a Roblox place file to get started.</p>
                        <a class="develop-primary-btn" href="/develop/create">Create New Place</a>
                    </div>
                {:else}
                    <div class="develop-mini-place-list">
                        {#each recent as place}
                            <a href="/develop/configure?id={place.id}" class="develop-mini-place">
                                <img src={placeIcon(place)} alt="">
                                <div>
                                    <strong>{place.title}</strong>
                                    <span>Place ID: {place.id}</span>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            </section>
        </div>
    </div>
</main>
