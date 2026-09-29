<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, total, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const q = $derived(router.query.q ?? "");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let search = $state("");
    let data = $state<any>(null);
    let flash = $state<Flash>(null);
    let busy = $state<Record<number, boolean>>({});

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    $effect(() => {
        search = q;
    });

    const load = () => api(`/admin/games?q=${encodeURIComponent(q)}&page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        q;
        page;
        load();
    });

    const submit = (e: Event) => {
        e.preventDefault();
        router.go("/admi/games" + (search ? "?q=" + encodeURIComponent(search) : ""));
    };

    const render = async (g: any) => {
        busy[g.id] = true;
        try {
            await api(`/admin/games/${g.id}/render`, {});
            note("success", `Queued a new thumbnail and icon for ${g.title}.`);
        } catch (err: any) {
            note("danger", err.message);
        }
        busy[g.id] = false;
    };

    const remove = async (g: any) => {
        if (!confirm(`Delete "${g.title}" and its place file? This cannot be undone.`)) return;
        try {
            await api(`/admin/games/${g.id}`, undefined, "DELETE");
            note("success", `${g.title} deleted.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const size = (bytes: any) => {
        const n = Number(bytes) || 0;
        return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
    };

    const url = (p: number) => `/admi/games?q=${encodeURIComponent(q)}&page=${p}`;
</script>

<Layout title="Games">
    <div class="admin-heading">
        <h1>Games</h1>
        <p>{num(total(data))} place{total(data) === 1 ? "" : "s"} people made. Re-render the pictures or take a place down.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        <form onsubmit={submit}>
            <input type="search" class="form-control" bind:value={search} placeholder="Title or creator">
            <button class="btn btn-primary" type="submit">Search</button>
            {#if q}<a href="/admi/games" class="btn btn-outline-secondary">Clear</a>{/if}
        </form>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover admin-table align-middle">
                <thead>
                    <tr>
                        <th></th>
                        <th>Game</th>
                        <th>Creator</th>
                        <th>Place file</th>
                        <th>Playing</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as g (g.id)}
                        <tr>
                            <td style="width:64px"><img class="admin-thumb" src={g.icon || "/img/DefaultPlaceIcon.jpg"} alt=""></td>
                            <td>
                                <a href="/game?id={g.id}" class="fw-semibold text-decoration-none">{g.title}</a>
                                <div class="admin-muted">#{g.id}{#if !g.thumbnail} &middot; no thumbnail yet{/if}</div>
                            </td>
                            <td>{#if g.creator_id}<a href="/user?id={g.creator_id}">{g.creator_name || g.creator_id}</a>{:else}Unknown{/if}</td>
                            <td>
                                {#if g.published_at}
                                    <span class="admin-pill ok">{size(g.file_size)}</span>
                                    <div class="admin-muted">updated {adminDate(g.published_at)}</div>
                                {:else}
                                    <span class="admin-muted">nothing published</span>
                                {/if}
                            </td>
                            <td>{num(g.playing)}</td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm btn-outline-primary" disabled={!g.published_at || busy[g.id]} onclick={() => render(g)}>Render</button>
                                <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(g)}>Delete</button>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="6" class="admin-empty">No games found.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Game pages" />
</Layout>
