<script lang="ts">
    import { session } from "../../session.svelte";
    import Places from "./Places.svelte";

    const blurbs: [string, string, string, string][] = [
        ["engine", "All-In-One Development Engine", "With a built-in physics engine and free hosting, you can build and launch your game on NoneRev straight from Studio.", "/img/develop/blurb-engine.png"],
        ["players", "Reach the Whole Community", "We bring players to you from our small, loyal and growing community. No need to go find your players, they are right here.", "/img/develop/blurb-players.png"],
        ["money", "Control Your Monetization", "You have full control of your in-game monetization. Sell game passes and clothing and earn NONEBUX from every player who buys them.", "/img/develop/blurb-money.png"]
    ];

    const resources: [string, string][] = [
        ["NoneRev Forum", "/forum"],
        ["NoneRev Blog", "/blog"]
    ];
</script>

<svelte:head>
    {#if !session.me}
        <title>Develop - NoneRev</title>
    {/if}
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
    <Places />
{/if}
