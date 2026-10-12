<script lang="ts">
    import { untrack } from "svelte";
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, total, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const kinds: [string, string][] = [
        ["place", "Places"],
        ["audio", "Audio"],
        ["status", "Statuses"],
        ["bio", "About"]
    ];

    const kind = $derived((router.query.kind && kinds.some(([k]) => k === router.query.kind) ? router.query.kind : "place") as string);
    const q = $derived(router.query.q ?? "");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let search = $state("");
    let data = $state<any>(null);
    let flash = $state<Flash>(null);
    let reason = $state<Record<number, string>>({});
    let confirm = $state(0);
    let busy = $state(false);
    let playing = $state(0);
    let player = $state<HTMLAudioElement>();

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/content?kind=${kind}&q=${encodeURIComponent(q)}&page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        search = q;
    });

    $effect(() => {
        kind;
        q;
        page;
        confirm = 0;
        untrack(() => {
            player?.pause();
            playing = 0;
        });
        load();
    });

    const submit = (e: Event) => {
        e.preventDefault();
        router.go(`/admi/content?kind=${kind}&q=${encodeURIComponent(search)}`);
    };

    const remove = async (item: any) => {
        if (!(reason[item.id]?.trim() ?? "")) {
            return;
        }
        busy = true;
        try {
            await api("/admin/content/delete", {
                kind,
                id: item.id,
                reason: reason[item.id].trim()
            });
            note("success", `Deleted ${kind} #${item.id}.`);
            confirm = 0;
            load();
        } catch (err: any) {
            note("danger", err.message);
        } finally {
            busy = false;
        }
    };

    const restore = async (item: any) => {
        busy = true;
        try {
            await api("/admin/content/restore", {
                kind,
                id: item.id
            });
            note("success", `Restored ${kind} #${item.id}.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        } finally {
            busy = false;
        }
    };

    const url = (p: number) => `/admi/content?kind=${kind}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${p}`;

    const play = (id: number) => {
        if (!player) {
            return;
        }
        if (playing === id) {
            player.pause();
            playing = 0;
            return;
        }
        player.src = `/asset/?id=${id}`;
        player.play().then(() => playing = id).catch(() => playing = 0);
    };
</script>

<Layout title="Content">
    <div class="admin-heading">
        <h1>Content Deletion</h1>
        <p>{num(total(data))} items. Deleted places and audio also have their files removed and can't be replaced.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        {#each kinds as [id, label]}
            <a href="/admi/content?kind={id}" class="btn btn-sm" class:btn-primary={kind === id} class:btn-outline-secondary={kind !== id}>{label}</a>
        {/each}
    </div>

    <div class="admin-toolbar">
        <form onsubmit={submit}>
            <input class="form-control" type="search" placeholder="Search by text or owner" bind:value={search}>
            <button class="btn btn-primary btn-sm" type="submit">Search</button>
        </form>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover admin-table align-middle">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Content</th>
                        <th>Owner</th>
                        <th>When</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as item (item.id)}
                        <tr>
                            <td>{item.id}</td>
                            <td>
                                <div class="admin-content-cell">
                                    {#if kind === "audio"}
                                        <button
                                            type="button"
                                            class="admin-audio"
                                            class:playing={playing === item.id}
                                            aria-label={playing === item.id ? "Stop preview" : "Preview audio"}
                                            title={item.deleted ? "File removed, can't be previewed" : "Preview audio"}
                                            disabled={busy || item.deleted}
                                            onclick={() => play(item.id)}
                                        >
                                            {#if playing === item.id}
                                                <svg viewBox="0 0 52 52" aria-hidden="true">
                                                    <rect x="14" y="14" width="24" height="24" fill="currentColor" />
                                                </svg>
                                            {:else}
                                                <svg viewBox="0 0 52 52" aria-hidden="true">
                                                    <path fill="currentColor" d="M16 10l28 16-28 16z" />
                                                </svg>
                                            {/if}
                                        </button>
                                    {/if}
                                    <div class="admin-content-text" title={item.text}>{item.text || "\u2014"}</div>
                                </div>
                                {#if confirm === item.id}
                                    <div class="admin-confirm">
                                        <input class="form-control" type="text" placeholder="Reason for deletion" maxlength="500" bind:value={reason[item.id]} disabled={busy}>
                                        <button class="btn btn-sm btn-danger" onclick={() => remove(item)} disabled={busy}>Confirm</button>
                                        <button class="btn btn-sm btn-outline-secondary" onclick={() => confirm = 0} disabled={busy}>Cancel</button>
                                    </div>
                                {/if}
                            </td>
                            <td>
                                <a href="/user?id={item.user_id}">{item.username}</a>
                            </td>
                            <td>{adminDate(item.created_at)}</td>
                            <td>
                                {#if item.deleted}
                                    <span class="admin-pill danger">Moderated</span>
                                {:else}
                                    <span class="admin-pill ok">Clean</span>
                                {/if}
                            </td>
                            <td class="admin-actions">
                                {#if item.deleted}
                                    <button type="button" class="btn btn-sm btn-outline-primary" onclick={() => restore(item)} disabled={busy}>Restore</button>
                                {:else}
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => {
                                        confirm = item.id;
                                        reason[item.id] = "";
                                    }} disabled={busy}>Delete</button>
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="6" class="admin-empty">Nothing found.</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Content pages" />

    <audio bind:this={player} onended={() => playing = 0} preload="none"></audio>
</Layout>