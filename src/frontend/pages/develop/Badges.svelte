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
    let menu = $state(0);
    let filter = $state("");

    let gameId = $state("");
    let name = $state("");
    let description = $state("");
    let enabled = $state(true);
    let files = $state<FileList | null>(null);

    const edit = $derived(editId ? badges.find(b => b.id === editId) ?? null : null);
    const shown = $derived(filter ? badges.filter(b => String(b.game_id) === filter) : badges);

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

    const toggle = (e: Event, id: number) => {
        e.stopPropagation();
        menu = menu === id ? 0 : id;
    };

    const icon = (b: any) => b.icon || "/img/pending.png";

    const fallback = (e: Event) => {
        (e.currentTarget as HTMLImageElement).src = "/img/pending.png";
    };

    const day = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "N/A";
</script>

<svelte:window onclick={() => menu = 0} />

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
                    <div class="develop-upload develop-upload-place">
                        <h2 class="develop-heading">{edit ? "Configure Badge" : "Create a Badge"}</h2>
                        {#if loaded && games.length === 0}
                            <div class="develop-upload-form">
                                <div class="develop-upload-row">Create a place before making a badge.</div>
                                <a class="develop-btn" href="/develop/create">Create New Place</a>
                            </div>
                        {:else}
                            <form class="develop-upload-form" onsubmit={submit}>
                                <div class="develop-upload-row">
                                    <label for="game_id">Target Place:</label>
                                    <select id="game_id" name="game_id" bind:value={gameId} required>
                                        {#each games as game}
                                            <option value={String(game.id)}>{game.title}</option>
                                        {/each}
                                    </select>
                                </div>
                                <div class="develop-upload-row">
                                    <label for="icon">Find your image:</label>
                                    <input id="icon" type="file" name="icon" accept="image/png,image/jpeg,image/webp" bind:files>
                                </div>
                                <div class="develop-upload-row">
                                    <label for="name">Badge Name:</label>
                                    <input id="name" type="text" name="name" maxlength="100" required bind:value={name}>
                                </div>
                                <div class="develop-upload-row develop-upload-row-block">
                                    <label for="description">Description:</label>
                                    <textarea id="description" name="description" maxlength="2000" bind:value={description}></textarea>
                                </div>
                                <div class="develop-upload-row">
                                    <label class="develop-check">
                                        <input type="checkbox" name="enabled" bind:checked={enabled}>
                                        Badge enabled
                                    </label>
                                </div>
                                <div class="develop-upload-actions">
                                    <button class="develop-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Create Badge"}</button>
                                    {#if edit}
                                        <a class="develop-btn develop-btn-negative" href="/develop/badges">Cancel</a>
                                    {/if}
                                    {#if error}
                                        <div class="develop-result">{error}</div>
                                    {/if}
                                    {#if success}
                                        <div class="develop-result develop-result-ok">{success}</div>
                                    {/if}
                                </div>
                            </form>
                        {/if}
                    </div>
                    <div class="develop-header">
                        <h2 class="develop-heading">Badges</h2>
                        <span class="develop-aside">{badges.length.toLocaleString()} badge{badges.length === 1 ? "" : "s"} created</span>
                        <div class="develop-list-filter">
                            <label for="badge-place">Select from Active Places:</label>
                            <select id="badge-place" bind:value={filter}>
                                <option value="">All Places</option>
                                {#each games as game}
                                    <option value={String(game.id)}>{game.title}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    {#if loaded && shown.length === 0}
                        <div class="develop-empty">You haven't created any badges{filter ? " for this place" : ""} yet.</div>
                    {/if}
                    {#each shown as badge}
                        <div class="develop-item">
                            <div class="develop-thumb develop-thumb-item">
                                <span>
                                    <img src={icon(badge)} alt="" onerror={fallback}>
                                </span>
                            </div>
                            <div class="develop-name-col">
                                <a class="develop-name" href="/develop/badges?edit={badge.id}">{badge.name}</a>
                                <div class="develop-details">Created {day(badge.created_at)} · {badge.game_title || "Unknown Place"}{badge.enabled ? "" : " · Disabled"}</div>
                            </div>
                            <div class="develop-stats develop-stats-wide">
                                <div>
                                    Badge ID:
                                    <span>{badge.id}</span>
                                </div>
                                <div>
                                    Awarded:
                                    <span>{Number(badge.awarded_count ?? 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <div class="develop-menu-col develop-item-actions">
                                <div class="develop-gear-wrap" class:open={menu === badge.id}>
                                    <button class="develop-gear" class:open={menu === badge.id} type="button" aria-label="Badge menu" onclick={e => toggle(e, badge.id)}></button>
                                    {#if menu === badge.id}
                                        <div class="develop-menu">
                                            <a href="/develop/badges?edit={badge.id}">Configure</a>
                                            <a href="/game?id={badge.game_id}">View Game</a>
                                            <button class="develop-menu-split" type="button" onclick={() => remove(badge.id)}>Delete</button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="develop-separator"></div>
                    {/each}
                </section>
            </div>
        </div>
    </div>
</main>
