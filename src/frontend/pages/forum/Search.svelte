<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { list, num, pageNum, threadUrl } from "./common";
    import { top, pager } from "./Bits.svelte";

    const q = $derived((router.query.q ?? "").trim());
    const page = $derived(pageNum(router.query.page));

    let input = $state("");
    let rows = $state<any[]>([]);
    let pages = $state(1);
    let loaded = $state(false);
    let error = $state("");

    $effect(() => {
        input = q;
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

    const submit = (e: Event) => {
        e.preventDefault();
        router.go("/forum/search?q=" + encodeURIComponent(input));
    };
</script>

<svelte:head>
    <title>Forum Search - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(null, "Search")}
        <h1 class="forum-title">Search Forums</h1>
        <div class="forum-tools">
            <form class="forum-search forum-search-wide" onsubmit={submit}>
                <label for="forum-q">Search None Forums:</label>
                <input id="forum-q" type="text" name="q" maxlength="120" bind:value={input}>
                <button class="forum-btn forum-btn-go" type="submit">Go</button>
            </form>
        </div>
        {#if error}
            <div class="forum-error">{error}</div>
        {/if}
        {#if q}
            <div class="forum-threads">
                <div class="forum-head">
                    <div>Subject</div>
                    <div class="forum-col-forum">Forum</div>
                    <div class="forum-col-author">Author</div>
                    <div class="forum-col-replies">Replies</div>
                </div>
                {#if loaded && rows.length === 0}
                    <div class="forum-empty">No results found.</div>
                {/if}
                {#each rows as row}
                    <div class="forum-row">
                        <div class="forum-subject">
                            <img src="/img/forum/thread-read.png" alt="">
                            <a href={threadUrl(row.id)}>{row.subject}</a>
                        </div>
                        <div class="forum-cell forum-col-forum">{row.forum_name ?? row.forum?.name ?? "Unknown"}</div>
                        <div class="forum-cell forum-col-author">{row.author_username || "Unknown"}</div>
                        <div class="forum-cell forum-col-replies">{num(Math.max(0, Number(row.post_count || 0) - 1))}</div>
                    </div>
                {/each}
                <div class="forum-foot"></div>
            </div>
            {@render pager(page, pages, "/forum/search?q=" + encodeURIComponent(q))}
        {/if}
    </div>
</main>
