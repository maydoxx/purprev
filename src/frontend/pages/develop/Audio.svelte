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
        if (!file) return;

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
        if (!confirm("Delete this audio?")) return;
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
</script>

<svelte:head>
    <title>Develop - Audio - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

<main class="develop-2016">
    <div class="develop-shell">
        <div class="develop-page-heading"><h1>Develop</h1></div>
        <div class="develop-panel">
            <Sidebar />
            <section class="develop-main">
                <h2>Audio</h2>
                <p class="develop-muted">Upload audio for use in your places.</p>
                {#if error}<div class="develop-alert error">{error}</div>{/if}
                {#if success}<div class="develop-alert success">{success}</div>{/if}
                <form class="develop-form develop-audio-upload" onsubmit={upload}>
                    <div class="develop-field">
                        <label for="name">Name</label>
                        <input id="name" name="name" type="text" maxlength="100" placeholder="Audio name" bind:value={name}>
                    </div>
                    <div class="develop-field">
                        <label for="audio_file">File</label>
                        <input id="audio_file" name="audio_file" type="file" accept=".mp3,.ogg,.wav" bind:files required>
                        <small>MP3, OGG or WAV, up to 12 MB.</small>
                    </div>
                    <button class="develop-primary-btn" type="submit" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
                </form>
                <div class="develop-section-heading"><h3>Your Audio</h3><span>{audio.length} total</span></div>
                {#if !loaded}
                    <div class="develop-empty compact"><p>Loading...</p></div>
                {:else if audio.length === 0}
                    <div class="develop-empty compact"><p>No audio uploaded yet.</p></div>
                {:else}
                    <div class="develop-audio-list">
                        {#each audio as asset}
                            <div class="develop-audio-row">
                                <div class="develop-audio-main">
                                    <strong>{asset.name}</strong>
                                    <span>Asset ID: {asset.id} · {String(asset.extension ?? "").toUpperCase()}</span>
                                    <audio controls preload="none" src="/asset/?id={asset.id}"></audio>
                                </div>
                                <div class="develop-audio-actions">
                                    <button type="button" class="develop-secondary-btn" onclick={() => copy(asset.id)}>{copied === asset.id ? "Copied" : "Copy ID"}</button>
                                    <button class="develop-text-danger" type="button" onclick={() => remove(asset.id)}>Delete</button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </section>
        </div>
    </div>
</main>
