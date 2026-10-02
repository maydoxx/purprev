<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, priceText } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const cats: Record<string, [string, string]> = {
        shirts: ["Shirt", "Shirts"],
        pants: ["Pants", "Pants"],
        "t-shirts": ["T-Shirt", "T-Shirts"]
    };

    const slug = $derived(router.path.split("/").pop() ?? "");
    const category = $derived(slug in cats ? slug : "shirts");
    const names = $derived(cats[category]);
    const editId = $derived(Number(router.query.edit) || 0);
    const tee = $derived(category === "t-shirts");

    let items = $state<any[]>([]);
    let loaded = $state(false);
    let error = $state("");
    let success = $state("");
    let busy = $state(false);

    let name = $state("");
    let description = $state("");
    let price = $state("");
    let files = $state<FileList | null>(null);

    const edit = $derived(editId ? items.find(i => i.id === editId) ?? null : null);

    const load = async () => {
        items = rows(await api(`/develop/clothing/${category}`).catch(() => null));
        loaded = true;
    };

    $effect(() => {
        loaded = false;
        error = "";
        success = "";
        load();
    });

    $effect(() => {
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
        form.append("name", name);
        form.append("description", description);
        if (price !== "") {
            form.append("price", price);
        }
        if (files?.[0]) {
            form.append("texture_file", files[0]);
        }

        busy = true;
        try {
            if (edit) {
                await postForm(`/develop/clothing/${category}/${edit.id}`, form, "PATCH");
                await load();
                flash("Changes saved.");
            } else {
                await postForm(`/develop/clothing/${category}`, form);
                await load();
                name = "";
                description = "";
                price = "";
                files = null;
                flash(`${names[0]} created.`);
            }
        } catch (err: any) {
            flash(err.message, false);
        }
        busy = false;
    };

    const remove = async () => {
        if (!edit || !confirm("Delete this item permanently?")) {
            return;
        }
        try {
            await api(`/develop/clothing/${category}/${edit.id}`, undefined, "DELETE");
            router.go(`/develop/${category}`);
            await load();
            flash("Item deleted.");
        } catch (err: any) {
            flash(err.message, false);
        }
    };

    const thumb = (item: any) => item.thumbnail || "/img/pending.png";
</script>

<svelte:head>
    <title>Develop - {names[1]} - NoneRev</title>
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
                        <h2 class="develop-heading">{edit ? `Configure ${names[0]}` : names[1]}</h2>
                        <span class="develop-count">{items.length.toLocaleString()} total</span>
                        {#if edit}
                            <a class="develop-control develop-header-side" href="/develop/{category}">Back to {names[1]}</a>
                        {/if}
                    </div>
                    <div class="develop-hint">{edit ? "Update this item or replace its image." : `Create and manage your ${names[1].toLowerCase()}.`}</div>
                    {#if error}
                        <div class="develop-error">{error}</div>
                    {/if}
                    {#if success}
                        <div class="develop-success">{success}</div>
                    {/if}

                    <div class="develop-split">
                        <div class="develop-split-main">
                            <h3 class="develop-subheading">{edit ? "Configure" : `Upload ${names[0]}`}</h3>
                            <form class="develop-form" onsubmit={submit}>
                                <div class="develop-field">
                                    <label class="develop-label" for="name">Name:</label>
                                    <input id="name" class="develop-text" name="name" type="text" maxlength="80" bind:value={name} required>
                                </div>
                                <div class="develop-field">
                                    <label class="develop-label" for="texture_file">{tee ? "Image" : "Template"}:</label>
                                    <input id="texture_file" class="develop-file" name="texture_file" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" bind:files required={!edit}>
                                    <span class="develop-help">{tee ? "PNG or JPG, up to 5 MB. This image is shown on the front of the torso." : "PNG or JPG, exactly 585x559 pixels, up to 5 MB."}{edit ? " Leave empty to keep the current image." : ""}</span>
                                </div>
                                <div class="develop-field">
                                    <label class="develop-label" for="price">Price:</label>
                                    <input id="price" class="develop-text develop-text-short" name="price" type="number" min="0" max="2000000000" bind:value={price}>
                                    <span class="develop-help">0 = Free. Leave blank for Off Sale.</span>
                                </div>
                                <div class="develop-field">
                                    <label class="develop-label" for="description">Description:</label>
                                    <textarea id="description" class="develop-text" name="description" maxlength="2000" rows="6" bind:value={description}></textarea>
                                </div>
                                <div class="develop-actions">
                                    <button class="develop-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Upload"}</button>
                                    {#if edit}
                                        <a class="develop-btn develop-btn-negative" href="/develop/{category}">Cancel</a>
                                    {/if}
                                </div>
                            </form>

                            {#if edit}
                                <div class="develop-divider"></div>
                                <div class="develop-actions">
                                    <button class="develop-control" type="button" disabled title="Rendering is done by the RCC manager">Render Preview</button>
                                    <a class="develop-control" href="/catalog/item?id={edit.id}">View Item</a>
                                    <button class="develop-control" type="button" onclick={remove}>Delete</button>
                                </div>
                                <span class="develop-help">Previews are rendered by the RCC manager, not from here yet.</span>
                            {/if}
                        </div>

                        {#if edit}
                            <div class="develop-preview">
                                <img src={thumb(edit)} alt={edit.name}>
                                <strong>{edit.name}</strong>
                                <span>Item ID: {edit.id}</span>
                                <span>Asset ID: {edit.asset_id ?? "-"}</span>
                            </div>
                        {/if}
                    </div>

                    {#if !edit}
                        <h3 class="develop-subheading">Your {names[1]}</h3>
                        {#if loaded && items.length === 0}
                            <div class="develop-empty">You haven't uploaded any {names[1].toLowerCase()} yet.</div>
                        {/if}
                        <div class="develop-list">
                            {#each items as item}
                                <div class="develop-item">
                                    <div class="develop-thumb develop-thumb-fit">
                                        <a href="/catalog/item?id={item.id}">
                                            <img src={thumb(item)} alt={item.name}>
                                        </a>
                                    </div>
                                    <div class="develop-info develop-info-wide">
                                        <a class="develop-name" href="/catalog/item?id={item.id}">{item.name}</a>
                                        <div class="develop-meta">Item ID: {item.id} · Asset ID: {item.asset_id ?? "-"}</div>
                                        <div class="develop-meta develop-price">{priceText(item.price)}</div>
                                    </div>
                                    <div class="develop-item-actions">
                                        <a class="develop-control" href="/develop/{category}?edit={item.id}">Configure</a>
                                        <a class="develop-control" href="/catalog/item?id={item.id}">View</a>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>
            </div>
        </div>
    </div>
</main>
