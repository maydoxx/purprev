<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const editId = $derived(Number(router.query.edit) || 0);
    const placeId = $derived(Number(router.query.place) || 0);

    let games = $state<any[]>([]);
    let badges = $state<any[]>([]);
    let loaded = $state(false);
    let error = $state("");
    let success = $state("");
    let busy = $state(false);

    let gameId = $state("");
    let name = $state("");
    let description = $state("");
    let enabled = $state(true);
    let files = $state<FileList | null>(null);

    const edit = $derived(editId ? badges.find(b => b.id === editId) ?? null : null);

    const load = async () => {
        [games, badges] = await Promise.all([
            api("/develop/places").then(rows).catch(() => []),
            api("/develop/badges").then(rows).catch(() => [])
        ]);
        loaded = true;
    };
    load();

    $effect(() => {
        const picked = games.find(g => g.id === placeId) ?? games[0];
        gameId = String(edit?.game_id ?? picked?.id ?? "");
        name = edit?.name ?? "";
        description = edit?.description ?? "";
        enabled = edit ? !!edit.enabled : true;
        files = null;
    });

    const flash = (msg: string, ok = true) => {
        error = ok ? "" : msg;
        success = ok ? msg : "";
    };

    const submit = async (e: Event) => {
        e.preventDefault();
        const form = new FormData();
        form.append("game_id", gameId);
        form.append("name", name);
        form.append("description", description);
        form.append("enabled", String(enabled));
        if (files?.[0]) {
            form.append("icon", files[0]);
        }

        busy = true;
        try {
            if (edit) {
                await postForm(`/develop/badges/${edit.id}`, form, "PATCH");
                await load();
                flash("Badge updated.");
            } else {
                const d = await postForm("/develop/badges", form);
                await load();
                name = "";
                description = "";
                files = null;
                flash(d.id ? `Badge created. ID: ${d.id}` : "Badge created.");
            }
        } catch (err: any) {
            flash(err.message, false);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this badge and remove it from everyone who earned it?")) {
            return;
        }
        try {
            await api(`/develop/badges/${id}`, undefined, "DELETE");
            if (id === editId) {
                router.go("/develop/badges");
            }
            await load();
            flash("Badge deleted.");
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const icon = (b: any) => b.icon || "/img/pending.png";
    const fallback = (e: Event) => {
        (e.currentTarget as HTMLImageElement).src = "/img/pending.png";
    };
</script>

<svelte:head>
    <title>Develop - Badges - NoneRev</title>
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
                        <h2 class="develop-heading">Badges</h2>
                        <span class="develop-count">{badges.length.toLocaleString()} badge{badges.length === 1 ? "" : "s"} created</span>
                    </div>
                    <div class="develop-hint">Create achievements that your game can award to players.</div>
                    {#if error}
                        <div class="develop-error">{error}</div>
                    {/if}
                    {#if success}
                        <div class="develop-success">{success}</div>
                    {/if}

                    <h3 class="develop-subheading">{edit ? "Edit Badge" : "Create Badge"}</h3>
                    {#if loaded && games.length === 0}
                        <div class="develop-empty">
                            Create a place before making a badge.
                            <a class="develop-btn" href="/develop/create">Create New Place</a>
                        </div>
                    {:else}
                        <form class="develop-form" onsubmit={submit}>
                            <div class="develop-field">
                                <label class="develop-label" for="game_id">Place:</label>
                                <select id="game_id" class="develop-select" name="game_id" bind:value={gameId} required>
                                    {#each games as game}
                                        <option value={String(game.id)}>{game.title}</option>
                                    {/each}
                                </select>
                            </div>
                            <div class="develop-field">
                                <label class="develop-label" for="name">Name:</label>
                                <input id="name" class="develop-text" type="text" name="name" maxlength="100" required bind:value={name}>
                            </div>
                            <div class="develop-field">
                                <label class="develop-label" for="description">Description:</label>
                                <textarea id="description" class="develop-text" name="description" maxlength="2000" rows="6" bind:value={description}></textarea>
                            </div>
                            <div class="develop-field">
                                <label class="develop-label" for="icon">Icon:</label>
                                <input id="icon" class="develop-file" type="file" name="icon" accept="image/png,image/jpeg,image/webp" bind:files>
                            </div>
                            <label class="develop-check">
                                <input type="checkbox" name="enabled" bind:checked={enabled}>
                                Badge enabled
                            </label>
                            <div class="develop-actions">
                                <button class="develop-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Create Badge"}</button>
                                {#if edit}
                                    <a class="develop-btn develop-btn-negative" href="/develop/badges">Cancel</a>
                                {/if}
                            </div>
                        </form>
                    {/if}

                    <h3 class="develop-subheading">Your Badges</h3>
                    {#if loaded && badges.length === 0}
                        <div class="develop-empty">You haven't created any badges yet.</div>
                    {/if}
                    <div class="develop-list">
                        {#each badges as badge}
                            <div class="develop-item">
                                <div class="develop-thumb develop-thumb-fit">
                                    <span>
                                        <img src={icon(badge)} alt="" onerror={fallback}>
                                    </span>
                                </div>
                                <div class="develop-info develop-info-wide">
                                    <a class="develop-name" href="/develop/badges?edit={badge.id}">{badge.name}</a>
                                    <div class="develop-meta">{badge.game_title || "Unknown Place"} · ID {badge.id}</div>
                                    <div class="develop-meta">{badge.enabled ? "Enabled" : "Disabled"} · {Number(badge.awarded_count ?? 0).toLocaleString()} awarded</div>
                                </div>
                                <div class="develop-item-actions">
                                    <a class="develop-control" href="/develop/badges?edit={badge.id}">Configure</a>
                                    <a class="develop-control" href="/game?id={badge.game_id}">View Game</a>
                                    <button class="develop-control" type="button" onclick={() => remove(badge.id)}>Delete</button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
            </div>
        </div>
    </div>
</main>
