<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { forumUrl, threadUrl } from "./common";
    import { top, breadcrumb, body as bodyText } from "./Bits.svelte";

    const forumId = $derived(Number(router.query.ForumID) || 0);

    let forum = $state<any>(null);
    let notFound = $state(false);
    let subject = $state("");
    let body = $state("");
    let locked = $state(false);
    let preview = $state(false);
    let error = $state("");
    let busy = $state(false);

    $effect(() => {
        notFound = forumId <= 0;
        if (notFound) {
            return;
        }
        api(`/forum/${forumId}/threads?page=1`).then(d => {
            forum = d.forum ?? null;
        }).catch(err => {
            if (err.status === 404) {
                notFound = true;
            }
        });
    });

    const post = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            const d = await api(`/forum/${forumId}/threads`, {
                subject,
                body,
                locked
            });
            router.go(d.id ? threadUrl(d.id) : forumUrl(forumId));
            return;
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };
</script>

<svelte:head>
    <title>New Post - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(forum)}
        {#if notFound}
            <div class="forum-empty">That forum does not exist.</div>
        {:else}
            <h1 class="forum-title">New Post</h1>
            {#if preview}
                <div class="forum-bar forum-original-bar">
                    <span class="forum-bar-title">Preview</span>
                </div>
                <div class="forum-original">
                    <span class="forum-original-title">{subject}</span>
                    <div class="forum-original-body">{@render bodyText(body)}</div>
                </div>
                <div class="forum-bar forum-bar-form">
                    <span class="forum-bar-title">New Post</span>
                </div>
            {/if}
            <form class="forum-form" onsubmit={post}>
                <div class="forum-field">
                    <label for="forum-subject">Subject:</label>
                    <input id="forum-subject" class="forum-text" type="text" name="subject" maxlength="120" bind:value={subject}>
                </div>
                <div class="forum-field">
                    <label for="forum-body">Message:</label>
                    <textarea id="forum-body" class="forum-text" name="body" maxlength="10000" cols="80" rows="15" bind:value={body}></textarea>
                </div>
                <div class="forum-submit">
                    <label class="forum-lock">
                        <input type="checkbox" name="locked" value="1" bind:checked={locked}>
                        Do not allow replies to this post
                    </label>
                    <div class="forum-submit-buttons">
                        <a class="forum-btn forum-btn-wide" href={forumUrl(forumId)}>Cancel</a>
                        <button class="forum-btn forum-btn-wide" type="button" onclick={() => preview = true}>Preview</button>
                        <button class="forum-btn forum-btn-wide" type="submit" disabled={busy}>Post</button>
                    </div>
                </div>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
