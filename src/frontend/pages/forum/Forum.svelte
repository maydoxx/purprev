<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { list, num, pageNum, activityTime, forumUrl, threadUrl, seenThreads } from "./common";
    import { top, breadcrumb, pager } from "./Bits.svelte";

    const POSTS_PER_PAGE = 15;

    const forumId = $derived(Number(router.query.ForumID) || 0);
    const q = $derived(router.query.q ?? "");
    const page = $derived(pageNum(router.query.page));

    let forum = $state<any>(null);
    let threads = $state<any[]>([]);
    const seen = seenThreads();
    let pages = $state(1);
    let loaded = $state(false);
    let notFound = $state(false);
    let error = $state("");
    let search = $state("");

    $effect(() => {
        search = q;
        notFound = forumId <= 0;
        error = "";
        if (notFound) {
            return;
        }
        api(`/forum/${forumId}/threads?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            forum = d.forum ?? null;
            threads = list(d.threads);
            pages = Math.max(1, Number(d.pages) || 1);
            loaded = true;
        }).catch(err => {
            if (err.status === 404) {
                notFound = true;
            } else {
                error = err.message;
            }
        });
    });

    const submit = (e: Event) => {
        e.preventDefault();
        router.go(forumUrl(forumId) + (search ? "&q=" + encodeURIComponent(search) : ""));
    };

    const base = $derived(forumUrl(forumId) + (q ? "&q=" + encodeURIComponent(q) : ""));
    const threadPages = (t: any) => Math.max(1, Math.ceil(Number(t.post_count || 0) / POSTS_PER_PAGE));
</script>

<svelte:head>
    <title>{forum ? forum.name : notFound ? "Forum Not Found" : "Forum"} - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(forum)}
        {#if notFound}
            <div class="forum-empty">That forum does not exist.</div>
        {:else}
            <div class="forum-tools">
                <a class="forum-btn" href="/forum/new?ForumID={forumId}">New Thread</a>
                <form class="forum-search" onsubmit={submit}>
                    <label for="forum-q">Search this forum:</label>
                    <input id="forum-q" type="text" name="q" maxlength="120" bind:value={search}>
                    <button class="forum-btn forum-btn-go" type="submit">Go</button>
                </form>
            </div>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}

            <div class="forum-threads">
                <div class="forum-head">
                    <div>Subject</div>
                    <div class="forum-col-author">Author</div>
                    <div class="forum-col-replies">Replies</div>
                    <div class="forum-col-views">Views</div>
                    <div class="forum-col-last">Last Post</div>
                </div>
                {#if loaded && threads.length === 0}
                    <div class="forum-empty">No threads found.</div>
                {/if}
                {#each threads as thread}
                    {@const tp = threadPages(thread)}
                    {@const shown = Math.min(3, tp)}
                    {@const read = seen.has(Number(thread.id))}
                    <div class="forum-row">
                        <div class="forum-subject">
                            <img src="/img/forum/thread-{read ? "read" : "unread"}.png" alt={read ? "Read" : "Unread"}>
                            <a href={threadUrl(thread.id)}>{thread.subject}</a>
                            {#if tp > 1}
                                <span class="forum-mini">
                                    {#each { length: shown } as _, i}
                                        <a href="{threadUrl(thread.id)}&page={i + 1}">{i + 1}</a>{i + 1 < shown ? "," : ""}
                                    {/each}
                                    {#if tp > 4}
                                        …
                                    {/if}
                                    {#if tp > 3}
                                        <a href="{threadUrl(thread.id)}&page={tp}">{tp}</a>
                                    {/if}
                                </span>
                            {/if}
                            {#if thread.is_pinned}
                                <span class="forum-pinned">Pinned Post</span>
                            {/if}
                        </div>
                        <div class="forum-cell forum-col-author">{thread.author_username || "Unknown"}</div>
                        <div class="forum-cell forum-col-replies">{num(Math.max(0, Number(thread.post_count || 0) - 1))}</div>
                        <div class="forum-cell forum-col-views">{num(thread.views)}</div>
                        <div class="forum-cell forum-col-last forum-last">
                            <strong>{activityTime(thread.last_post_at ?? thread.updated_at)}</strong>
                            <span>{thread.last_post_username || thread.author_username || "Unknown"}</span>
                        </div>
                    </div>
                {/each}
                <div class="forum-foot"></div>
            </div>
            {@render pager(page, pages, base)}
            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
