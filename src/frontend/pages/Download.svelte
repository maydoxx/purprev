<script lang="ts">
    import { api } from "../api";
    import Footer from "../Footer.svelte";

    const platforms: Record<string, string[]> = {
        windows: ["Windows"],
        "linux-native": ["Linux", "Native"],
        android: ["Android"],
        studio: ["Studio"]
    };

    let downloads = $state<any[]>([]);
    let started = $state(false);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const mainUrl = isAndroid ? "/api/setup/download?os=android" : "/api/setup/download";

    api("/site/downloads").then(d => {
        if (Array.isArray(d)) downloads = d;
    }).catch(() => {});

    const platformOf = (d: any) => {
        const os = new URL(d.fileUrl ?? "/", location.origin).searchParams.get("os") ?? "windows";
        return platforms[os] ? os : "";
    };

    const hrefOf = (d: any) => d.fileUrl.replace(/^\/setup\//, "/api/setup/");
</script>

<svelte:head>
    <title>NoneRev Download</title>
    <link rel="stylesheet" href="/css/download.css">
</svelte:head>

{#snippet slot(d: any, first: boolean)}
    {@const os = platformOf(d)}
    {@const names = platforms[os] ?? []}
    {#if first}
        <span class="download-os">
            {#if os}
                <span class="download-glyph download-glyph-{os}"></span>
            {/if}
            <span class="download-os-name">{os ? names.join(" ") : d.title}</span>
        </span>
    {:else}
        <span class="download-badge">
            {#if os}
                <span class="download-glyph download-glyph-{os}"></span>
                <span class="download-badge-small">{["None 2016", ...names.slice(0, -1)].join(" ")}</span>
                <span class="download-badge-big">{names.at(-1)}</span>
            {:else}
                <span class="download-badge-big">{d.title}</span>
            {/if}
        </span>
    {/if}
{/snippet}

<div class="download-band">
    {#if !started}
        <div class="download-body">
            <img class="download-logo" src="/img/nonelogo.png" alt="None">

            <h1>Create Games, Play Games</h1>

            <div class="download-tagline">Create games and worlds spanning a variety of genres,</div>
            <div class="download-tagline">From first-person shooters, survival games, and role-playing adventures.</div>

            <div class="download-now-row">
                <a class="download-now" href={mainUrl} onclick={() => started = true}>Download Now!</a>
            </div>

            <div class="download-platforms">
                {#each downloads as d, i}
                    {#if d.fileUrl}
                        <a class="download-slot" href={hrefOf(d)} title={`${d.title}\n${d.description}`} aria-label={d.title}>
                            {@render slot(d, i === 0)}
                        </a>
                    {:else}
                        <span class="download-slot download-slot-off" title={`${d.title}\n${d.description}`} aria-label={d.title}>
                            {@render slot(d, i === 0)}
                        </span>
                    {/if}
                {/each}
            </div>
        </div>
    {:else}
        <div class="download-thanks">
            <h1>Thanks for downloading NoneRev</h1>

            <div class="download-hint download-hint-big">
                Just follow the steps below to start playing games. NoneRev should
                <br> start in a few seconds; if it doesn't, <a href={mainUrl}>restart the download.</a>
            </div>

            <div class="download-steps">
                <div class="download-step">
                    <img src="/img/download/step-1.png" alt="step one">
                    <div class="download-step-title">
                        Step 1.
                        <span>Download NoneRev</span>
                    </div>
                    <img src="/img/download/check.png" alt="done">
                </div>

                <div class="download-step">
                    <img src="/img/download/step-2.png" alt="step two">
                    <div class="download-step-title">
                        Step 2.
                        <span>Install NoneRev</span>
                    </div>
                </div>

                <div class="download-step">
                    <img src="/img/download/step-3.png" alt="step three">
                    <div class="download-step-title">
                        Step 3.
                        <span>Launch NoneRev</span>
                    </div>
                </div>
            </div>

            <div class="download-hint">
                Still need help? Our Technical Support Forum is a great resource to <a href="/forum">your questions.</a>
            </div>
        </div>
    {/if}
</div>

<Footer />
