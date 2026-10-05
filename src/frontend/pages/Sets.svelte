<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const PER_PAGE = 24;

    let sets = $state<any[]>([]);
    let current = $state<any>(null);
    let items = $state<any[]>([]);
    let loaded = $state(false);
    let busy = $state(false);
    let error = $state("");
    let page = $state(1);
    let mode = $state<"view" | "edit" | "create" | "add">("view");
    let name = $state("");
    let description = $state("");
    let search = $state("");
    let assets = $state<any[]>([]);
    let menu = $state<number | null>(null);
    let moving = $state<number | null>(null);
    let moveTo = $state(0);
    let dragging = $state<number | null>(null);

    const selectedId = $derived(Number(router.query.id) || 0);
    const totalPages = $derived(Math.max(1, Math.ceil(items.length / PER_PAGE)));
    const visible = $derived(items.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    const inSet = $derived(new Set(items.map(i => i.asset_id)));

    const fail = (err: any) => error = err?.message || "Something went wrong.";

    const loadSets = async () => {
        try {
            const d = await api("/sets");
            sets = d.list;
        } catch (err) {
            fail(err);
        }
        loaded = true;
    };

    const loadSet = async (id: number) => {
        if (!id) {
            current = null;
            items = [];
            return;
        }
        try {
            const d = await api(`/sets/${id}`);
            current = d.set;
            items = d.items;
            page = Math.min(page, Math.max(1, Math.ceil(d.items.length / PER_PAGE)));
        } catch (err) {
            current = null;
            items = [];
            fail(err);
        }
    };

    const loadAssets = async () => {
        try {
            const d = await api(`/sets/assets?q=${encodeURIComponent(search)}`);
            assets = d.list;
        } catch (err) {
            fail(err);
        }
    };

    $effect(() => {
        if (!session.me) {
            return;
        }
        loadSets();
    });

    $effect(() => {
        if (!loaded) {
            return;
        }
        if (!selectedId && sets.length) {
            router.replace(`/my/sets?id=${sets[0].id}`);
            return;
        }
        mode = "view";
        menu = null;
        loadSet(selectedId);
    });

    const open = (id: number) => router.go(`/my/sets?id=${id}`);

    const startCreate = () => {
        name = "";
        description = "";
        error = "";
        mode = "create";
    };

    const startEdit = () => {
        name = current.name;
        description = current.description;
        error = "";
        mode = "edit";
    };

    const startAdd = () => {
        search = "";
        error = "";
        mode = "add";
        loadAssets();
    };

    const save = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            if (mode === "create") {
                const d = await api("/sets", {
                    name,
                    description
                });
                await loadSets();
                mode = "view";
                open(d.id);
            } else {
                await api(`/sets/${current.id}`, {
                    name,
                    description
                });
                await loadSets();
                await loadSet(current.id);
                mode = "view";
            }
        } catch (err) {
            fail(err);
        }
        busy = false;
    };

    const remove = async () => {
        if (!confirm("Are you sure you want to delete this set?\nThis action cannot be undone.")) {
            return;
        }
        busy = true;
        try {
            await api(`/sets/${current.id}`, undefined, "DELETE");
            sets = sets.filter(s => s.id !== current.id);
            router.replace(sets.length ? `/my/sets?id=${sets[0].id}` : "/my/sets");
            current = null;
            items = [];
        } catch (err) {
            fail(err);
        }
        busy = false;
    };

    const add = async (assetId: number) => {
        busy = true;
        error = "";
        try {
            const d = await api(`/sets/${current.id}/items`, {
                assetId
            });
            items = d.items;
            await loadSets();
        } catch (err) {
            fail(err);
        }
        busy = false;
    };

    const removeItem = async (itemId: number) => {
        if (!confirm("Are you sure you want to remove this item?")) {
            return;
        }
        menu = null;
        busy = true;
        try {
            const d = await api(`/sets/${current.id}/items/${itemId}`, undefined, "DELETE");
            items = d.items;
            await loadSets();
        } catch (err) {
            fail(err);
        }
        busy = false;
    };

    const startMove = (itemId: number) => {
        menu = null;
        moving = itemId;
        moveTo = sets.find(s => s.id !== current.id)?.id ?? 0;
    };

    const move = async () => {
        if (!moving || !moveTo) {
            return;
        }
        busy = true;
        error = "";
        try {
            const d = await api(`/sets/${current.id}/move`, {
                itemId: moving,
                setId: moveTo
            });
            items = d.items;
            moving = null;
            await loadSets();
        } catch (err) {
            fail(err);
        }
        busy = false;
    };

    const drop = async (targetId: number) => {
        if (dragging === null || dragging === targetId) {
            dragging = null;
            return;
        }
        const order = items.map(i => i.id);
        const from = order.indexOf(dragging);
        const to = order.indexOf(targetId);
        order.splice(to, 0, order.splice(from, 1)[0]);
        dragging = null;
        try {
            const d = await api(`/sets/${current.id}/order`, {
                items: order
            });
            items = d.items;
        } catch (err) {
            fail(err);
        }
    };

    const assetIcon = (set: any) => set.icon || "/img/GuiImagePlaceholder.png";
</script>

<svelte:head>
    <title>My Sets - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
    <link rel="stylesheet" href="/css/sets.css">
</svelte:head>

{#snippet pager()}
    <div class="sets-pager">
        <button type="button" class="sets-pager-arrow" disabled={page === 1} onclick={() => page--} aria-label="Previous page"></button>
        <span class="sets-pager-text">
            Page
            <span class="sets-pager-input">{page}</span>
            of {totalPages}
        </span>
        <button type="button" class="sets-pager-arrow sets-pager-next" disabled={page === totalPages} onclick={() => page++} aria-label="Next page"></button>
    </div>
{/snippet}

<main class="develop-page sets-page">
    <div class="sets-container">
        <div class="sets-tabs">
            <a class="sets-tab selected" href="/my/sets">My Sets</a>
        </div>
        <div class="sets-pane">
            <div class="sets-list">
                <ul>
                    {#each sets as set (set.id)}
                        <li class:selected={set.id === current?.id}>
                            <a href="/my/sets?id={set.id}" title={set.name}>
                                <img src={assetIcon(set)} alt="">
                                <span>{set.name}</span>
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>
            <div class="sets-info-pane">
                {#if mode === "create" || mode === "edit"}
                    <form class="sets-info sets-info-edit" onsubmit={save}>
                        <div class="sets-icon">
                            <img src={mode === "edit" ? assetIcon(current) : "/img/GuiImagePlaceholder.png"} alt="">
                            <div class="sets-icon-buttons">
                                <button type="submit" class="develop-control develop-btn-small" disabled={busy}>Save</button>
                                <button type="button" class="develop-control develop-btn-small" disabled={busy} onclick={() => mode = "view"}>Cancel</button>
                            </div>
                        </div>
                        <div class="sets-info-text">
                            <label for="set-name">Name:</label>
                            <input id="set-name" type="text" maxlength="50" bind:value={name}>
                            <label for="set-description">Description:</label>
                            <textarea id="set-description" rows="4" maxlength="500" bind:value={description}></textarea>
                        </div>
                    </form>
                {:else if current}
                    <div class="sets-info">
                        <div class="sets-icon">
                            <img src={assetIcon(current)} alt="">
                            <div class="sets-icon-buttons">
                                <button type="button" class="develop-control develop-btn-small" disabled={busy} onclick={startEdit}>Edit</button>
                                <button type="button" class="develop-control develop-btn-small" disabled={busy} onclick={remove}>Delete</button>
                            </div>
                        </div>
                        <div class="sets-info-text">
                            <h3>{current.name}</h3>
                            <div class="sets-stats">
                                <span class="sets-stat-label">Owner:</span>
                                <span class="sets-stat"><a href="/user?id={session.me?.id}">{session.me?.username}</a></span>
                                <span class="sets-stat-label">Items:</span>
                                <span class="sets-stat">{items.length.toLocaleString()}</span>
                            </div>
                            <div class="sets-description">{current.description}</div>
                        </div>
                    </div>
                {:else if loaded}
                    <div class="sets-info">
                        <div class="sets-info-text">
                            <h3>Sets</h3>
                            <div class="sets-description">Sets are collections of your models and decals. Studio shows them in the Toolbox under My Sets.</div>
                        </div>
                    </div>
                {/if}
                <div class="sets-buttons">
                    {#if current && mode === "view"}
                        <button type="button" class="sets-btn-large" disabled={busy} onclick={startAdd}>Add Items</button>
                    {/if}
                    <button type="button" class="sets-btn-large" disabled={busy} onclick={startCreate}>Create New</button>
                </div>
            </div>

            {#if error}
                <div class="sets-error">{error}</div>
            {/if}

            {#if mode === "add" && current}
                <div class="sets-add">
                    <div class="sets-add-header">
                        <span>Add your models and decals to {current.name}</span>
                        <input type="search" placeholder="Search my items" bind:value={search} oninput={loadAssets}>
                        <button type="button" class="develop-control develop-btn-small" onclick={() => mode = "view"}>Done</button>
                    </div>
                    <div class="sets-add-list">
                        {#each assets as asset (asset.id)}
                            <div class="sets-item" class:added={inSet.has(asset.id)}>
                                <div class="sets-item-link">
                                    <img src={asset.thumbnail} alt="">
                                    <span title={asset.name}>{asset.name}</span>
                                </div>
                                {#if inSet.has(asset.id)}
                                    <span class="sets-hint">In set</span>
                                {:else}
                                    <button type="button" class="develop-control develop-btn-small" disabled={busy} onclick={() => add(asset.id)}>Add</button>
                                {/if}
                            </div>
                        {:else}
                            <div class="sets-hint sets-add-empty">You have not published any models or decals yet. Save a model or upload a decal from Studio first.</div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="sets-items">
                {#if loaded && sets.length === 0}
                    <div class="sets-empty">You do not own any sets.</div>
                {:else if current && items.length === 0}
                    <div class="sets-empty">This set contains no items... <button type="button" class="sets-text-link" onclick={startAdd}>Add some now!</button></div>
                {/if}
                {#if totalPages > 1}
                    {@render pager()}
                {/if}
                <div class="sets-grid">
                    {#each visible as item (item.id)}
                        <div
                            class="sets-item"
                            class:dragging={dragging === item.id}
                            draggable="true"
                            role="listitem"
                            ondragstart={() => dragging = item.id}
                            ondragover={e => e.preventDefault()}
                            ondrop={() => drop(item.id)}
                            ondragend={() => dragging = null}
                        >
                            <button type="button" class="sets-item-gear" class:open={menu === item.id} aria-label="Item options" onclick={() => menu = menu === item.id ? null : item.id}></button>
                            {#if menu === item.id}
                                <div class="sets-item-menu">
                                    <button type="button" onclick={() => startMove(item.id)}>Move to another set</button>
                                    <button type="button" onclick={() => removeItem(item.id)}>Remove from set</button>
                                </div>
                            {/if}
                            <div class="sets-item-link">
                                <img src={item.thumbnail} alt="">
                                <span title={item.name}>{item.name}</span>
                            </div>
                        </div>
                    {/each}
                </div>
                {#if totalPages > 1}
                    {@render pager()}
                {/if}
                {#if items.length > 1}
                    <div class="sets-hint sets-sort-msg">Click and drag items into your preferred order.</div>
                {/if}
                {#if current}
                    <div class="sets-url">Set ID {current.id}. Open the Toolbox in NoneRev Studio and pick it under My Sets.</div>
                {/if}
            </div>
        </div>

        {#if moving !== null}
            <div class="sets-popup">
                <div class="sets-modal">
                    <div class="sets-modal-title">Move Item</div>
                    <div class="sets-modal-body">
                        <div class="sets-modal-row">
                            <img src={items.find(i => i.id === moving)?.thumbnail} alt="">
                            <span class="sets-modal-name">{items.find(i => i.id === moving)?.name}</span>
                        </div>
                        <div class="sets-modal-row">
                            <label for="move-to">Select Set:</label>
                            <select id="move-to" bind:value={moveTo}>
                                {#each sets.filter(s => s.id !== current?.id) as set}
                                    <option value={set.id}>{set.name}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="sets-modal-buttons">
                            <button type="button" class="develop-btn" disabled={busy || !moveTo} onclick={move}>Move Item</button>
                            <button type="button" class="develop-btn develop-btn-negative" onclick={() => moving = null}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</main>
