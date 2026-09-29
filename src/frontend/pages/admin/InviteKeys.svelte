<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, pages, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let log = $state<any>(null);
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/invitekeys?page=${page}`).then(d => data = d).catch(err => note("danger", err.message));
    const loadLog = () => api(`/admin/invitekeys/log?page=${page}`).then(d => log = d).catch(() => {});
    $effect(() => {
        page;
        load();
        loadLog();
    });

    const generate = async () => {
        busy = true;
        try {
            await api("/admin/invitekeys", {});
            note("success", "Invite key generated.");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this invite key?")) return;
        try {
            await api(`/admin/invitekeys/${id}`, undefined, "DELETE");
            note("success", "Invite key deleted.");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const url = (p: number) => `/admi/invitekeys?page=${p}`;
</script>

<Layout title="Invite Keys">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Invite Keys</h1>
            <p>Hand out signup keys and see who used which. Registration switches live in <a href="/admi/settings">Settings</a>.</p>
        </div>
        <button type="button" class="btn btn-primary" disabled={busy} onclick={generate}>Generate key</button>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="card mb-3">
        <div class="card-header"><span class="admin-card-title">Unused keys</span></div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Key</th>
                        <th>Created by</th>
                        <th>Created</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as invite (invite.id)}
                        <tr>
                            <td>{invite.id}</td>
                            <td class="admin-key">{invite.inviteKey}</td>
                            <td>
                                {#if invite.creator_name}
                                    <a href="/user?id={invite.createdBy}">{invite.creator_name}</a>
                                {:else}
                                    Unknown
                                {/if}
                            </td>
                            <td>{adminDate(invite.createdAt)}</td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(invite.id)}>Delete</button>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="text-center text-muted py-5">No invite keys have been generated.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <div class="card-header"><span class="admin-card-title">Used keys</span></div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>Made by</th>
                        <th>Used by</th>
                        <th>Used</th>
                        <th>IP</th>
                        <th>Key</th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(log) as l (l.id)}
                        <tr>
                            <td><a href="/user?id={l.created_by}">{l.creator_name || l.created_by}</a></td>
                            <td><a href="/user?id={l.used_by}">{l.user_name || l.used_by}</a></td>
                            <td>{adminDate(l.used_at)}</td>
                            <td class="admin-key">{l.ip}</td>
                            <td class="admin-key">{l.inviteKey}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="text-center text-muted py-4">No keys have been used yet.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={Math.max(pages(data), pages(log))} {url} label="Invite key pages" />
</Layout>
