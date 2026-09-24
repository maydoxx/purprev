<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const editId = $derived(Number(router.query.edit) || 0);

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
        gameId = String(edit?.game_id ?? games[0]?.id ?? "");
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
        if (files?.[0]) form.append("icon", files[0]);

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
        if (!confirm("Delete this badge and remove it from everyone who earned it?")) return;
        try {
            await api(`/develop/badges/${id}`, undefined, "DELETE");
            if (id === editId) router.go("/develop/badges");
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

<main class="develop-2016"><div class="develop-shell">
    <div class="develop-page-heading"><h1>Develop</h1></div>
    <div class="develop-panel">
        <Sidebar />
        <section class="develop-main">
            <div class="develop-section-heading develop-top-heading"><div><h2>Badges</h2><p class="develop-muted">Create achievements that your game can award to players.</p></div><span class="develop-count">{badges.length.toLocaleString()} Badge{badges.length === 1 ? "" : "s"}</span></div>
            {#if error}<div class="develop-alert error">{error}</div>{/if}
            {#if success}<div class="develop-alert success">{success}</div>{/if}

            <div class="develop-asset-editor">
                <h3>{edit ? "Edit Badge" : "Create Badge"}</h3>
                {#if loaded && games.length === 0}
                    <div class="develop-empty"><p>Create a place before making a badge.</p><a class="develop-primary-btn" href="/develop/create">Create New Place</a></div>
                {:else}
                    <form class="develop-form-grid" onsubmit={submit}>
                        <label>Place<select name="game_id" bind:value={gameId} required>{#each games as game}<option value={String(game.id)}>{game.title}</option>{/each}</select></label>
                        <label>Name<input type="text" name="name" maxlength="100" required bind:value={name}></label>
                        <label class="develop-form-wide">Description<textarea name="description" maxlength="2000" rows="4" bind:value={description}></textarea></label>
                        <label>Icon<input type="file" name="icon" accept="image/png,image/jpeg,image/webp" bind:files></label>
                        <label class="develop-check-label"><input type="checkbox" name="enabled" bind:checked={enabled}> Badge enabled</label>
                        <div class="develop-form-wide develop-form-actions"><button class="develop-primary-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Create Badge"}</button>{#if edit}<a class="develop-secondary-btn" href="/develop/badges">Cancel</a>{/if}</div>
                    </form>
                {/if}
            </div>

            <div class="develop-section-heading"><h3>Your Badges</h3></div>
            {#if !loaded}
                <div class="develop-empty compact"><p>Loading...</p></div>
            {:else if badges.length === 0}
                <div class="develop-empty"><p>You haven't created any badges yet.</p></div>
            {:else}
                <div class="develop-asset-rows">
                    {#each badges as badge}
                        <article class="develop-asset-row">
                            <img class="develop-asset-thumb" src={icon(badge)} alt="" onerror={fallback}>
                            <div class="develop-asset-row-info"><strong>{badge.name}</strong><span>{badge.game_title || "Unknown Place"} · ID {badge.id}</span><span>{badge.enabled ? "Enabled" : "Disabled"} · {Number(badge.awarded_count ?? 0).toLocaleString()} awarded</span></div>
                            <div class="develop-place-actions"><a class="develop-secondary-btn" href="/develop/badges?edit={badge.id}">Configure</a><a class="develop-secondary-btn" href="/game?id={badge.game_id}">View Game</a><button class="develop-secondary-btn" type="button" onclick={() => remove(badge.id)}>Delete</button></div>
                        </article>
                    {/each}
                </div>
            {/if}
        </section>
    </div>
</div></main>
