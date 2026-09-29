<script lang="ts">
    import { api } from "../api";

    let downloads = $state<any[]>([]);
    const isAndroid = /Android/i.test(navigator.userAgent);

    api("/site/downloads").then(d => {
        if (Array.isArray(d)) downloads = d;
    }).catch(() => {});

    $effect(() => {
        document.body.classList.add("none-download-page");
        return () => document.body.classList.remove("none-download-page");
    });
</script>

<svelte:head>
    <title>Download - NoneRev</title>
    <link rel="stylesheet" href="/css/download.css">
</svelte:head>

<main class="download-hero">
    <div class="download-content">
        <img class="download-logo" src="/img/nonelogo.png" alt="None">

        <h1>Create Games, Play Games</h1>
        <p class="download-copy">
            Create games and worlds spanning a variety of genres,<br>
            from first-person shooters, survival games, and role-playing adventures.
        </p>

        <a class="download-main-button" href={isAndroid ? "/api/setup/download?os=android" : "/api/setup/download"}>Download Now!</a>

        <div class="download-platforms" aria-label="Available platforms">
            <a class="platform-button" href="/api/setup/download" title="Download for Windows">
                <img class="platform-image platform-image-windows" src="/img/download/windows-white.png" alt="">
                <span>Windows</span>
            </a>

            <a class="platform-button" href="/api/setup/download?os=android" title="Download for Android">
                <img class="platform-image platform-image-android" src="/img/download/android-white.png" alt="">
                <span>Android</span>
            </a>

            <a class="platform-button" href="/api/setup/download?os=linux" title="Download for Linux">
                <img class="platform-image platform-image-linux" src="/img/download/linux-white.png" alt="">
                <span>Linux</span>
            </a>
        </div>

        {#if downloads.length > 0}
            <div class="download-platforms" aria-label="All downloads">
                {#each downloads as d}
                    {#if d.fileUrl}
                        <a class="platform-button" href={d.fileUrl.replace(/^\/setup\//, "/api/setup/")} title={d.description}>
                            <span>{d.title}</span>
                        </a>
                    {:else}
                        <button class="platform-button platform-button-disabled" type="button" disabled title={d.description}>
                            <span>{d.title}</span>
                        </button>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
</main>
