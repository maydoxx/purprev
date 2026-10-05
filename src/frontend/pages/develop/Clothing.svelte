<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, postForm, priceText } from "./develop";
    import Sidebar from "./Sidebar.svelte";

    const cats: Record<string, [string, string, string]> = {
        shirts: ["Shirt", "Shirts", "a Shirt"],
        pants: ["Pants", "Pants", "Pants"],
        "t-shirts": ["T-Shirt", "T-Shirts", "a T-Shirt"]
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
    let menu = $state(0);

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

    const toggle = (e: Event, id: number) => {
        e.stopPropagation();
        menu = menu === id ? 0 : id;
    };

    const thumb = (item: any) => item.thumbnail || "/img/pending.png";

    const day = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "N/A";
</script>

<svelte:window onclick={() => menu = 0} />

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
                    <div class="develop-upload">
                        <h2 class="develop-heading">{edit ? `Configure ${names[0]}` : `Create ${names[2]}`}</h2>
                        <form class="develop-upload-form" onsubmit={submit}>
                            <div class="develop-upload-row">{tee ? "PNG or JPG, up to 5 MB. This image is shown on the front of the torso." : "PNG or JPG, exactly 585x559 pixels, up to 5 MB."}{edit ? " Leave the image empty to keep the current one." : ""}</div>
                            <div class="develop-upload-row">
                                <label for="texture_file">Find your image:</label>
                                <input id="texture_file" name="texture_file" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" bind:files required={!edit}>
                            </div>
                            <div class="develop-upload-row">
                                <label for="name">{names[0]} Name:</label>
                                <input id="name" name="name" type="text" maxlength="80" bind:value={name} required>
                            </div>
                            <div class="develop-upload-row">
                                <label for="price">Price:</label>
                                <input id="price" name="price" type="number" min="0" max="2000000000" bind:value={price}>
                                <span class="develop-upload-note">0 = Free. Leave blank for Off Sale.</span>
                            </div>
                            <div class="develop-upload-row develop-upload-row-block">
                                <label for="description">Description:</label>
                                <textarea id="description" name="description" maxlength="2000" bind:value={description}></textarea>
                            </div>
                            <div class="develop-upload-actions">
                                <button class="develop-btn" type="submit" disabled={busy}>{edit ? "Save Changes" : "Upload"}</button>
                                {#if edit}
                                    <a class="develop-btn develop-btn-negative" href="/develop/{category}">Cancel</a>
                                {/if}
                                {#if error}
                                    <div class="develop-result">{error}</div>
                                {/if}
                                {#if success}
                                    <div class="develop-result develop-result-ok">{success}</div>
                                {/if}
                            </div>
                        </form>
                    </div>

                    {#if edit}
                        <div class="develop-header">
                            <h2 class="develop-heading develop-heading-clip" title={edit.name}>{edit.name}</h2>
                        </div>
                        <div class="develop-edit">
                            <img src={thumb(edit)} alt={edit.name}>
                            <div class="develop-edit-info">
                                <div class="develop-stats">
                                    <div>
                                        Item ID:
                                        <span>{edit.id}</span>
                                    </div>
                                    <div>
                                        Asset ID:
                                        <span>{edit.asset_id ?? "-"}</span>
                                    </div>
                                </div>
                                <div class="develop-edit-actions">
                                    <button class="develop-control" type="button" disabled title="Rendering is done by the RCC manager">Render Preview</button>
                                    <a class="develop-control" href="/catalog/item?id={edit.id}">View Item</a>
                                    <button class="develop-control" type="button" onclick={remove}>Delete</button>
                                </div>
                                <span class="develop-help">Previews are rendered by the RCC manager, not from here yet.</span>
                            </div>
                        </div>
                    {:else}
                        <div class="develop-header">
                            <h2 class="develop-heading">{names[1]}</h2>
                            <span class="develop-aside">{items.length.toLocaleString()} total</span>
                        </div>
                        {#if loaded && items.length === 0}
                            <div class="develop-empty">You haven't uploaded any {names[1].toLowerCase()} yet.</div>
                        {/if}
                        {#each items as item}
                            <div class="develop-item">
                                <div class="develop-thumb develop-thumb-item">
                                    <a href="/catalog/item?id={item.id}">
                                        <img src={thumb(item)} alt={item.name}>
                                    </a>
                                </div>
                                <div class="develop-name-col">
                                    <a class="develop-name" href="/catalog/item?id={item.id}">{item.name}</a>
                                    <div class="develop-details">Created {day(item.created_at)}</div>
                                </div>
                                <div class="develop-stats develop-stats-wide">
                                    <div>
                                        Price:
                                        <span>{priceText(item.price)}</span>
                                    </div>
                                    <div>
                                        Asset ID:
                                        <span>{item.asset_id ?? "-"}</span>
                                    </div>
                                </div>
                                <div class="develop-menu-col develop-item-actions">
                                    <div class="develop-gear-wrap" class:open={menu === item.id}>
                                        <button class="develop-gear" class:open={menu === item.id} type="button" aria-label="Item menu" onclick={e => toggle(e, item.id)}></button>
                                        {#if menu === item.id}
                                            <div class="develop-menu">
                                                <a href="/develop/{category}?edit={item.id}">Configure</a>
                                                <a href="/my/create-user-ad?targetType=item&targetId={item.id}">Advertise</a>
                                                <a class="develop-menu-split" href="/catalog/item?id={item.id}">View Item</a>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                            <div class="develop-separator"></div>
                        {/each}
                    {/if}
                </section>
            </div>
        </div>
    </div>
</main>
