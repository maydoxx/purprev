<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, num, pic, pageNum, fullDate, shortDate, forumUrl, threadUrl, markSeen } from "./common";
    import { top, breadcrumb, pager, body } from "./Bits.svelte";

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
    let loaded = $state(false);
    let notFound = $state(false);
    let error = $state("");
    let busy = $state(false);

    const load = async () => {
        try {
            const d = await api(`/forum/threads/${threadId}?sort=${sort}&page=${page}`);
            markSeen(threadId);
            thread = d.thread ?? null;
            forum = d.forum ?? null;
            posts = list(d.posts);
            pages = Math.max(1, Number(d.pages) || 1);
            previous = d.previous ?? null;
            next = d.next ?? null;
            tracked = !!d.tracked;
            loaded = true;
        } catch (err: any) {
            if (err.status === 404) {
                notFound = true;
            } else {
                error = err.message;
            }
        }
    };

    $effect(() => {
        notFound = threadId <= 0;
        error = "";
        if (!notFound) {
            load();
        }
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
        if (action === "delete" && !confirm("Delete this entire thread?")) {
            return;
        }
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
    <div class="forum-bar">
        {#if previous}
            <a class="forum-bar-prev" href={threadUrl(previous.id)}>Previous Thread</a>
        {:else}
            <span class="forum-bar-prev">Previous Thread</span>
        {/if}
        <span class="forum-bar-sep">::</span>
        {#if next}
            <a class="forum-bar-next" href={threadUrl(next.id)}>Next Thread</a>
        {:else}
            <span class="forum-bar-next">Next Thread</span>
        {/if}
    </div>
{/snippet}

<svelte:head>
    <title>{thread ? thread.subject : "Forum Thread"} - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(forum)}
        {#if notFound}
            <div class="forum-empty">That thread does not exist.</div>
        {:else}
            <h1 class="forum-title">{thread?.subject ?? ""}</h1>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}

            <div class="forum-sort">
                {#if session.me}
                    <label class="forum-track">
                        <input type="checkbox" name="tracked" value="1" checked={tracked} onchange={track}>
                        Track Thread
                    </label>
                {/if}
                <label class="forum-sort-label" for="forum-sort">Sort:</label>
                <select id="forum-sort" name="sort" value={sort} onchange={resort}>
                    <option value="oldest">Oldest to newest</option>
                    <option value="newest">Newest to oldest</option>
                </select>
            </div>

            <div class="forum-posts">
                {@render navBar()}
                {#if loaded && posts.length === 0}
                    <div class="forum-empty">No posts here yet.</div>
                {/if}
                {#each posts as post}
                    <article class="forum-post" id="post-{post.id}">
                        <aside class="forum-post-author">
                            <a class="forum-post-name" href="/user?id={post.author_id}">{post.username || "Unknown"}</a>
                            <img class="forum-avatar" src={pic(post.author_id)} alt="" onerror={fallback}>
                            {#if Number(post.admin) > 0}
                                <div class="forum-moderator">
                                    <img src="/img/forum/moderator.gif" alt="Forum Moderator">
                                </div>
                            {/if}
                            <div class="forum-post-stat">
                                <b>Joined:</b>
                                <span>{shortDate(post.user_created_at)}</span>
                            </div>
                            <div class="forum-post-stat">
                                <b>Total Posts:</b>
                                <span>{num(post.total_posts)}</span>
                            </div>
                        </aside>
                        <div class="forum-post-main">
                            <div class="forum-post-date">
                                {fullDate(post.created_at)}
                                {#if post.updated_at}
                                    <span>(edited)</span>
                                {/if}
                            </div>
                            <div class="forum-post-body">{@render body(post.body)}</div>
                            <div class="forum-post-manage">
                                {#if admin}
                                    <a href="/forum/moderate?action=edit&PostID={post.id}">Manage {post.is_first ? "Thread" : "Post"}</a>
                                {/if}
                            </div>
                        </div>
                    </article>
                {/each}
                {@render navBar()}
            </div>

            {@render pager(page, pages, `${threadUrl(threadId)}&sort=${sort}`)}

            <div class="forum-actions">
                {#if !locked || admin}
                    <a class="forum-btn" href="/forum/reply?PostID={threadId}">Add a Reply</a>
                {:else}
                    <span>This thread is locked.</span>
                {/if}
            </div>

            {#if admin}
                <div class="forum-actions forum-admin">
                    <button class="forum-btn" type="button" disabled={busy} onclick={() => moderate("pin")}>{pinned ? "Unpin" : "Pin"}</button>
                    <button class="forum-btn" type="button" disabled={busy} onclick={() => moderate("lock")}>{locked ? "Unlock" : "Lock"}</button>
                    <a class="forum-btn" href="/forum/moderate?action=move&PostID={threadId}">Move Thread</a>
                    <button class="forum-btn" type="button" disabled={busy} onclick={() => moderate("delete")}>Delete Thread</button>
                </div>
            {/if}

            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
