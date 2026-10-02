<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, priceText } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const editId = $derived(Number(router.query.edit) || 0);
    const placeId = $derived(Number(router.query.place) || 0);

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
        const picked = games.find(g => g.id === placeId) ?? games[0];
        gameId = String(edit?.game_id ?? picked?.id ?? "");
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
        if (price !== "") {
            form.append("price", price);
        }
        if (files?.[0]) {
            form.append("icon", files[0]);
        }

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
        if (!confirm("Delete this game pass?")) {
            return;
        }
        try {
            await api(`/develop/game-passes/${id}`, undefined, "DELETE");
            if (id === editId) {
                router.go("/develop/game-passes");
            }
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
                        <h2 class="develop-heading">Game Passes</h2>
                        <span class="develop-count">{passes.length.toLocaleString()} pass{passes.length === 1 ? "" : "es"} created</span>
                    </div>
                    <div class="develop-hint">Sell permanent perks for your games.</div>
                    {#if error}
                        <div class="develop-error">{error}</div>
                    {/if}
                    {#if success}
                        <div class="develop-success">{success}</div>
                    {/if}

                    <h3 class="develop-subheading">{edit ? "Edit Game Pass" : "Create Game Pass"}</h3>
                    {#if loaded && games.length === 0}
                        <div class="develop-empty">
                            Create a place before making a game pass.
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
                                <label class="develop-label" for="price">Price:</label>
                                <input id="price" class="develop-text develop-text-short" type="number" name="price" min="0" max="2000000000" bind:value={price}>
                                <span class="develop-help">Leave blank for Off Sale.</span>
                            </div>
                            <div class="develop-field">
                                <label class="develop-label" for="icon">Icon:</label>
                                <input id="icon" class="develop-file" type="file" name="icon" accept="image/png,image/jpeg,image/webp" bind:files>
                            </div>
                            <div class="develop-actions">
                                <button class="develop-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Create Game Pass"}</button>
                                {#if edit}
                                    <a class="develop-btn develop-btn-negative" href="/develop/game-passes">Cancel</a>
                                {/if}
                            </div>
                        </form>
                    {/if}

                    <h3 class="develop-subheading">Your Game Passes</h3>
                    {#if loaded && passes.length === 0}
                        <div class="develop-empty">You haven't created any game passes yet.</div>
                    {/if}
                    <div class="develop-list">
                        {#each passes as pass}
                            <div class="develop-item">
                                <div class="develop-thumb develop-thumb-fit">
                                    <span>
                                        <img src={icon(pass)} alt="" onerror={fallback}>
                                    </span>
                                </div>
                                <div class="develop-info develop-info-wide">
                                    <a class="develop-name" href="/develop/game-passes?edit={pass.id}">{pass.name}</a>
                                    <div class="develop-meta">{pass.game_title || "Unknown Place"} · ID {pass.id}</div>
                                    <div class="develop-meta develop-price">{priceText(pass.price)}</div>
                                </div>
                                <div class="develop-item-actions">
                                    <a class="develop-control" href="/develop/game-passes?edit={pass.id}">Configure</a>
                                    <a class="develop-control" href="/game?id={pass.game_id}#store">View</a>
                                    <button class="develop-control" type="button" onclick={() => remove(pass.id)}>Delete</button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
            </div>
        </div>
    </div>
</main>
