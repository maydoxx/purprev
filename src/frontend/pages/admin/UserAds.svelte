<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, total, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const tabs = ["pending", "approved", "rejected"];

    const status = $derived(tabs.includes(router.query.status ?? "") ? router.query.status! : "pending");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/ads?status=${status}&page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        status;
        page;
        load();
    });

    const decide = async (ad: any, to: "approve" | "reject") => {
        if (to === "reject" && ad.running && !confirm("This ad is running right now. Reject it anyway? The bid is not refunded.")) return;
        try {
            await api(`/admin/ads/${ad.id}/${to}`, {});
            note("success", `${ad.name} ${to === "approve" ? "approved" : "rejected"}.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const url = (p: number) => `/admi/user-ads?status=${status}&page=${p}`;
</script>

<svelte:head>
    <link rel="stylesheet" href="/css/ads.css">
</svelte:head>

<Layout title="User Ads">
    <div class="admin-heading">
        <h1>User Ads</h1>
        <p>{num(total(data))} {status} ad{total(data) === 1 ? "" : "s"}. Ads only run after they are approved here.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        {#each tabs as tab}
            <a href="/admi/user-ads?status={tab}" class="btn btn-sm" class:btn-primary={status === tab} class:btn-outline-secondary={status !== tab}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</a>
        {/each}
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover admin-table align-middle">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Ad</th>
                        <th>Advertises</th>
                        <th>By</th>
                        <th>Created</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as ad (ad.id)}
                        <tr>
                            <td>{ad.id}</td>
                            <td>
                                <a href={ad.image} target="_blank">
                                    <img class="admin-ad-preview" src={ad.image} alt={ad.name}>
                                </a>
                                <div class="fw-semibold mt-1">{ad.name}</div>
                                <div class="admin-muted">
                                    {ad.size}, {ad.width}x{ad.height}
                                    {#if ad.running}
                                        &middot; running
                                    {/if}
                                </div>
                            </td>
                            <td>
                                <span class="admin-pill">{ad.target.type}</span>
                                <a href={ad.target.url} class="text-decoration-none">{ad.target.name || `#${ad.target.id}`}</a>
                                {#if ad.reports > 0}
                                    <div class="admin-muted">
                                        <a href="/admi/reports">{ad.reports} open report{ad.reports === 1 ? "" : "s"}</a>
                                    </div>
                                {/if}
                            </td>
                            <td>
                                <a href="/user?id={ad.creator_id}">{ad.creator_name || ad.creator_id}</a>
                            </td>
                            <td>{adminDate(ad.created_at)}</td>
                            <td class="admin-actions">
                                {#if ad.status !== "approved"}
                                    <button type="button" class="btn btn-sm btn-outline-primary" onclick={() => decide(ad, "approve")}>Approve</button>
                                {/if}
                                {#if ad.status !== "rejected"}
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => decide(ad, "reject")}>Reject</button>
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="6" class="admin-empty">No {status} ads.</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Ad pages" />
</Layout>
