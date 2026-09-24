<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, pages, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/invitekeys?page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        page;
        load();
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
            <p>Generate and remove signup invitation keys.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" disabled={busy} onclick={generate}>Generate key</button>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="card">
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

    <Pagination {page} totalPages={pages(data)} {url} label="Invite key pages" />
</Layout>
