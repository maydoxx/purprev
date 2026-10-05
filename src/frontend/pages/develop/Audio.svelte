<script lang="ts">
    import { api } from "../../api";
    import { rows, postForm } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    let audio = $state<any[]>([]);
    let loaded = $state(false);
    let error = $state("");
    let success = $state("");
    let busy = $state(false);
    let copied = $state(0);
    let menu = $state(0);
    let playing = $state(0);
    let player = $state<HTMLAudioElement>();

    let name = $state("");
    let files = $state<FileList | null>(null);

    const load = async () => {
        audio = rows(await api("/develop/audio").catch(() => null));
        loaded = true;
    };
    load();

    const flash = (msg: string, ok = true) => {
        error = ok ? "" : msg;
        success = ok ? msg : "";
    };

    const upload = async (e: Event) => {
        e.preventDefault();
        const file = files?.[0];
        if (!file) {
            return;
        }

        const form = new FormData();
        form.append("name", name);
        form.append("audio_file", file);

        busy = true;
        try {
            const d = await postForm("/develop/audio", form);
            await load();
            name = "";
            files = null;
            flash(d.id ? `Audio uploaded. Asset ID: ${d.id}` : "Audio uploaded.");
        } catch (err: any) {
            flash(err.message, false);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this audio?")) {
            return;
        }
        try {
            await api(`/develop/audio/${id}`, undefined, "DELETE");
            await load();
            flash("Audio deleted.");
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const copy = (id: number) => {
        navigator.clipboard.writeText(String(id)).then(() => {
            copied = id;
            setTimeout(() => copied = 0, 1000);
        });
    };

    const play = (id: number) => {
        if (!player) {
            return;
        }
        if (playing === id) {
            player.pause();
            playing = 0;
            return;
        }
        player.src = `/asset/?id=${id}`;
        player.play().then(() => playing = id).catch(() => playing = 0);
    };

    const toggle = (e: Event, id: number) => {
        e.stopPropagation();
        menu = menu === id ? 0 : id;
    };

    const day = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "N/A";
</script>

<svelte:window onclick={() => menu = 0} />

<svelte:head>
    <title>Develop - Audio - NoneRev</title>
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
                    <div class="develop-upload">
                        <h2 class="develop-heading">Create an Audio</h2>
                        <form class="develop-upload-form" onsubmit={upload}>
                            <div class="develop-upload-row">MP3, OGG or WAV, up to 12 MB.</div>
                            <div class="develop-upload-row">
                                <label for="audio_file">Find your .mp3, .ogg or .wav file:</label>
                                <input id="audio_file" name="audio_file" type="file" accept=".mp3,.ogg,.wav" bind:files required>
                            </div>
                            <div class="develop-upload-row">
                                <label for="name">Audio Name:</label>
                                <input id="name" name="name" type="text" maxlength="100" placeholder="Audio name" bind:value={name}>
                            </div>
                            <div class="develop-upload-actions">
                                <button class="develop-btn" type="submit" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
                                {#if error}
                                    <div class="develop-result">{error}</div>
                                {/if}
                                {#if success}
                                    <div class="develop-result develop-result-ok">{success}</div>
                                {/if}
                            </div>
                        </form>
                    </div>
                    <div class="develop-header">
                        <h2 class="develop-heading">Audio</h2>
                        <span class="develop-aside">{audio.length.toLocaleString()} total</span>
                    </div>
                    {#if loaded && audio.length === 0}
                        <div class="develop-empty">No audio uploaded yet.</div>
                    {/if}
                    {#each audio as asset}
                        <div class="develop-item">
                            <div class="develop-thumb">
                                <button class="develop-audio" class:playing={playing === asset.id} type="button" aria-label={playing === asset.id ? "Stop" : "Play"} onclick={() => play(asset.id)}>
                                    <svg viewBox="0 0 52 52" aria-hidden="true">
                                        <path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M6 19h8l12-10v34L14 33H6z" />
                                        <path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M33 19c3 4 3 10 0 14M38 14c6 7 6 17 0 24M43 9c9 10 9 24 0 34" />
                                    </svg>
                                </button>
                            </div>
                            <div class="develop-name-col">
                                <span class="develop-name">{asset.name}</span>
                                <div class="develop-details">Created {day(asset.created_at)}</div>
                            </div>
                            <div class="develop-stats develop-stats-wide">
                                <div>
                                    Asset ID:
                                    <span>{asset.id}</span>
                                </div>
                                <div>
                                    Format:
                                    <span>{String(asset.extension ?? "").toUpperCase()}</span>
                                </div>
                            </div>
                            <div class="develop-menu-col develop-item-actions">
                                <div class="develop-gear-wrap" class:open={menu === asset.id}>
                                    <button class="develop-gear" class:open={menu === asset.id} type="button" aria-label="Audio menu" onclick={e => toggle(e, asset.id)}></button>
                                    {#if menu === asset.id}
                                        <div class="develop-menu">
                                            <button type="button" onclick={e => {
                                                e.stopPropagation();
                                                copy(asset.id);
                                            }}>{copied === asset.id ? "Copied" : "Copy ID"}</button>
                                            <button type="button" onclick={() => remove(asset.id)}>Delete</button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="develop-separator"></div>
                    {/each}
                    <audio bind:this={player} onended={() => playing = 0} preload="none"></audio>
                </section>
            </div>
        </div>
    </div>
</main>
