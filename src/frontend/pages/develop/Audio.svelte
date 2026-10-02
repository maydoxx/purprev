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
</script>

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
                    <div class="develop-header">
                        <h2 class="develop-heading">Audio</h2>
                        <span class="develop-count">{audio.length.toLocaleString()} total</span>
                    </div>
                    <div class="develop-hint">Upload audio for use in your places.</div>
                    {#if error}
                        <div class="develop-error">{error}</div>
                    {/if}
                    {#if success}
                        <div class="develop-success">{success}</div>
                    {/if}
                    <form class="develop-form" onsubmit={upload}>
                        <div class="develop-field">
                            <label class="develop-label" for="name">Name:</label>
                            <input id="name" class="develop-text" name="name" type="text" maxlength="100" placeholder="Audio name" bind:value={name}>
                        </div>
                        <div class="develop-field">
                            <label class="develop-label" for="audio_file">File:</label>
                            <input id="audio_file" class="develop-file" name="audio_file" type="file" accept=".mp3,.ogg,.wav" bind:files required>
                            <span class="develop-help">MP3, OGG or WAV, up to 12 MB.</span>
                        </div>
                        <div class="develop-actions">
                            <button class="develop-btn" type="submit" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
                        </div>
                    </form>
                    <h3 class="develop-subheading">Your Audio</h3>
                    {#if loaded && audio.length === 0}
                        <div class="develop-empty">No audio uploaded yet.</div>
                    {/if}
                    <div class="develop-list">
                        {#each audio as asset}
                            <div class="develop-item">
                                <div class="develop-info develop-info-wide">
                                    <span class="develop-name">{asset.name}</span>
                                    <div class="develop-meta">Asset ID: {asset.id} · {String(asset.extension ?? "").toUpperCase()}</div>
                                    <audio controls preload="none" src="/asset/?id={asset.id}"></audio>
                                </div>
                                <div class="develop-item-actions">
                                    <button class="develop-control" type="button" onclick={() => copy(asset.id)}>{copied === asset.id ? "Copied" : "Copy ID"}</button>
                                    <button class="develop-control" type="button" onclick={() => remove(asset.id)}>Delete</button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
            </div>
        </div>
    </div>
</main>
