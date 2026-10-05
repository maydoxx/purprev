<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, pages, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const actionNames: Record<number, string> = {
        1: "Warning",
        2: "1 day ban",
        3: "3 day ban",
        4: "7 day ban",
        5: "14 day ban",
        6: "Account deletion",
        7: "Reminder"
    };

    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/moderation?page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        page;
        load();
    });

    const undo = async (userId: number) => {
        if (!confirm("Remove this moderation action?")) return;
        try {
            await api(`/admin/moderation/${userId}`, undefined, "DELETE");
            note("success", "Moderation action removed.");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const expires = (row: any) => Number(row.action) === 6 ? "Never" : Number(row.expiresAt) > 0 ? adminDate(row.expiresAt) : "Immediate";
    const url = (p: number) => `/admi/viewmoderation?page=${p}`;
</script>

<Layout title="Active Moderation">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Active Moderation</h1>
            <p>Accounts that currently have an active moderation action.</p>
        </div>
        <a href="/admi/moderation" class="btn btn-primary btn-sm">New action</a>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>User</th>
                        <th>Action</th>
                        <th>Reason</th>
                        <th>Moderator</th>
                        <th>Reviewed</th>
                        <th>Expires</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as row (row.id)}
                        <tr>
                            <td><a href="/user?id={row.id}" class="fw-semibold text-decoration-none">{row.username}</a></td>
                            <td><span class="badge text-bg-danger">{actionNames[Number(row.action)] ?? "Unknown"}</span></td>
                            <td style="min-width:220px">
                                {row.reason || ""}
                                {#each row.offenses ?? [] as offense}
                                    <div class="small text-secondary mt-1">{offense.label ? `${offense.label}: ` : ""}{offense.body}</div>
                                {/each}
                            </td>
                            <td>{row.moderator_name || "Unknown"}</td>
                            <td>{adminDate(row.createdAt)}</td>
                            <td>{expires(row)}</td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm btn-outline-primary" onclick={() => undo(row.id)}>Undo</button>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="7" class="text-center text-muted py-5">No active moderation actions.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Moderation pages" />
</Layout>
