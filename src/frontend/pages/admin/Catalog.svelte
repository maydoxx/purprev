<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { rows, total, pages, num, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const categories = ["Hat", "Face", "T-Shirt", "Shirt", "Pants", "Gear", "Package", "Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"];

    const q = $derived(router.query.q ?? "");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const edit = $derived(Number(router.query.edit) || 0);
    const creating = $derived(router.query.new === "1");
    const showForm = $derived(creating || edit > 0);
    let rendering = $state<Record<number, boolean>>({});

    const blank = () => ({
        id: 0,
        name: "",
        description: "",
        creator: session.me?.username ?? "",
        category: "Hat",
        asset_id: "",
        price: "",
        tix_price: "",
        thumbnail: "",
        is_featured: false,
        bc_only: false,
        is_starter: false,
        package_parts: "",
        genre: "All",
        is_limited: false,
        is_limited_unique: false,
        limited_stock: "",
        limited_sold: 0
    });

    let search = $state("");
    let data = $state<any>(null);
    let form = $state<any>(blank());
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/catalog?q=${encodeURIComponent(q)}&page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        search = q;
    });

    $effect(() => {
        q;
        page;
        load();
    });

    $effect(() => {
        if (!edit) {
            form = blank();
            return;
        }
        const item = rows(data).find(i => i.id === edit);
        if (!item) return;
        form = {
            id: item.id,
            name: item.name ?? "",
            description: item.description ?? "",
            creator: item.creator_name ?? "",
            category: item.category ?? "Hat",
            asset_id: item.asset_id ?? "",
            price: item.price ?? "",
            tix_price: item.tix_price ?? "",
            thumbnail: item.thumbnail ?? "",
            is_featured: Number(item.is_featured) === 1,
            bc_only: Number(item.bc_only) === 1,
            is_starter: Number(item.is_starter) === 1,
            package_parts: item.package_parts ?? "",
            genre: item.genre ?? "All",
            is_limited: Number(item.is_limited) === 1,
            is_limited_unique: Number(item.is_limited_unique) === 1,
            limited_stock: item.limited_stock ?? "",
            limited_sold: Number(item.limited_sold) || 0
        };
    });

    const opt = (v: any) => v === "" || v == null ? undefined : Number(v);

    const save = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            const body = {
                name: form.name,
                description: form.description,
                creator: form.creator,
                category: form.category,
                asset_id: opt(form.asset_id),
                price: opt(form.price),
                tix_price: opt(form.tix_price),
                thumbnail: form.thumbnail,
                is_featured: form.is_featured,
                bc_only: form.bc_only,
                is_starter: form.is_starter,
                package_parts: form.package_parts,
                genre: form.genre,
                is_limited: form.is_limited || form.is_limited_unique,
                is_limited_unique: form.is_limited_unique,
                limited_stock: opt(form.limited_stock)
            };
            if (form.id > 0) {
                await api(`/admin/catalog/${form.id}`, body, "PATCH");
                note("success", "Catalog item updated.");
            } else {
                await api("/admin/catalog", body);
                note("success", "Catalog item created.");
                form = blank();
            }
            router.go("/admi/catalog");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this catalog item?")) return;
        try {
            await api(`/admin/catalog/${id}`, undefined, "DELETE");
            note("success", "Catalog item deleted.");
            if (edit === id) router.go("/admi/catalog");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const submit = (e: Event) => {
        e.preventDefault();
        router.go("/admi/catalog" + (search ? "?q=" + encodeURIComponent(search) : ""));
    };

    const render = async (item: any) => {
        rendering[item.id] = true;
        try {
            await api(`/admin/catalog/${item.id}/render`, {});
            note("success", `Queued a new thumbnail for ${item.name}.`);
        } catch (err: any) {
            note("danger", err.message);
        }
        rendering[item.id] = false;
    };

    const price = (p: any) => p == null ? "Off Sale" : Number(p) === 0 ? "Free" : num(p);
    const url = (p: number) => `/admi/catalog?q=${encodeURIComponent(q)}&page=${p}`;
</script>

<Layout title="Manage Catalog">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Catalog</h1>
            <p>{num(total(data))} item{total(data) === 1 ? "" : "s"} in the shop.</p>
        </div>
        {#if showForm}
            <a href="/admi/catalog" class="btn btn-outline-secondary">Back to the list</a>
        {:else}
            <a href="/admi/catalog?new=1" class="btn btn-primary">New item</a>
        {/if}
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    {#if showForm}
        <div class="card mb-4 admin-form-card">
            <div class="card-header">
                <span class="admin-card-title">{form.id > 0 ? `Edit item #${form.id}` : "New catalog item"}</span>
            </div>
            <div class="card-body">
                <form onsubmit={save}>
                    <div class="row g-3">
                        <div class="col-md-8">
                            <label class="form-label" for="name">Name</label>
                            <input class="form-control" id="name" maxlength="80" bind:value={form.name}>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="category">Category</label>
                            <select class="form-select" id="category" bind:value={form.category}>
                                {#each categories as c}
                                    <option value={c}>{c}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label" for="creator">Creator username</label>
                            <input class="form-control" id="creator" required bind:value={form.creator}>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label" for="genre">Genre</label>
                            <select class="form-select" id="genre" bind:value={form.genre}>
                                {#each data?.genres ?? ["All"] as g}
                                    <option value={g}>{g}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="asset_id">Asset id</label>
                            <input class="form-control" id="asset_id" inputmode="numeric" bind:value={form.asset_id} placeholder="e.g. 1028606">
                            <div class="form-text">The model served by /asset/?id=. Use a Roblox asset id or the id of a file in uploads/assets/. With a Roblox id you can leave name, description and thumbnail blank and they are imported.</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="price">Price</label>
                            <input type="number" min="0" class="form-control" id="price" bind:value={form.price} placeholder="Leave blank for Off Sale">
                            <div class="form-text">Nonebux price. 0 = Free.</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="tix-price">Tix price</label>
                            <input type="number" min="0" max="2000000000" class="form-control" id="tix-price" bind:value={form.tix_price} placeholder="Leave blank for no Tix option">
                            <div class="form-text">Leave both prices blank for Off Sale.</div>
                        </div>

                        <div class="col-12">
                            <label class="form-label" for="thumbnail">Thumbnail path or URL</label>
                            <input class="form-control" id="thumbnail" maxlength="255" bind:value={form.thumbnail} placeholder="/img/pending.png">
                        </div>

                        <div class="col-12">
                            <label class="form-label" for="description">Description</label>
                            <textarea class="form-control" id="description" rows="4" bind:value={form.description}></textarea>
                        </div>

                        <div class="col-md-4">
                            <div class="form-check mt-4">
                                <input class="form-check-input" type="checkbox" id="is_limited" bind:checked={form.is_limited}>
                                <label class="form-check-label" for="is_limited">Limited</label>
                            </div>
                            <div class="form-text">Tradeable collectible. Usually set it Off Sale once the original sale ends.</div>
                        </div>

                        <div class="col-md-4">
                            <div class="form-check mt-4">
                                <input class="form-check-input" type="checkbox" id="is_limited_unique" bind:checked={form.is_limited_unique}>
                                <label class="form-check-label" for="is_limited_unique">Limited U</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="bc_only" bind:checked={form.bc_only}>
                                <label class="form-check-label" for="bc_only">Builders Club only</label>
                            </div>
                            <div class="form-text">Finite stock with serial numbers. Also counts as Limited.</div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label" for="limited_stock">Limited U stock</label>
                            <input type="number" min="1" class="form-control" id="limited_stock" bind:value={form.limited_stock} placeholder="e.g. 100">
                            {#if form.limited_sold > 0}
                                <div class="form-text">{num(form.limited_sold)} already sold.</div>
                            {/if}
                        </div>

                        {#if form.category === "Package"}
                            <div class="col-12">
                                <label class="form-label" for="package_parts">Body parts</label>
                                <input class="form-control" id="package_parts" bind:value={form.package_parts} placeholder="filled from the bundle, or asset ids separated by ;">
                                <div class="form-text">For a package the asset id above is the Roblox bundle id, 109 is ROBLOX Boy. Name, picture and parts come from Roblox when left empty.</div>
                            </div>
                        {/if}

                        <div class="col-12">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="is_featured" bind:checked={form.is_featured}>
                                <label class="form-check-label" for="is_featured">Featured item</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="is_starter" bind:checked={form.is_starter}>
                                <label class="form-check-label" for="is_starter">Starter item, every new account gets it and wears it</label>
                            </div>
                            <div class="form-text">Mark two packages as starters and new accounts get one of them at random, like the 2014 Man and Woman avatars.</div>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary mt-3" disabled={busy}>{form.id > 0 ? "Save changes" : "Create item"}</button>
                </form>
            </div>
        </div>
    {:else}
        <div class="admin-toolbar">
            <form onsubmit={submit}>
                <input type="search" class="form-control" bind:value={search} placeholder="Search catalog items">
                <button class="btn btn-primary" type="submit">Search</button>
                {#if q}<a href="/admi/catalog" class="btn btn-outline-secondary">Clear</a>{/if}
            </form>
        </div>

        <div class="card">
            <div class="table-responsive">
                <table class="table table-hover mb-0 admin-table">
                    <thead class="table-light">
                        <tr>
                            <th></th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Creator</th>
                            <th>Price</th>
                            <th>Limited</th>
                            <th>Featured</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each rows(data) as item (item.id)}
                            <tr>
                                <td style="width:70px"><img class="admin-thumb" src={item.thumbnail || "/img/pending.png"} alt=""></td>
                                <td>
                                    <span class="fw-semibold">{item.name}</span>
                                    <div class="admin-muted">#{item.id}{#if item.asset_id} &middot; asset {item.asset_id}{/if}</div>
                                </td>
                                <td>{item.category}</td>
                                <td>{item.creator_name || "Unknown"}</td>
                                <td>
                                    {#if item.price !== null}
                                        {price(item.price)} Nonebux
                                    {/if}
                                    {#if item.tix_price !== null}
                                        <div>{price(item.tix_price)} Tix</div>
                                    {/if}
                                    {#if item.price === null && item.tix_price === null}
                                        Off Sale
                                    {/if}
                                </td>
                                <td>
                                    {#if Number(item.is_limited_unique) === 1}
                                        <span class="badge text-bg-warning">Limited U</span>
                                        <div class="admin-muted">{num(item.limited_sold)} / {num(item.limited_stock)}</div>
                                    {:else if Number(item.is_limited) === 1}
                                        <span class="badge text-bg-success">Limited</span>
                                    {:else}
                                        <span class="text-muted">No</span>
                                    {/if}
                                </td>
                                <td>
                                    {#if Number(item.is_featured) === 1}
                                        <span class="badge text-bg-success">Yes</span>
                                    {:else}
                                        <span class="text-muted">No</span>
                                    {/if}
                                </td>
                                <td class="admin-actions">
                                    <a href="/admi/catalog?edit={item.id}" class="btn btn-sm btn-outline-primary">Edit</a>
                                    {#if item.asset_id}<button type="button" class="btn btn-sm btn-outline-secondary" disabled={rendering[item.id]} onclick={() => render(item)}>Render</button>{/if}
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(item.id)}>Delete</button>
                                </td>
                            </tr>
                        {:else}
                            <tr><td colspan="8" class="admin-empty">No catalog items found.</td></tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>

        <Pagination {page} totalPages={pages(data)} {url} label="Catalog pages" />
    {/if}
</Layout>
