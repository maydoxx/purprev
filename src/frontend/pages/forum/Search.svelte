<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { list, pageNum, replies, searchDate, forumUrl, threadUrl } from "./common";
    import { top } from "./Bits.svelte";

    const q = $derived((router.query.q ?? "").trim());
    const page = $derived(pageNum(router.query.page));
    const forumFilter = $derived(Number(router.query.forum) || 0);

    let input = $state("");
    let forumId = $state(0);
    let size = $state("10");
    let find = $state("posts");
    let match = $state("all");
    let simple = $state(false);
    let forums = $state<any[]>([]);
    let rows = $state<any[]>([]);
    let pages = $state(1);
    let loaded = $state(false);
    let error = $state("");

    api("/forum").then(d => {
        forums = list(d.groups).flatMap(g => list(g.forums)).sort((a, b) => a.name.localeCompare(b.name));
    }).catch(() => {});

    $effect(() => {
        input = q;
        forumId = forumFilter;
        size = router.query.size ?? "10";
        find = router.query.find ?? "posts";
        match = router.query.match ?? "all";
        rows = [];
        pages = 1;
        loaded = false;
        error = "";
        if (!q) {
            return;
        }
        api(`/forum/search?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            rows = list(d.results);
            pages = Math.max(1, Number(d.pages) || 1);
            loaded = true;
        }).catch(err => {
            error = err.message;
        });
    });

    const query = (p: number) => {
        const params = new URLSearchParams({
            q: input
        });
        if (forumId) {
            params.set("forum", String(forumId));
        }
        if (size !== "10") {
            params.set("size", size);
        }
        if (find !== "posts") {
            params.set("find", find);
        }
        if (match !== "all") {
            params.set("match", match);
        }
        if (p > 1) {
            params.set("page", String(p));
        }
        return "/forum/search?" + params;
    };

    const submit = (e: Event) => {
        e.preventDefault();
        router.go(query(1));
    };

    const shown = $derived(forumFilter ? rows.filter(r => Number(r.forum_id) === forumFilter) : rows);
</script>

{#snippet resultsPager()}
    <tr class="forum-results-pager">
        <td>{#if page > 1}<a href={query(page - 1)}>Prev</a>{:else}<span>Prev</span>{/if}&nbsp;{#if page < pages}<a href={query(page + 1)}>Next</a>{:else}<span>Next</span>{/if}</td>
    </tr>
{/snippet}

<svelte:head>
    <title>Forum Search - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top()}
        <form onsubmit={submit}>
            <table class="forum-table forum-search-form">
                <colgroup>
                    <col class="forum-col-gutter">
                    <col class="forum-col-label">
                    <col class="forum-col-check">
                    <col>
                </colgroup>
                <tbody>
                    <tr class="forum-head">
                        <th colspan="4">Search</th>
                    </tr>
                    {#if !simple}
                        <tr>
                            <td></td>
                            <td><span class="forum-label">Forums</span></td>
                            <td colspan="2">
                                <select class="forum-select" name="forum" bind:value={forumId}>
                                    <option value={0}>All Forums</option>
                                    {#each forums as f}
                                        <option value={f.id}>{f.name}</option>
                                    {/each}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td><span class="forum-label">Results Per Page</span></td>
                            <td colspan="2">
                                <select class="forum-select" name="size" bind:value={size}>
                                    <option value="10">10 Results</option>
                                    <option value="25">25 Results</option>
                                    <option value="50">50 Results</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td><span class="forum-label">Find</span></td>
                            <td colspan="2">
                                <select class="forum-select" name="find" bind:value={find}>
                                    <option value="posts">Posts</option>
                                    <option value="author">Posted By</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td><span class="forum-label">Match</span></td>
                            <td colspan="2">
                                <select class="forum-select" name="match" bind:value={match}>
                                    <option value="all">All Words</option>
                                    <option value="any">Any Words</option>
                                    <option value="exact">Exact Phrase</option>
                                </select>
                            </td>
                        </tr>
                    {/if}
                    <tr>
                        <td></td>
                        <td><span class="forum-label">Search</span></td>
                        <td colspan="2">
                            <input class="forum-input" type="text" name="q" maxlength="250" bind:value={input}>
                        </td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td>
                            <label class="forum-check"><input type="checkbox" name="simple" bind:checked={simple}>Hide Advanced Options</label>
                        </td>
                        <td><button class="forum-button" type="submit">Search</button></td>
                    </tr>
                </tbody>
            </table>
        </form>
        {#if error}
            <div class="forum-error">{error}</div>
        {/if}
        {#if q && loaded}
            <div class="forum-results">
                <table>
                    <tbody>
                        {@render resultsPager()}
                        {#if shown.length === 0}
                            <tr class="forum-row">
                                <td>No results found.</td>
                            </tr>
                        {/if}
                        {#each shown as row}
                            {@const count = replies(row)}
                            <tr class="forum-row">
                                <td>
                                    <a href={threadUrl(row.id)}><h3 class="forum-result-title">{row.subject}</h3></a>
                                    <span class="forum-small"> ({count} {count === 1 ? "Reply" : "Replies"})</span>
                                    <br>
                                    <a class="forum-result-forum" href={forumUrl(row.forum_id)}>{row.forum_name || "Unknown"}</a>
                                    - Posted by
                                    <a href="/user?id={row.author_id}">{row.author_username || "Unknown"}</a>
                                    on {searchDate(row.created_at)}
                                    {#if row.body}
                                        <br>
                                        <span class="forum-result-body">{row.body}</span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                        {@render resultsPager()}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</main>
