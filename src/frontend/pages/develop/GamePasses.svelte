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
    let menu = $state(0);
    let filter = $state("");

    let gameId = $state("");
    let name = $state("");
    let description = $state("");
    let price = $state("");
    let files = $state<FileList | null>(null);

    const edit = $derived(editId ? passes.find(p => p.id === editId) ?? null : null);
    const shown = $derived(filter ? passes.filter(p => String(p.game_id) === filter) : passes);

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

    const toggle = (e: Event, id: number) => {
        e.stopPropagation();
        menu = menu === id ? 0 : id;
    };

    const icon = (p: any) => p.icon || "/img/pending.png";

    const fallback = (e: Event) => {
        (e.currentTarget as HTMLImageElement).src = "/img/pending.png";
    };

    const day = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "N/A";
</script>

<svelte:window onclick={() => menu = 0} />

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
                    <div class="develop-upload develop-upload-place">
                        <h2 class="develop-heading">{edit ? "Configure Game Pass" : "Create a Game Pass"}</h2>
                        {#if loaded && games.length === 0}
                            <div class="develop-upload-form">
                                <div class="develop-upload-row">Create a place before making a game pass.</div>
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
                                    <label for="name">Game Pass Name:</label>
                                    <input id="name" type="text" name="name" maxlength="100" required bind:value={name}>
                                </div>
                                <div class="develop-upload-row develop-upload-row-block">
                                    <label for="description">Description:</label>
                                    <textarea id="description" name="description" maxlength="2000" bind:value={description}></textarea>
                                </div>
                                <div class="develop-upload-row">
                                    <label for="price">Price:</label>
                                    <input id="price" type="number" name="price" min="0" max="2000000000" bind:value={price}>
                                    <span class="develop-upload-note">Leave blank for Off Sale.</span>
                                </div>
                                <div class="develop-upload-actions">
                                    <button class="develop-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Create Game Pass"}</button>
                                    {#if edit}
                                        <a class="develop-btn develop-btn-negative" href="/develop/game-passes">Cancel</a>
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
                        <h2 class="develop-heading">Game Passes</h2>
                        <span class="develop-aside">{passes.length.toLocaleString()} pass{passes.length === 1 ? "" : "es"} created</span>
                        <div class="develop-list-filter">
                            <label for="pass-place">Select from Active Places:</label>
                            <select id="pass-place" bind:value={filter}>
                                <option value="">All Places</option>
                                {#each games as game}
                                    <option value={String(game.id)}>{game.title}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    {#if loaded && shown.length === 0}
                        <div class="develop-empty">You haven't created any game passes{filter ? " for this place" : ""} yet.</div>
                    {/if}
                    {#each shown as pass}
                        <div class="develop-item">
                            <div class="develop-thumb develop-thumb-item">
                                <span>
                                    <img src={icon(pass)} alt="" onerror={fallback}>
                                </span>
                            </div>
                            <div class="develop-name-col">
                                <a class="develop-name" href="/develop/game-passes?edit={pass.id}">{pass.name}</a>
                                <div class="develop-details">Created {day(pass.created_at)} · {pass.game_title || "Unknown Place"}</div>
                            </div>
                            <div class="develop-stats develop-stats-wide">
                                <div>
                                    Price:
                                    <span>{priceText(pass.price)}</span>
                                </div>
                                <div>
                                    Pass ID:
                                    <span>{pass.id}</span>
                                </div>
                            </div>
                            <div class="develop-menu-col develop-item-actions">
                                <div class="develop-gear-wrap" class:open={menu === pass.id}>
                                    <button class="develop-gear" class:open={menu === pass.id} type="button" aria-label="Game pass menu" onclick={e => toggle(e, pass.id)}></button>
                                    {#if menu === pass.id}
                                        <div class="develop-menu">
                                            <a href="/develop/game-passes?edit={pass.id}">Configure</a>
                                            <a href="/game?id={pass.game_id}#store">View</a>
                                            <button class="develop-menu-split" type="button" onclick={() => remove(pass.id)}>Delete</button>
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
