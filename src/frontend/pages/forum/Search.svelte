<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { list, num, pageNum, threadUrl } from "./common";
    import { topLinks, breadcrumb, pager } from "./Bits.svelte";

    const q = $derived((router.query.q ?? "").trim());
    const page = $derived(pageNum(router.query.page));

    let input = $state("");
    let rows = $state<any[]>([]);
    let pages = $state(1);
    let error = $state("");

    $effect(() => {
        input = q;
        rows = [];
        pages = 1;
        error = "";
        if (!q) return;
        api(`/forum/search?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            rows = list(d.results);
            pages = Math.max(1, Number(d.pages) || 1);
        }).catch(err => {
            error = err.message;
        });
    });

    const submit = (e: Event) => {
        e.preventDefault();
        router.go("/forum/search?q=" + encodeURIComponent(input));
    };
</script>

<svelte:head>
    <title>Forum Search - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        <div class="forum-top-row">{@render breadcrumb(null, "Search")}{@render topLinks()}</div>
        <h1 class="forum-form-title">Search Forums</h1>
        <form class="forum-search-page-form" onsubmit={submit}>
            <input type="text" name="q" maxlength="120" bind:value={input}>
            <button type="submit">Search</button>
        </form>
        {#if error}<div class="forum-alert error">{error}</div>{/if}
        {#if q}
            <div class="forum-thread-table">
                <div class="forum-thread-header search"><div>Subject</div><div>Forum</div><div>Author</div><div>Replies</div></div>
                {#if rows.length === 0}<div class="forum-empty">No results found.</div>{/if}
                {#each rows as row}
                    <div class="forum-thread-row search">
                        <div class="forum-thread-subject"><img class="forum-thread-icon" src="/img/Forums/thread-read.png" alt=""><a href={threadUrl(row.id)}>{row.subject}</a></div>
                        <div>{row.forum_name ?? row.forum?.name ?? "Unknown"}</div>
                        <div>{row.author_username || "Unknown"}</div>
                        <div>{num(Math.max(0, Number(row.post_count || 0) - 1))}</div>
                    </div>
                {/each}
            </div>
            {@render pager(page, pages, "/forum/search?q=" + encodeURIComponent(q))}
        {/if}
    </div>
</main>
