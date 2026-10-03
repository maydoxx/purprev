<script lang="ts">
    import { api } from "../../api";
    import { session } from "../../session.svelte";
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

    const blurbs: [string, string, string, string][] = [
        ["engine", "All-In-One Development Engine", "With a built-in physics engine and free hosting, you can build and launch your game on NoneRev straight from Studio.", "/img/develop/blurb-engine.png"],
        ["players", "Reach the Whole Community", "We bring players to you from our small, loyal and growing community. No need to go find your players, they are right here.", "/img/develop/blurb-players.png"],
        ["money", "Control Your Monetization", "You have full control of your in-game monetization. Sell game passes and clothing and earn NONEBUX from every player who buys them.", "/img/nonebux-icon.png"]
    ];

    const resources: [string, string][] = [
        ["NoneRev Forum", "/forum"],
        ["NoneRev Blog", "/blog"]
    ];

    let counts = $state<Record<string, number>>({});
    let recent = $state<any[]>([]);
    let loaded = $state(false);

    $effect(() => {
        if (!session.me) {
            return;
        }
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
    });
</script>

<svelte:head>
    <title>Develop - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

{#if !session.me}
    <main class="develop-page develop-splash-page">
        <div id="StudioSplashScreen">
            <div class="header-bg-container">
                <div class="header-bg">
                    <div class="header-container">
                        <img class="studio-icon" src="/img/noneRevSmall.png" alt="">
                        <h3>Join Thousands of Successful Developers on NoneRev</h3>
                        <p>
                            Our FREE platform enables anyone to create 3D multiplayer games and host them on NoneRev.
                            <br>
                            Build, publish and play with the tools you already know.
                        </p>
                        <a href="/download" id="studio-launch" class="btn-primary-md">Open NoneRev Studio</a>
                        <p>
                            <a class="small" href="/login">Continue to Develop page</a>
                        </p>
                    </div>
                </div>
            </div>
            <div class="content-container">
                <ul class="blurbs-container">
                    {#each blurbs as [key, title, text, image]}
                        <li class="blurb {key}">
                            <div class="section-content">
                                <p class="text-lead">{title}</p>
                                <p>{text}</p>
                                <img src={image} alt="">
                            </div>
                        </li>
                    {/each}
                </ul>
                <div class="links-container">
                    <div class="resources-title">Resources</div>
                    {#each resources as [label, href]}
                        <a class="btn-control-md" {href}><span>{label}</span></a>
                    {/each}
                </div>
            </div>
        </div>
    </main>
{:else}
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
{/if}
