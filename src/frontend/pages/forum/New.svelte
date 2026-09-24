<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { forumUrl, threadUrl } from "./common";
    import { topLinks, breadcrumb, body as bodyText } from "./Bits.svelte";

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
        if (notFound) return;
        api(`/forum/${forumId}/threads?page=1`).then(d => {
            forum = d.forum ?? null;
        }).catch(err => {
            if (err.status === 404) notFound = true;
        });
    });

    const post = async () => {
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

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        <div class="forum-top-row">{@render breadcrumb(forum)}{@render topLinks()}</div>
        {#if notFound}
            <div class="forum-empty">That forum does not exist.</div>
        {:else}
            <h1 class="forum-form-title">New Post</h1>
            {#if error}<div class="forum-alert error">{error}</div>{/if}
            {#if preview}
                <div class="forum-preview-box"><div class="forum-blue-title">Preview</div><div><h3>{subject}</h3>{@render bodyText(body)}</div></div>
            {/if}
            <form class="forum-new-form" onsubmit={e => { e.preventDefault(); post(); }}>
                <div class="forum-field-line"><label>Subject:</label><input type="text" name="subject" maxlength="120" bind:value={subject}></div>
                <div class="forum-field-line message"><label>Message:</label><textarea name="body" maxlength="10000" rows="15" bind:value={body}></textarea></div>
                <label class="forum-lock-check"><input type="checkbox" name="locked" value="1" bind:checked={locked}> Do not allow replies to this post</label>
                <div class="forum-form-buttons">
                    <a class="forum-form-button" href={forumUrl(forumId)}>Cancel</a>
                    <button class="forum-form-button" type="button" onclick={() => preview = true}>Preview</button>
                    <button class="forum-form-button" type="submit" disabled={busy}>Post</button>
                </div>
            </form>
            {@render breadcrumb(forum)}
        {/if}
    </div>
</main>
