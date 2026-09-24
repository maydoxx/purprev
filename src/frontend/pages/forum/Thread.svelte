<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, num, pic, pageNum, fullDate, shortDate, forumUrl, threadUrl } from "./common";
    import { topLinks, breadcrumb, pager, body } from "./Bits.svelte";

    const threadId = $derived(Number(router.query.PostID) || 0);
    const sort = $derived(router.query.sort === "newest" ? "newest" : "oldest");
    const page = $derived(pageNum(router.query.page));
    const admin = $derived((session.me?.admin ?? 0) > 0);

    let thread = $state<any>(null);
    let forum = $state<any>(null);
    let posts = $state<any[]>([]);
    let pages = $state(1);
    let previous = $state<any>(null);
    let next = $state<any>(null);
    let tracked = $state(false);
    let notFound = $state(false);
    let error = $state("");
    let busy = $state(false);

    const load = async () => {
        try {
            const d = await api(`/forum/threads/${threadId}?sort=${sort}&page=${page}`);
            thread = d.thread ?? null;
            forum = d.forum ?? null;
            posts = list(d.posts);
            pages = Math.max(1, Number(d.pages) || 1);
            previous = d.previous ?? null;
            next = d.next ?? null;
            tracked = !!d.tracked;
        } catch (err: any) {
            if (err.status === 404) notFound = true;
            else error = err.message;
        }
    };

    $effect(() => {
        notFound = threadId <= 0;
        error = "";
        if (!notFound) load();
    });

    const track = async (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        try {
            await api(`/forum/threads/${threadId}/track`, {
                tracked: checked
            });
            await load();
        } catch (err: any) {
            error = err.message;
        }
    };

    const moderate = async (action: "pin" | "lock" | "delete") => {
        if (action === "delete" && !confirm("Delete this entire thread?")) return;
        busy = true;
        error = "";
        try {
            await api(`/forum/threads/${threadId}/moderate`, {
                action
            });
            if (action === "delete") {
                router.go(thread?.forum_id ? forumUrl(thread.forum_id) : "/forum");
                return;
            }
            await load();
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const resort = (e: Event) => {
        router.go(`${threadUrl(threadId)}&sort=${(e.target as HTMLSelectElement).value}`);
    };

    const fallback = (e: Event) => {
        const img = e.target as HTMLImageElement;
        img.onerror = null;
        img.src = "/img/pending.png";
    };

    const locked = $derived(!!thread?.is_locked);
    const pinned = $derived(!!thread?.is_pinned);
</script>

{#snippet navBar()}
    <div class="forum-nav-bar">
        <span>
            {#if previous}<a href={threadUrl(previous.id)}>Previous Thread</a>{:else}Previous Thread{/if}
            &nbsp;::&nbsp;
            {#if next}<a href={threadUrl(next.id)}>Next Thread</a>{:else}Next Thread{/if}
        </span>
    </div>
{/snippet}

<svelte:head>
    <title>{thread ? thread.subject : "Forum Thread"} - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        <div class="forum-top-row">
            {@render breadcrumb(forum)}
            {@render topLinks()}
        </div>
        {#if notFound}
            <div class="forum-empty">That thread does not exist.</div>
        {:else}
            <h1 class="forum-thread-title">{thread?.subject ?? ""}</h1>
            {#if error}<div class="forum-alert error">{error}</div>{/if}

            <div class="forum-thread-controls">
                {#if session.me}
                    <form class="forum-track-form" onsubmit={e => e.preventDefault()}>
                        <label><input type="checkbox" name="tracked" value="1" checked={tracked} onchange={track}> Track Thread</label>
                    </form>
                {/if}
                <form onsubmit={e => e.preventDefault()}>
                    <label><strong>Sort:</strong>
                        <select name="sort" value={sort} onchange={resort}>
                            <option value="oldest">Oldest to newest</option>
                            <option value="newest">Newest to oldest</option>
                        </select>
                    </label>
                </form>
            </div>

            {@render navBar()}

            <div class="forum-post-list">
                {#if posts.length === 0}
                    <div class="forum-empty">No posts here yet.</div>
                {/if}
                {#each posts as post}
                    <article class="forum-post" id="post-{post.id}">
                        <aside class="forum-post-author">
                            <a class="forum-author-name" href="/user?id={post.author_id}">{post.username || "Unknown"}</a>
                            <img class="forum-avatar" src={pic(post.author_id)} alt="" onerror={fallback}>
                            {#if Number(post.admin) > 0}<img class="forum-moderator-badge" src="/img/Forums/users_moderator.gif" alt="Forum Moderator">{/if}
                            <div><strong>Joined:</strong> {shortDate(post.user_created_at)}</div>
                            <div><strong>Total Posts:</strong> {num(post.total_posts)}</div>
                        </aside>
                        <div class="forum-post-content">
                            <div class="forum-post-meta-row">
                                <div class="forum-post-date">{fullDate(post.created_at)}{#if post.updated_at} <span class="forum-edited">(edited)</span>{/if}</div>
                                {#if admin}
                                    <div class="forum-post-mod-links">
                                        <a href="/forum/moderate?action=edit&PostID={post.id}">Manage {post.is_first ? "Thread" : "Post"}</a>
                                    </div>
                                {/if}
                            </div>
                            <div class="forum-post-body">{@render body(post.body)}</div>
                        </div>
                    </article>
                {/each}
            </div>

            {@render navBar()}

            {@render pager(page, pages, `${threadUrl(threadId)}&sort=${sort}`)}

            <div class="forum-thread-bottom-actions">
                {#if !locked || admin}
                    <a class="forum-control-button" href="/forum/reply?PostID={threadId}">Add a Reply</a>
                {:else}
                    <span class="forum-locked-note">This thread is locked.</span>
                {/if}
            </div>

            {#if admin}
                <form class="forum-admin-actions" onsubmit={e => e.preventDefault()}>
                    <button type="button" disabled={busy} onclick={() => moderate("pin")}>{pinned ? "Unpin" : "Pin"}</button>
                    <button type="button" disabled={busy} onclick={() => moderate("lock")}>{locked ? "Unlock" : "Lock"}</button>
                    <a class="forum-admin-link-button" href="/forum/moderate?action=move&PostID={threadId}">Move Thread</a>
                    <button type="button" disabled={busy} onclick={() => moderate("delete")}>Delete Thread</button>
                </form>
            {/if}

            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
