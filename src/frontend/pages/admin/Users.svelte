<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { rows, total, pages, num, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const q = $derived(router.query.q ?? "");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let search = $state("");
    let data = $state<any>(null);
    let users = $state<any[]>([]);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    $effect(() => {
        search = q;
    });

    $effect(() => {
        api(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            data = d;
            users = rows(d);
        }).catch(err => note("danger", err.message));
    });

    const submit = (e: Event) => {
        e.preventDefault();
        router.go("/admi/users" + (search ? "?q=" + encodeURIComponent(search) : ""));
    };

    const save = async (u: any) => {
        if (u.id === session.me?.id && Number(u.admin) < 1) {
            note("danger", "You cannot remove your own admin access here.");
            return;
        }
        try {
            await api(`/admin/users/${u.id}`, {
                admin_level: Number(u.admin),
                currency: Number(u.currency)
            }, "PATCH");
            note("success", "User updated.");
            if (u.id === session.me?.id) session.refresh();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const url = (p: number) => `/admi/users?q=${encodeURIComponent(q)}&page=${p}`;
</script>

<Layout title="Manage Users">
    <div class="admin-heading">
        <h1>Users</h1>
        <p>Search accounts, change admin level, or adjust currency.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="card mb-3">
        <div class="card-body">
            <form onsubmit={submit} class="row g-2">
                <div class="col-md-8 col-lg-6">
                    <input type="search" class="form-control" bind:value={search} placeholder="Username or email">
                </div>
                <div class="col-auto">
                    <button class="btn btn-primary" type="submit">Search</button>
                </div>
                {#if q}
                    <div class="col-auto"><a href="/admi/users" class="btn btn-outline-secondary">Clear</a></div>
                {/if}
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <span class="admin-card-title">Accounts</span>
            <span class="admin-muted">{num(total(data))} result{total(data) === 1 ? "" : "s"}</span>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table align-middle">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Status</th>
                        <th style="min-width:110px">Admin</th>
                        <th style="min-width:150px">Nonebux</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each users as u (u.id)}
                        <tr>
                            <td>{u.id}</td>
                            <td>
                                <a class="fw-semibold text-decoration-none" href="/user?id={u.id}">{u.username}</a>
                                <div class="admin-muted">{u.email || "No email"}</div>
                            </td>
                            <td>
                                {#if u.ongoing_action_id != null}
                                    <span class="badge text-bg-danger">Moderated</span>
                                {:else if Number(u.admin) > 0}
                                    <span class="badge text-bg-primary">Admin</span>
                                {:else}
                                    <span class="badge text-bg-secondary">User</span>
                                {/if}
                            </td>
                            <td><input type="number" class="form-control form-control-sm" min="0" max="255" bind:value={u.admin}></td>
                            <td><input type="number" class="form-control form-control-sm" min="0" bind:value={u.currency}></td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm btn-primary" onclick={() => save(u)}>Save</button>
                                <a class="btn btn-sm btn-outline-danger" href="/admi/moderation?username={encodeURIComponent(u.username)}">Moderate</a>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="6" class="text-center text-muted py-5">No users found.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="User pages" />
</Layout>
