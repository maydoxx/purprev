<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, total, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const status = $derived(router.query.status === "closed" ? "closed" : "open");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let flash = $state<Flash>(null);
    let open = $state<Record<number, boolean>>({});

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/reports?status=${status}&page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        status;
        page;
        load();
    });

    const close = async (r: any) => {
        try {
            await api(`/admin/reports/${r.id}/close`, {});
            note("success", `Report #${r.id} closed.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const url = (p: number) => `/admi/reports?status=${status}&page=${p}`;

    const kind = (r: any) => r.source === "game" ? "In-game" : r.type.charAt(0).toUpperCase() + r.type.slice(1);
</script>

<Layout title="Reports">
    <div class="admin-heading">
        <h1>Abuse Reports</h1>
        <p>{num(total(data))} {status} report{total(data) === 1 ? "" : "s"} from the site and from inside games.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        <a href="/admi/reports?status=open" class="btn btn-sm" class:btn-primary={status === "open"} class:btn-outline-secondary={status !== "open"}>Open</a>
        <a href="/admi/reports?status=closed" class="btn btn-sm" class:btn-primary={status === "closed"} class:btn-outline-secondary={status !== "closed"}>Closed</a>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover admin-table align-middle">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Reported</th>
                        <th>Reason</th>
                        <th>By</th>
                        <th>When</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as r (r.id)}
                        <tr>
                            <td>{r.id}</td>
                            <td>
                                <span class="admin-pill" class:danger={r.source === "game"}>{kind(r)}</span>
                                {#if r.target_url}
                                    <a href={r.target_url} class="fw-semibold text-decoration-none">{r.target_name}</a>
                                {:else}
                                    <span class="fw-semibold">{r.target_name}</span>
                                {/if}
                                {#if r.source === "game" && r.place_id}
                                    <div class="admin-muted">
                                        in
                                        <a href="/game?id={r.place_id}">place {r.place_id}</a>
                                        {#if r.job_id}
                                            &middot; job {r.job_id}
                                        {/if}
                                    </div>
                                {/if}
                            </td>
                            <td>
                                <div>{r.reason}</div>
                                {#if r.comment}
                                    <div class="admin-muted">{r.comment}</div>
                                {/if}
                                {#if r.chat_log?.length}
                                    <button type="button" class="btn btn-link btn-sm p-0" onclick={() => open[r.id] = !open[r.id]}>
                                        {open[r.id] ? "Hide" : "Show"} chat ({r.chat_log.length})
                                    </button>
                                    {#if open[r.id]}
                                        <ul class="admin-chat-log">
                                            {#each r.chat_log as m}
                                                <li>
                                                    <a href="/user?id={m.user_id}">{m.user_id}</a>
                                                    <span>{m.text}</span>
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                {/if}
                            </td>
                            <td>
                                {#if r.reporter_id}
                                    <a href="/user?id={r.reporter_id}">{r.reporter_name || r.reporter_id}</a>
                                {:else}
                                    Unknown
                                {/if}
                            </td>
                            <td>
                                {adminDate(r.created_at)}
                                {#if r.status === "closed" && r.closed_by_name}
                                    <div class="admin-muted">closed by {r.closed_by_name}</div>
                                {/if}
                            </td>
                            <td class="admin-actions">
                                {#if r.status === "open"}
                                    <button type="button" class="btn btn-sm btn-outline-primary" onclick={() => close(r)}>Close</button>
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="6" class="admin-empty">No {status} reports.</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Report pages" />
</Layout>
