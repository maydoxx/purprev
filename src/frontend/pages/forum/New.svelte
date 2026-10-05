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
        {:else if preview}
            <h2 class="forum-title">Preview Message</h2>
            <form class="forum-preview" onsubmit={post}>
                <div class="forum-preview-subject">{subject}</div>
                <div class="forum-preview-body">{@render bodyText(body)}</div>
                <div class="forum-preview-buttons">
                    <button class="forum-button forum-button-form" type="button" onclick={() => preview = false}>Edit</button>
                    <button class="forum-button forum-button-form" type="submit" disabled={busy}>Post</button>
                </div>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
            <div class="forum-bottom">
                {@render breadcrumb(forum)}
            </div>
        {:else}
            <h2 class="forum-title">New Post</h2>
            <form onsubmit={post}>
                <table class="forum-form">
                    <tbody>
                        <tr>
                            <td class="forum-form-label"><label for="forum-subject">Subject:</label></td>
                            <td><input id="forum-subject" class="forum-input" type="text" name="subject" maxlength="120" bind:value={subject}></td>
                        </tr>
                        <tr>
                            <td class="forum-form-label forum-form-top"><label for="forum-body">Message:</label></td>
                            <td><textarea id="forum-body" class="forum-textarea" name="body" maxlength="10000" cols="80" rows="20" bind:value={body}></textarea></td>
                        </tr>
                        <tr>
                            <td></td>
                            <td class="forum-submit-cell">
                                <div class="forum-submit">
                                    <label class="forum-check"><input type="checkbox" name="locked" value="1" bind:checked={locked}>Do not allow replies to this post.</label>
                                    <div class="forum-submit-buttons">
                                        <a class="forum-button forum-button-form" href={forumUrl(forumId)}>Cancel</a>
                                        <button class="forum-button forum-button-form" type="button" onclick={() => preview = true}>Preview</button>
                                        <button class="forum-button forum-button-form" type="submit" disabled={busy}>Post</button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
            <div class="forum-bottom">
                {@render breadcrumb(forum)}
            </div>
        {/if}
    </div>
</main>
