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
        if (price !== "") form.append("price", price);
        if (files?.[0]) form.append("texture_file", files[0]);

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
        if (!edit || !confirm("Delete this item permanently?")) return;
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

<main class="develop-2016">
    <div class="develop-shell">
        <div class="develop-page-heading">
            <h1>Develop</h1>
            {#if edit}<a class="develop-secondary-btn" href="/develop/{category}">Back to {names[1]}</a>{/if}
        </div>
        <div class="develop-panel">
            <Sidebar />
            <section class="develop-main">
                <div class="develop-section-heading develop-top-heading">
                    <div>
                        <h2>{edit ? `Configure ${names[0]}` : names[1]}</h2>
                        <p class="develop-muted">{edit ? "Update this item or replace its image." : `Create and manage your ${names[1].toLowerCase()}.`}</p>
                    </div>
                    <span class="develop-count">{items.length.toLocaleString()} total</span>
                </div>

                {#if error}<div class="develop-alert error">{error}</div>{/if}
                {#if success}<div class="develop-alert success">{success}</div>{/if}

                <div class="develop-clothing-layout">
                    <div class="develop-clothing-form-wrap">
                        <h3>{edit ? "Configure" : `Upload ${names[0]}`}</h3>
                        <form class="develop-form develop-clothing-form" onsubmit={submit}>
                            <div class="develop-field">
                                <label for="name">Name</label>
                                <input id="name" name="name" type="text" maxlength="80" bind:value={name} required>
                            </div>

                            <div class="develop-field">
                                <label for="texture_file">{tee ? "Image" : "Template"}</label>
                                <input id="texture_file" name="texture_file" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" bind:files required={!edit}>
                                <small>{tee ? "PNG or JPG, up to 5 MB. This image is shown on the front of the torso." : "PNG or JPG, exactly 585x559 pixels, up to 5 MB."}{edit ? " Leave empty to keep the current image." : ""}</small>
                            </div>

                            <div class="develop-field">
                                <label for="price">Price</label>
                                <input id="price" name="price" type="number" min="0" max="2000000000" bind:value={price} placeholder="Leave blank for Off Sale">
                                <small>0 = Free. Leave blank for Off Sale.</small>
                            </div>

                            <div class="develop-field">
                                <label for="description">Description</label>
                                <textarea id="description" name="description" maxlength="2000" rows="5" bind:value={description}></textarea>
                            </div>

                            <div class="develop-form-actions">
                                <button class="develop-primary-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Upload"}</button>
                                {#if edit}<a class="develop-secondary-btn" href="/develop/{category}">Cancel</a>{/if}
                            </div>
                        </form>

                        {#if edit}
                            <div class="develop-divider"></div>
                            <div class="develop-clothing-tools">
                                <button class="develop-secondary-btn" type="button" disabled title="Rendering is done by the RCC manager">Render Preview</button>
                                <a class="develop-secondary-btn" href="/catalog/item?id={edit.id}">View Item</a>
                                <button class="develop-text-danger" type="button" onclick={remove}>Delete</button>
                            </div>
                            <small class="develop-muted">Previews are rendered by the RCC manager, not from here yet.</small>
                        {/if}
                    </div>

                    {#if edit}
                        <div class="develop-clothing-preview">
                            <img src={thumb(edit)} alt={edit.name}>
                            <strong>{edit.name}</strong>
                            <span>Item ID: {edit.id}</span>
                            <span>Asset ID: {edit.asset_id ?? "-"}</span>
                        </div>
                    {/if}
                </div>

                {#if !edit}
                    <div class="develop-section-heading"><h3>Your {names[1]}</h3></div>
                    {#if !loaded}
                        <div class="develop-empty compact"><p>Loading...</p></div>
                    {:else if items.length === 0}
                        <div class="develop-empty compact"><p>You haven't uploaded any {names[1].toLowerCase()} yet.</p></div>
                    {:else}
                        <div class="develop-clothing-list">
                            {#each items as item}
                                <article class="develop-clothing-row">
                                    <a href="/catalog/item?id={item.id}" class="develop-clothing-thumb">
                                        <img src={thumb(item)} alt={item.name}>
                                    </a>
                                    <div class="develop-clothing-info">
                                        <a href="/catalog/item?id={item.id}" class="develop-place-title">{item.name}</a>
                                        <div class="develop-place-meta">Item ID: {item.id} · Asset ID: {item.asset_id ?? "-"}</div>
                                        <div class="develop-clothing-price">{priceText(item.price)}</div>
                                    </div>
                                    <div class="develop-place-actions">
                                        <a class="develop-secondary-btn" href="/develop/{category}?edit={item.id}">Configure</a>
                                        <a class="develop-secondary-btn" href="/catalog/item?id={item.id}">View</a>
                                    </div>
                                </article>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </section>
        </div>
    </div>
</main>
