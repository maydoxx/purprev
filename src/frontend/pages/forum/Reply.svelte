<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, postDate, threadUrl } from "./common";
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
    const subject = $derived(`Re: ${thread?.subject ?? ""}`);

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
        {:else if preview}
            <h2 class="forum-title">Preview Message</h2>
            <form class="forum-preview" onsubmit={post}>
                <div class="forum-preview-subject">{subject}</div>
                <div class="forum-preview-body">{@render bodyText(body)}</div>
                <div class="forum-preview-buttons">
                    <button class="forum-button forum-button-form" type="button" onclick={() => preview = false}>Edit</button>
                    <button class="forum-button forum-button-form" type="submit" disabled={busy || isLocked}>Post</button>
                </div>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
            <div class="forum-bottom">
                {@render breadcrumb(forum)}
            </div>
        {:else}
            <h2 class="forum-title">Reply to Post</h2>
            <div class="forum-bar forum-bar-title">Original Post</div>
            <div class="forum-original">
                <a href={threadUrl(threadId)}><b>{thread?.subject ?? ""}</b></a>
                {#if original}
                    <span class="forum-original-meta">Posted by <a href="/user?id={original.author_id}">{original.username || "Unknown"}</a> on {postDate(original.created_at, !!session.me)}</span>
                    <div class="forum-original-body">{@render bodyText(original.body)}</div>
                {/if}
            </div>
            {#if !isLocked}
                <div class="forum-bar forum-bar-title">New Post</div>
                <form onsubmit={post}>
                    <table class="forum-form">
                        <tbody>
                            <tr>
                                <td class="forum-form-label">Subject:</td>
                                <td>{subject}</td>
                            </tr>
                            <tr>
                                <td class="forum-form-label forum-form-top"><label for="forum-body">Message:</label></td>
                                <td><textarea id="forum-body" class="forum-textarea" name="body" maxlength="10000" cols="80" rows="20" bind:value={body}></textarea></td>
                            </tr>
                            <tr>
                                <td></td>
                                <td class="forum-submit-cell">
                                    <div class="forum-submit">
                                        {#if canLock}
                                            <label class="forum-check"><input type="checkbox" name="locked" value="1" bind:checked={locked}>Do not allow replies to this post.</label>
                                        {/if}
                                        <div class="forum-submit-buttons">
                                            <a class="forum-button forum-button-form" href={threadUrl(threadId)}>Cancel</a>
                                            <button class="forum-button forum-button-form" type="button" onclick={() => preview = true}>Preview</button>
                                            <button class="forum-button forum-button-form" type="submit" disabled={busy}>Post</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </form>
            {/if}
            {#if isLocked}
                <div class="forum-error">This thread is locked.</div>
            {:else if error}
                <div class="forum-error">{error}</div>
            {/if}
            <div class="forum-bottom">
                {@render breadcrumb(forum)}
            </div>
        {/if}
    </div>
</main>
