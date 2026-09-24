<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, priceText } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const editId = $derived(Number(router.query.edit) || 0);

    let games = $state<any[]>([]);
    let passes = $state<any[]>([]);
    let loaded = $state(false);
    let error = $state("");
    let success = $state("");
    let busy = $state(false);

    let gameId = $state("");
    let name = $state("");
    let description = $state("");
    let price = $state("");
    let files = $state<FileList | null>(null);

    const edit = $derived(editId ? passes.find(p => p.id === editId) ?? null : null);

    const load = async () => {
        [games, passes] = await Promise.all([
            api("/develop/places").then(rows).catch(() => []),
            api("/develop/game-passes").then(rows).catch(() => [])
        ]);
        loaded = true;
    };
    load();

    $effect(() => {
        gameId = String(edit?.game_id ?? games[0]?.id ?? "");
        name = edit?.name ?? "";
        description = edit?.description ?? "";
        price = edit?.price === null || edit?.price === undefined ? "" : String(edit.price);
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
        if (price !== "") form.append("price", price);
        if (files?.[0]) form.append("icon", files[0]);

        busy = true;
        try {
            if (edit) {
                await postForm(`/develop/game-passes/${edit.id}`, form, "PATCH");
                await load();
                flash("Game pass updated.");
            } else {
                const d = await postForm("/develop/game-passes", form);
                await load();
                name = "";
                description = "";
                price = "";
                files = null;
                flash(d.id ? `Game pass created. ID: ${d.id}` : "Game pass created.");
            }
        } catch (err: any) {
            flash(err.message, false);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this game pass?")) return;
        try {
            await api(`/develop/game-passes/${id}`, undefined, "DELETE");
            if (id === editId) router.go("/develop/game-passes");
            await load();
            flash("Game pass deleted.");
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const icon = (p: any) => p.icon || "/img/pending.png";
    const fallback = (e: Event) => {
        (e.currentTarget as HTMLImageElement).src = "/img/pending.png";
    };
</script>

<svelte:head>
    <title>Develop - Game Passes - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

<main class="develop-2016"><div class="develop-shell">
    <div class="develop-page-heading"><h1>Develop</h1></div>
    <div class="develop-panel">
        <Sidebar />
        <section class="develop-main">
            <div class="develop-section-heading develop-top-heading"><div><h2>Game Passes</h2><p class="develop-muted">Sell permanent perks for your games.</p></div><span class="develop-count">{passes.length.toLocaleString()} Pass{passes.length === 1 ? "" : "es"}</span></div>
            {#if error}<div class="develop-alert error">{error}</div>{/if}
            {#if success}<div class="develop-alert success">{success}</div>{/if}

            <div class="develop-asset-editor">
                <h3>{edit ? "Edit Game Pass" : "Create Game Pass"}</h3>
                {#if loaded && games.length === 0}
                    <div class="develop-empty"><p>Create a place before making a game pass.</p><a class="develop-primary-btn" href="/develop/create">Create New Place</a></div>
                {:else}
                    <form class="develop-form-grid" onsubmit={submit}>
                        <label>Place<select name="game_id" bind:value={gameId} required>{#each games as game}<option value={String(game.id)}>{game.title}</option>{/each}</select></label>
                        <label>Name<input type="text" name="name" maxlength="100" required bind:value={name}></label>
                        <label class="develop-form-wide">Description<textarea name="description" maxlength="2000" rows="4" bind:value={description}></textarea></label>
                        <label>Price <span class="develop-field-help">blank = Off Sale</span><input type="number" name="price" min="0" max="2000000000" bind:value={price}></label>
                        <label>Icon<input type="file" name="icon" accept="image/png,image/jpeg,image/webp" bind:files></label>
                        <div class="develop-form-wide develop-form-actions"><button class="develop-primary-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Create Game Pass"}</button>{#if edit}<a class="develop-secondary-btn" href="/develop/game-passes">Cancel</a>{/if}</div>
                    </form>
                {/if}
            </div>

            <div class="develop-section-heading"><h3>Your Game Passes</h3></div>
            {#if !loaded}
                <div class="develop-empty compact"><p>Loading...</p></div>
            {:else if passes.length === 0}
                <div class="develop-empty"><p>You haven't created any game passes yet.</p></div>
            {:else}
                <div class="develop-asset-rows">
                    {#each passes as pass}
                        <article class="develop-asset-row">
                            <img class="develop-asset-thumb" src={icon(pass)} alt="" onerror={fallback}>
                            <div class="develop-asset-row-info"><strong>{pass.name}</strong><span>{pass.game_title || "Unknown Place"} · ID {pass.id}</span><span>{priceText(pass.price)}</span></div>
                            <div class="develop-place-actions"><a class="develop-secondary-btn" href="/develop/game-passes?edit={pass.id}">Configure</a><a class="develop-secondary-btn" href="/game?id={pass.game_id}#store">View</a><button class="develop-secondary-btn" type="button" onclick={() => remove(pass.id)}>Delete</button></div>
                        </article>
                    {/each}
                </div>
            {/if}
        </section>
    </div>
</div></main>
