<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, fullDate, threadUrl } from "./common";
    import { topLinks, breadcrumb, body as bodyText } from "./Bits.svelte";

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
        if (notFound) return;
        api(`/forum/threads/${threadId}?sort=oldest&page=1`).then(d => {
            thread = d.thread ?? null;
            forum = d.forum ?? null;
            original = list(d.posts)[0] ?? null;
        }).catch(err => {
            if (err.status === 404) notFound = true;
            else error = err.message;
        });
    });

    const isLocked = $derived(!!thread?.is_locked && !admin);
    const canLock = $derived(admin || (session.me != null && thread?.author_id === session.me.id));

    const post = async () => {
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

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        <div class="forum-top-row">{@render breadcrumb(forum)}{@render topLinks()}</div>
        {#if notFound}
            <div class="forum-empty">That thread does not exist.</div>
        {:else}
            <h1 class="forum-form-title">Reply to Post</h1>
            {#if isLocked}
                <div class="forum-alert error">This thread is locked.</div>
            {:else if error}
                <div class="forum-alert error">{error}</div>
            {/if}
            <div class="forum-original-post">
                <div class="forum-blue-title">Original Post</div>
                <div class="forum-original-inner">
                    <a href={threadUrl(threadId)}>{thread?.subject ?? ""}</a>
                    {#if original}
                        <div class="forum-original-meta">Posted by <a href="/user?id={original.author_id}">{original.username || "Unknown"}</a> on {fullDate(original.created_at)}</div>
                        <div class="forum-original-body">{@render bodyText(original.body)}</div>
                    {/if}
                </div>
            </div>
            {#if preview}<div class="forum-preview-box"><div class="forum-blue-title">Preview</div><div>{@render bodyText(body)}</div></div>{/if}
            {#if !isLocked}
                <form class="forum-reply-form" onsubmit={e => { e.preventDefault(); post(); }}>
                    <div class="forum-blue-title">New Post</div>
                    <div class="forum-field-line"><label>Subject:</label><input type="text" value="Re: {thread?.subject ?? ""}" disabled></div>
                    <div class="forum-field-line message"><label>Message:</label><textarea name="body" maxlength="10000" rows="15" bind:value={body}></textarea></div>
                    {#if canLock}<label class="forum-lock-check"><input type="checkbox" name="locked" value="1" bind:checked={locked}> Do not allow replies to this post</label>{/if}
                    <div class="forum-form-buttons">
                        <a class="forum-form-button" href={threadUrl(threadId)}>Cancel</a>
                        <button class="forum-form-button" type="button" onclick={() => preview = true}>Preview</button>
                        <button class="forum-form-button" type="submit" disabled={busy}>Post</button>
                    </div>
                </form>
            {/if}
            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
