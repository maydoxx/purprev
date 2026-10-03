<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let used = $state<any>(null);
    let amount = $state(100);
    let count = $state(1);
    let busy = $state(false);
    let flash = $state<Flash>(null);
    let fresh = $state<string[]>([]);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/gamecards?page=${page}`).then(d => data = d).catch(err => note("danger", err.message));
    const loadUsed = () => api(`/admin/gamecards?page=${page}&used=true`).then(d => used = d).catch(() => {});
    $effect(() => {
        page;
        load();
        loadUsed();
    });

    const generate = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            const d = await api("/admin/gamecards", {
                amount: Number(amount),
                count: Number(count)
            });
            fresh = d.codes;
            note("success", `${d.codes.length} card${d.codes.length === 1 ? "" : "s"} worth ${num(amount)} Nonebux each.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this card? Nobody will be able to redeem it.")) {
            return;
        }
        try {
            await api(`/admin/gamecards/${id}`, undefined, "DELETE");
            note("success", "Card deleted.");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const copy = () => navigator.clipboard?.writeText(fresh.join("\n")).then(() => note("success", "Codes copied."));

    const url = (p: number) => `/admi/gamecards?page=${p}`;
</script>

<Layout title="Game Cards">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Game Cards</h1>
            <p>Make Nonebux cards to hand out. People redeem them at <a href="/redeem">/redeem</a>.</p>
        </div>
        <form class="d-flex align-items-end gap-2" onsubmit={generate}>
            <div>
                <label class="form-label mb-1" for="card-amount">Nonebux</label>
                <input id="card-amount" class="form-control" type="number" min="1" max="1000000" bind:value={amount}>
            </div>
            <div>
                <label class="form-label mb-1" for="card-count">Cards</label>
                <input id="card-count" class="form-control" type="number" min="1" max="100" bind:value={count}>
            </div>
            <button type="submit" class="btn btn-primary" disabled={busy}>Generate</button>
        </form>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    {#if fresh.length}
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span class="admin-card-title">New codes</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick={copy}>Copy all</button>
            </div>
            <div class="card-body">
                {#each fresh as code}
                    <div class="admin-key">{code}</div>
                {/each}
            </div>
        </div>
    {/if}

    <div class="card mb-3">
        <div class="card-header"><span class="admin-card-title">Unredeemed cards</span></div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Code</th>
                        <th>Nonebux</th>
                        <th>Made by</th>
                        <th>Created</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as card (card.id)}
                        <tr>
                            <td>{card.id}</td>
                            <td class="admin-key">{card.code}</td>
                            <td>{num(card.amount)}</td>
                            <td>
                                {#if card.creator_name}
                                    <a href="/user?id={card.created_by}">{card.creator_name}</a>
                                {:else}
                                    Unknown
                                {/if}
                            </td>
                            <td>{adminDate(card.created_at)}</td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(card.id)}>Delete</button>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="6" class="text-center text-muted py-5">No cards are waiting to be redeemed.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <div class="card-header"><span class="admin-card-title">Redeemed cards</span></div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>Code</th>
                        <th>Nonebux</th>
                        <th>Made by</th>
                        <th>Redeemed by</th>
                        <th>Redeemed</th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(used) as card (card.id)}
                        <tr>
                            <td class="admin-key">{card.code}</td>
                            <td>{num(card.amount)}</td>
                            <td><a href="/user?id={card.created_by}">{card.creator_name || card.created_by}</a></td>
                            <td><a href="/user?id={card.redeemed_by}">{card.user_name || card.redeemed_by}</a></td>
                            <td>{adminDate(card.redeemed_at)}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="text-center text-muted py-4">No cards have been redeemed yet.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={Math.max(pages(data), pages(used))} {url} label="Game card pages" />
</Layout>
