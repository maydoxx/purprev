<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { list, num, pageNum, activityTime, forumUrl, threadUrl } from "./common";
    import { topLinks, breadcrumb, pager } from "./Bits.svelte";

    const POSTS_PER_PAGE = 15;

    const forumId = $derived(Number(router.query.ForumID) || 0);
    const q = $derived(router.query.q ?? "");
    const page = $derived(pageNum(router.query.page));

    let forum = $state<any>(null);
    let threads = $state<any[]>([]);
    let pages = $state(1);
    let notFound = $state(false);
    let error = $state("");
    let search = $state("");

    $effect(() => {
        search = q;
        notFound = forumId <= 0;
        error = "";
        if (notFound) return;
        api(`/forum/${forumId}/threads?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            forum = d.forum ?? null;
            threads = list(d.threads);
            pages = Math.max(1, Number(d.pages) || 1);
        }).catch(err => {
            if (err.status === 404) notFound = true;
            else error = err.message;
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

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        <div class="forum-top-row">
            {@render breadcrumb(forum)}
            {@render topLinks()}
        </div>
        {#if notFound}
            <div class="forum-empty">That forum does not exist.</div>
        {:else}
            {#if error}<div class="forum-alert error">{error}</div>{/if}
            <div class="forum-list-tools">
                <a class="forum-control-button" href="/forum/new?ForumID={forumId}">New Thread</a>
                <form onsubmit={submit}>
                    <label>Search this forum:</label>
                    <input type="text" name="q" maxlength="120" bind:value={search}>
                    <button type="submit">Go</button>
                </form>
            </div>

            <div class="forum-thread-table">
                <div class="forum-thread-header">
                    <div>Subject</div>
                    <div>Author</div>
                    <div>Replies</div>
                    <div>Views</div>
                    <div>Last Post</div>
                </div>
                {#if threads.length === 0}
                    <div class="forum-empty">No threads found.</div>
                {/if}
                {#each threads as thread}
                    {@const tp = threadPages(thread)}
                    {@const shown = Math.min(3, tp)}
                    <div class="forum-thread-row">
                        <div class="forum-thread-subject">
                            <img class="forum-thread-icon" src={thread.read ? "/img/Forums/thread-read.png" : "/img/Forums/thread-unread.png"} alt={thread.read ? "Read" : "Unread"}>
                            <a href={threadUrl(thread.id)}>{thread.subject}</a>
                            {#if tp > 1}
                                <span class="forum-mini-pages">
                                    {#each { length: shown } as _, i}<a href="{threadUrl(thread.id)}&page={i + 1}">{i + 1}</a>{i + 1 < shown ? "," : ""} {/each}
                                    {#if tp > 4}... {/if}
                                    {#if tp > 3}<a href="{threadUrl(thread.id)}&page={tp}">{tp}</a>{/if}
                                </span>
                            {/if}
                            {#if thread.is_pinned}<span class="forum-pinned-label">Pinned Post</span>{/if}
                        </div>
                        <div>{thread.author_username || "Unknown"}</div>
                        <div>{num(Math.max(0, Number(thread.post_count || 0) - 1))}</div>
                        <div>{num(thread.views)}</div>
                        <div class="forum-last-post"><strong>{activityTime(thread.last_post_at ?? thread.updated_at)}</strong><span>{thread.last_post_username || thread.author_username || "Unknown"}</span></div>
                    </div>
                {/each}
            </div>
            {@render pager(page, pages, base)}
            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
