<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let flash = $state<Flash>(null);
    let busy = $state(false);

    let code = $state("");
    let items = $state<any[]>([]);
    let nonebux = $state(0);
    let tix = $state(0);
    let maxUses = $state(0);
    let startsAt = $state("");
    let expiresAt = $state("");

    let search = $state("");
    let found = $state<any[]>([]);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/promocodes?page=${page}`).then(d => data = d).catch(err => note("danger", err.message));
    $effect(() => {
        page;
        load();
    });

    $effect(() => {
        const q = search.trim();
        if (!q) {
            found = [];
            return;
        }
        const timer = setTimeout(() => {
            api(`/admin/catalog?q=${encodeURIComponent(q)}`).then(d => {
                if (search.trim() === q) found = rows(d).slice(0, 8);
            }).catch(() => found = []);
        }, 250);
        return () => clearTimeout(timer);
    });

    const add = (item: any) => {
        if (!items.some(i => i.id === item.id)) {
            items = [...items, item];
        }
        search = "";
    };

    const drop = (id: number) => items = items.filter(i => i.id !== id);

    // datetime-local has no timezone
    const stamp = (value: string) => value ? new Date(value).toISOString() : "";

    const create = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            const d = await api("/admin/promocodes", {
                code,
                items: items.map(i => i.id),
                nonebux: Number(nonebux) || 0,
                tix: Number(tix) || 0,
                maxUses: Number(maxUses) || 0,
                startsAt: stamp(startsAt),
                expiresAt: stamp(expiresAt)
            });
            note("success", `${d.code} is ready. People redeem it at /promocodes.`);
            code = "";
            items = [];
            nonebux = 0;
            tix = 0;
            maxUses = 0;
            startsAt = "";
            expiresAt = "";
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };

    const toggle = async (promo: any) => {
        try {
            await api(`/admin/promocodes/${promo.id}/active`, {
                active: !promo.active
            });
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const remove = async (promo: any) => {
        if (!confirm(`Delete ${promo.code}? People keep what they already got, but the code stops working.`)) {
            return;
        }
        try {
            await api(`/admin/promocodes/${promo.id}`, undefined, "DELETE");
            note("success", `${promo.code} deleted.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const copyLink = (promo: any) => navigator.clipboard?.writeText(`${location.origin}/promocodes?code=${encodeURIComponent(promo.code)}`).then(() => note("success", "Link copied."));

    const stateClass = (state: string) => state === "Live" ? "text-bg-success" : state === "Scheduled" ? "text-bg-info" : "text-bg-secondary";

    const url = (p: number) => `/admi/promocodes?page=${p}`;
</script>

<Layout title="Promo Codes">
    <div class="admin-heading">
        <h1>Promo Codes</h1>
        <p>Codes anyone can redeem once at <a href="/promocodes">/promocodes</a> for items, Nonebux or Tix. Give an item that is off sale to make it promo only.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <form class="card mb-3" onsubmit={create}>
        <div class="card-header"><span class="admin-card-title">New promo code</span></div>
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label" for="promo-code">Code</label>
                    <input id="promo-code" class="form-control admin-key" maxlength="40" placeholder="NONEREVSPOOKFEST" autocomplete="off" spellcheck="false" bind:value={code}>
                    <div class="form-text">Letters, numbers, !, _ and -. Case and spaces do not matter.</div>
                </div>
                <div class="col-md-2">
                    <label class="form-label" for="promo-nonebux">Nonebux</label>
                    <input id="promo-nonebux" class="form-control" type="number" min="0" max="1000000" bind:value={nonebux}>
                </div>
                <div class="col-md-2">
                    <label class="form-label" for="promo-tix">Tix</label>
                    <input id="promo-tix" class="form-control" type="number" min="0" max="1000000" bind:value={tix}>
                </div>
                <div class="col-md-2">
                    <label class="form-label" for="promo-uses">Max uses</label>
                    <input id="promo-uses" class="form-control" type="number" min="0" max="1000000" bind:value={maxUses}>
                    <div class="form-text">0 is unlimited.</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label" for="promo-search">Items</label>
                    <input id="promo-search" class="form-control" placeholder="Search the catalog" autocomplete="off" bind:value={search}>
                    {#if found.length}
                        <div class="list-group mt-1">
                            {#each found as item (item.id)}
                                {@const limited = item.is_limited || item.is_limited_unique}
                                <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" disabled={limited} onclick={() => add(item)}>
                                    <img class="admin-thumb" src={item.thumbnail || "/img/pending.png"} alt="" width="32" height="32">
                                    <span>{item.name}</span>
                                    <span class="text-muted small ms-auto">{limited ? "Limited, can't be given" : item.price === null && item.tix_price === null ? "Off sale" : "On sale"}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                    {#if items.length}
                        <div class="d-flex flex-wrap gap-2 mt-2">
                            {#each items as item (item.id)}
                                <span class="badge text-bg-light border d-inline-flex align-items-center gap-1">
                                    {item.name}
                                    <button type="button" class="btn-close" aria-label={`Remove ${item.name}`} onclick={() => drop(item.id)}></button>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
                <div class="col-md-3">
                    <label class="form-label" for="promo-starts">Starts</label>
                    <input id="promo-starts" class="form-control" type="datetime-local" bind:value={startsAt}>
                    <div class="form-text">Empty starts now.</div>
                </div>
                <div class="col-md-3">
                    <label class="form-label" for="promo-ends">Ends</label>
                    <input id="promo-ends" class="form-control" type="datetime-local" bind:value={expiresAt}>
                    <div class="form-text">Empty never ends.</div>
                </div>
            </div>
            <button type="submit" class="btn btn-primary mt-3" disabled={busy || code.trim() === ""}>Create code</button>
        </div>
    </form>

    <div class="card">
        <div class="card-header"><span class="admin-card-title">Codes</span></div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>Code</th>
                        <th>Gives</th>
                        <th>Uses</th>
                        <th>Starts</th>
                        <th>Ends</th>
                        <th>State</th>
                        <th>Made by</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as promo (promo.id)}
                        <tr>
                            <td class="admin-key">{promo.code}</td>
                            <td>
                                {#each promo.items as item (item.id)}
                                    <div><a href="/catalog/item?id={item.id}">{item.name}</a></div>
                                {/each}
                                {#if promo.nonebux > 0}<div>N${num(promo.nonebux)}</div>{/if}
                                {#if promo.tix > 0}<div>{num(promo.tix)} Tix</div>{/if}
                            </td>
                            <td>{num(promo.uses)}{promo.max_uses > 0 ? ` / ${num(promo.max_uses)}` : ""}</td>
                            <td>{promo.starts_at > 0 ? adminDate(promo.starts_at) : "Right away"}</td>
                            <td>{promo.expires_at > 0 ? adminDate(promo.expires_at) : "Never"}</td>
                            <td><span class="badge {stateClass(promo.state)}">{promo.state}</span></td>
                            <td>
                                {#if promo.creator_name}
                                    <a href="/user?id={promo.created_by}">{promo.creator_name}</a>
                                {:else}
                                    Unknown
                                {/if}
                            </td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm btn-outline-secondary" onclick={() => copyLink(promo)}>Copy link</button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" onclick={() => toggle(promo)}>{promo.active ? "Turn off" : "Turn on"}</button>
                                <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(promo)}>Delete</button>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="8" class="text-center text-muted py-5">No promo codes yet.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Promo code pages" />
</Layout>
