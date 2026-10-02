<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, fullDate, threadUrl } from "./common";
    import { top, breadcrumb, body as bodyText } from "./Bits.svelte";

    const threadId = $derived(Number(router.query.PostID) || 0);
    const admin = $derived((session.me?.admin ?? 0) > 0);

    let thread = $state<any>(null);
    let forum = $state<any>(null);
    let original = $state<any>(null);
    let notFound = $state(false);
    let body = $state("");
    let locked = $state(false);
    let preview = $state(false);
    let error = $state("");
    let busy = $state(false);

    $effect(() => {
        notFound = threadId <= 0;
        error = "";
        if (notFound) {
            return;
        }
        api(`/forum/threads/${threadId}?sort=oldest&page=1`).then(d => {
            thread = d.thread ?? null;
            forum = d.forum ?? null;
            original = list(d.posts)[0] ?? null;
        }).catch(err => {
            if (err.status === 404) {
                notFound = true;
            } else {
                error = err.message;
            }
        });
    });

    const isLocked = $derived(!!thread?.is_locked && !admin);
    const canLock = $derived(admin || (session.me != null && thread?.author_id === session.me.id));

    const post = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            await api(`/forum/threads/${threadId}/reply`, {
                body,
                locked
            });
            router.go(`${threadUrl(threadId)}&sort=newest`);
            return;
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };
</script>

<svelte:head>
    <title>Reply to Post - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(forum)}
        {#if notFound}
            <div class="forum-empty">That thread does not exist.</div>
        {:else}
            <h1 class="forum-title">Reply to Post</h1>
            <div class="forum-bar forum-original-bar">
                <span class="forum-bar-title">Original Post</span>
            </div>
            <div class="forum-original">
                <a class="forum-original-title" href={threadUrl(threadId)}>{thread?.subject ?? ""}</a>
                {#if original}
                    <span class="forum-original-meta">
                        Posted by
                        <a href="/user?id={original.author_id}">{original.username || "Unknown"}</a>
                        on {fullDate(original.created_at)}
                    </span>
                    <div class="forum-original-body">{@render bodyText(original.body)}</div>
                {/if}
            </div>
            {#if preview}
                <div class="forum-bar forum-original-bar">
                    <span class="forum-bar-title">Preview</span>
                </div>
                <div class="forum-original">
                    <div class="forum-original-body">{@render bodyText(body)}</div>
                </div>
            {/if}
            {#if !isLocked}
                <div class="forum-bar forum-bar-form">
                    <span class="forum-bar-title">New Post</span>
                </div>
                <form class="forum-form" onsubmit={post}>
                    <div class="forum-field">
                        <span class="forum-field-name">Subject:</span>
                        <span class="forum-field-text">Re: {thread?.subject ?? ""}</span>
                    </div>
                    <div class="forum-field">
                        <label for="forum-body">Message:</label>
                        <textarea id="forum-body" class="forum-text" name="body" maxlength="10000" cols="80" rows="15" bind:value={body}></textarea>
                    </div>
                    <div class="forum-submit">
                        {#if canLock}
                            <label class="forum-lock">
                                <input type="checkbox" name="locked" value="1" bind:checked={locked}>
                                Do not allow replies to this post
                            </label>
                        {/if}
                        <div class="forum-submit-buttons">
                            <a class="forum-btn forum-btn-wide" href={threadUrl(threadId)}>Cancel</a>
                            <button class="forum-btn forum-btn-wide" type="button" onclick={() => preview = true}>Preview</button>
                            <button class="forum-btn forum-btn-wide" type="submit" disabled={busy}>Post</button>
                        </div>
                    </div>
                </form>
            {/if}
            {#if isLocked}
                <div class="forum-error">This thread is locked.</div>
            {:else if error}
                <div class="forum-error">{error}</div>
            {/if}
            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
