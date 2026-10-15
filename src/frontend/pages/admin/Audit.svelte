<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, total, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const q = $derived((router.query.q ?? "").trim());
    const method = $derived((router.query.method ?? "").trim().toUpperCase());
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let flash = $state<Flash>(null);
    let open = $state<Record<number, boolean>>({});
    let term = $state("");

    const load = () => api(`/admin/audit?q=${encodeURIComponent(q)}&method=${encodeURIComponent(method)}&page=${page}`)
        .then(d => data = d)
        .catch(err => flash = {
            type: "danger",
            message: err.message
        });

    $effect(() => {
        q;
        method;
        page;
        load();
    });

    const filterUrl = (m: string) => {
        const params = new URLSearchParams();
        if (q) {
            params.set("q", q);
        }
        if (m) {
            params.set("method", m);
        }
        const s = params.toString();
        return `/admi/audit${s ? `?${s}` : ""}`;
    };

    const search = (e: Event) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (term.trim()) {
            params.set("q", term.trim());
        }
        if (method) {
            params.set("method", method);
        }
        const s = params.toString();
        router.go(`/admi/audit${s ? `?${s}` : ""}`);
    };

    const url = (p: number) => {
        const params = new URLSearchParams();
        if (q) {
            params.set("q", q);
        }
        if (method) {
            params.set("method", method);
        }
        params.set("page", String(p));
        return `/admi/audit?${params.toString()}`;
    };

    const pretty = (json: string) => {
        try {
            return JSON.stringify(JSON.parse(json), null, 2);
        } catch {
            return json;
        }
    };
</script>

<Layout title="Audit Log">
    <div class="admin-heading">
        <h1>Audit Log</h1>
        <p>{num(total(data))} recorded action{total(data) === 1 ? "" : "s"}. Every admin-panel request and every state change made by an admin account.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        <form class="d-flex gap-2" onsubmit={search}>
            <input class="form-control form-control-sm admin-search" placeholder="Search admin, path or target" bind:value={term}>
            <button class="btn btn-sm btn-primary" type="submit">Search</button>
            {#if q}
                <a class="btn btn-sm btn-outline-secondary" href={filterUrl(method)}>Clear</a>
            {/if}
        </form>
        <div class="d-flex gap-2">
            {#each ["", "POST", "PATCH", "PUT", "DELETE"] as m}
                <a class="btn btn-sm" class:btn-primary={method === m} class:btn-outline-secondary={method !== m} href={filterUrl(m)}>{m || "All"}</a>
            {/each}
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover admin-table align-middle">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Admin</th>
                        <th>Action</th>
                        <th>When</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as r (r.id)}
                        <tr>
                            <td>{r.id}</td>
                            <td>
                                {#if Number(r.admin_id) > 0}
                                    <a href="/user?id={r.admin_id}">{r.admin_name || r.admin_id}</a>
                                {:else}
                                    <span class="admin-muted">anonymous</span>
                                {/if}
                                {#if r.ip}
                                    <div class="admin-muted">{r.ip}</div>
                                {/if}
                            </td>
                            <td>
                                <span class="admin-pill" class:danger={r.method === "DELETE"}>{r.method}</span>
                                <span class="fw-semibold">{r.target}</span>
                                {#if Number(r.status) >= 400}
                                    <span class="admin-pill danger">{r.status}</span>
                                {:else}
                                    <span class="admin-muted">{r.status}</span>
                                {/if}
                                <div class="admin-muted">{r.path}</div>
                            </td>
                            <td>{adminDate(r.created_at)}</td>
                            <td class="admin-actions">
                                {#if r.details}
                                    <button type="button" class="btn btn-link btn-sm p-0" onclick={() => open[r.id] = !open[r.id]}>
                                        {open[r.id] ? "Hide" : "Details"}
                                    </button>
                                {/if}
                            </td>
                        </tr>
                        {#if open[r.id] && r.details}
                            <tr>
                                <td colspan="5"><pre class="admin-audit-json">{pretty(r.details)}</pre></td>
                            </tr>
                        {/if}
                    {:else}
                        <tr>
                            <td colspan="5" class="admin-empty">No audit entries yet.</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Audit pages" />
</Layout>
