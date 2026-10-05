<script lang="ts">
    import { api } from "../../api";
    import UserAd from "../../UserAd.svelte";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, num, pic, pageNum, postDate, shortDate, forumUrl, threadUrl, markSeen } from "./common";
    import { top, breadcrumb, pager, body } from "./Bits.svelte";

    const threadId = $derived(Number(router.query.PostID) || 0);
    const sort = $derived(router.query.sort === "newest" ? "newest" : "oldest");
    const page = $derived(pageNum(router.query.page));
    const admin = $derived((session.me?.admin ?? 0) > 0);

    const clubs = ["BC", "TBC", "OBC"];

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
    const canReply = $derived(!locked || admin);
</script>

{#snippet navBar()}
    <div class="forum-bar">
        {#if previous}<a href={threadUrl(previous.id)}>Previous Thread</a>{:else}<span>Previous Thread</span>{/if}&nbsp;<b>::</b>&nbsp;{#if next}<a href={threadUrl(next.id)}>Next Thread</a>{:else}<span>Next Thread</span>{/if}&nbsp;
    </div>
{/snippet}

<svelte:head>
    <title>{thread ? thread.subject : "Forum Thread"} - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <UserAd size="banner" class="user-ad-top" />
    <UserAd size="skyscraper" class="user-ad-side" />
    <div class="forum-container">
        {@render top(forum)}
        {#if notFound}
            <div class="forum-empty">That thread does not exist.</div>
        {:else}
            <h2 class="forum-title">{thread?.subject ?? ""}</h2>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}

            <div class="forum-sort">
                <div class="forum-sort-left">
                    {#if session.me}
                        <label class="forum-check"><input type="checkbox" name="tracked" value="1" checked={tracked} onchange={track}>Track Thread</label>
                    {/if}
                </div>
                <div class="forum-sort-right">
                    <b>Sort:</b>
                    <select class="forum-select" name="sort" value={sort} onchange={resort}>
                        <option value="oldest">Oldest to newest</option>
                        <option value="newest">Newest to oldest</option>
                    </select>
                </div>
            </div>

            <div class="forum-posts">
                {@render navBar()}
                {#if loaded && posts.length === 0}
                    <div class="forum-empty">No posts here yet.</div>
                {/if}
                {#each posts as post}
                    {@const profile = `/user?id=${post.author_id}`}
                    <div class="forum-post" id="post-{post.id}">
                        <div class="forum-author">
                            <div class="forum-author-name">
                                <img src="/img/forum/user-{post.online ? "online" : "offline"}.gif" alt={post.online ? "Online" : "Offline"}>&nbsp;<a href={profile}>{post.username || "Unknown"}</a>
                            </div>
                            <a class="forum-avatar" href={profile}>
                                <img src={pic(post.author_id)} alt="" onerror={fallback}>
                                {#if clubs.includes(post.membership)}
                                    <img class="forum-club" src="/img/forum/club-{post.membership.toLowerCase()}.png" alt={post.membership}>
                                {/if}
                            </a>
                            {#if Number(post.admin) > 0}
                                <div class="forum-badge">
                                    <img src="/img/forum/moderator.gif" alt="Forum Moderator">
                                </div>
                            {/if}
                            <div class="forum-author-stats">
                                <div><b>Joined:</b> {shortDate(post.user_created_at)}</div>
                                <div><b>Total Posts:</b> {num(post.total_posts)}</div>
                            </div>
                        </div>
                        <div class="forum-post-main">
                            <div class="forum-post-date">
                                {postDate(post.created_at, !!session.me)}
                                {#if post.updated_at}
                                    <span>(edited)</span>
                                {/if}
                            </div>
                            <div class="forum-post-body">{@render body(post.body)}</div>
                            <div class="forum-post-options">
                                <span class="forum-post-actions">
                                    {#if admin}
                                        <a class="forum-button forum-button-gap" href="/forum/moderate?action=edit&PostID={post.id}">Manage {post.is_first ? "Thread" : "Post"}</a>
                                    {/if}
                                    {#if canReply}
                                        <a class="forum-button forum-button-gap" href="/forum/reply?PostID={threadId}">Reply</a>
                                    {/if}
                                    <a class="forum-abuse" href="/abusereport?type=user&id={post.author_id}">Report Abuse</a>
                                </span>
                            </div>
                        </div>
                    </div>
                {/each}
                {@render navBar()}
            </div>

            {@render pager(page, pages, `${threadUrl(threadId)}&sort=${sort}`)}

            <div class="forum-reply-row">
                {#if canReply}
                    <a class="forum-button forum-button-gap" href="/forum/reply?PostID={threadId}">Add a Reply</a>
                {:else}
                    <span class="forum-locked">This thread is locked.</span>
                {/if}
                {#if admin}
                    <div class="forum-admin">
                        <button class="forum-button" type="button" disabled={busy} onclick={() => moderate("pin")}>{pinned ? "Unpin" : "Pin"}</button>
                        <button class="forum-button" type="button" disabled={busy} onclick={() => moderate("lock")}>{locked ? "Unlock" : "Lock"}</button>
                        <button class="forum-button" type="button" disabled={busy} onclick={() => router.go(`/forum/moderate?action=move&PostID=${threadId}`)}>Move Thread</button>
                        <button class="forum-button" type="button" disabled={busy} onclick={() => moderate("delete")}>Delete Thread</button>
                    </div>
                {/if}
            </div>

            <div class="forum-bottom">
                {@render breadcrumb(forum)}
            </div>
        {/if}
    </div>
</main>
