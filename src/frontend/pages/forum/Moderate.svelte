<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, forumUrl, threadUrl } from "./common";
    import { top, body as bodyText } from "./Bits.svelte";

    const action = $derived(router.query.action ?? "");
    const id = $derived(Number(router.query.PostID) || 0);
    const admin = $derived((session.me?.admin ?? 0) > 0);

    let post = $state<any>(null);
    let thread = $state<any>(null);
    let forum = $state<any>(null);
    let groups = $state<any[]>([]);
    let notFound = $state(false);
    let error = $state("");
    let busy = $state(false);
    let subject = $state("");
    let body = $state("");
    let forumId = $state(0);

    const isFirst = $derived(!!post?.is_first);

    $effect(() => {
        notFound = id <= 0;
        error = "";
        if (notFound || !admin) {
            return;
        }

        if (action === "move") {
            api(`/forum/threads/${id}?page=1`).then(d => {
                thread = d.thread ?? null;
                forum = d.forum ?? null;
                forumId = Number(thread?.forum_id) || 0;
            }).catch(err => {
                if (err.status === 404) {
                    notFound = true;
                } else {
                    error = err.message;
                }
            });
            api("/forum").then(d => {
                groups = list(d.groups);
            }).catch(() => {});
        } else {
            api(`/forum/posts/${id}`).then(d => {
                post = d.post ?? (d.id ? d : null);
                forum = d.forum ?? null;
                subject = post?.subject ?? "";
                body = post?.body ?? "";
            }).catch(err => {
                if (err.status === 404) {
                    notFound = true;
                } else {
                    error = err.message;
                }
            });
        }
    });

    const backUrl = $derived(post?.thread_id ? `${threadUrl(post.thread_id)}#post-${id}` : "/forum");

    const save = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            await api(`/forum/posts/${id}`, isFirst ? {
                subject,
                body
            } : {
                body
            }, "PATCH");
            router.go(backUrl);
            return;
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const move = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            await api(`/forum/threads/${id}/move`, {
                forum_id: forumId
            });
            router.go(threadUrl(id));
            return;
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const remove = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            await api(`/forum/posts/${id}`, undefined, "DELETE");
            router.go(isFirst && post?.forum_id ? forumUrl(post.forum_id) : post?.thread_id ? threadUrl(post.thread_id) : "/forum");
            return;
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const titles: Record<string, string> = {
        edit: "Edit Forum Post",
        move: "Move Forum Thread",
        delete: "Delete Forum Post"
    };
    const tails: Record<string, string> = {
        edit: "Moderate Post",
        move: "Move Thread",
        delete: "Delete Post"
    };
</script>

<svelte:head>
    <title>{titles[action] ?? "Moderate"} - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(forum, tails[action] ?? "Moderate")}
        {#if !admin}
            <div class="forum-empty">Forbidden</div>
        {:else if notFound}
            <div class="forum-empty">{action === "move" ? "That thread does not exist." : "That post does not exist."}</div>
        {:else if action === "edit"}
            <h1 class="forum-title">Edit Post</h1>
            <div class="forum-note">Editing post #{id} by {post?.author_username || "Unknown"}</div>
            <form class="forum-form forum-mod" onsubmit={save}>
                {#if isFirst}
                    <div class="forum-field">
                        <label for="forum-subject">Subject:</label>
                        <input id="forum-subject" class="forum-text" type="text" name="subject" maxlength="120" bind:value={subject} required>
                    </div>
                {/if}
                <div class="forum-field">
                    <label for="forum-body">Message:</label>
                    <textarea id="forum-body" class="forum-text" name="body" rows="12" maxlength="10000" bind:value={body} required></textarea>
                </div>
                <div class="forum-submit">
                    <div class="forum-submit-buttons">
                        <a class="forum-btn forum-btn-wide" href={backUrl}>Cancel</a>
                        <button class="forum-btn forum-btn-wide" type="submit" disabled={busy}>Save Changes</button>
                    </div>
                </div>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
        {:else if action === "move"}
            <h1 class="forum-title">Move Thread</h1>
            <div class="forum-note">{thread?.subject ?? ""}</div>
            <form class="forum-form forum-mod" onsubmit={move}>
                <div class="forum-field">
                    <label for="forum-target">Move to:</label>
                    <select id="forum-target" class="forum-text" name="forum_id" bind:value={forumId} required>
                        {#each groups as group}
                            <optgroup label={group.section}>
                                {#each list(group.forums) as f}
                                    <option value={f.id}>{f.name}</option>
                                {/each}
                            </optgroup>
                        {/each}
                    </select>
                </div>
                <div class="forum-submit">
                    <div class="forum-submit-buttons">
                        <a class="forum-btn forum-btn-wide" href={threadUrl(id)}>Cancel</a>
                        <button class="forum-btn forum-btn-wide" type="submit" disabled={busy}>Move Thread</button>
                    </div>
                </div>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
        {:else if action === "delete"}
            <h1 class="forum-title">{isFirst ? "Delete Thread" : "Delete Post"}</h1>
            <div class="forum-bar forum-original-bar">
                <span class="forum-bar-title">{isFirst ? "Original Post" : "Post"}</span>
            </div>
            <div class="forum-original">
                <span class="forum-original-title">{post?.author_username || "Unknown"}</span>
                <div class="forum-original-body">{@render bodyText(post?.body ?? "")}</div>
            </div>
            <div class="forum-bar forum-bar-form"></div>
            <div class="forum-note">{isFirst ? "This is the first post. Deleting it will delete the entire thread and all replies." : "Are you sure you want to delete this reply?"}</div>
            <form class="forum-actions" onsubmit={remove}>
                <a class="forum-btn forum-btn-wide" href={backUrl}>Cancel</a>
                <button class="forum-btn forum-btn-wide" type="submit" disabled={busy}>{isFirst ? "Delete Thread" : "Delete Post"}</button>
            </form>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}
        {:else}
            <div class="forum-empty">Unknown action.</div>
        {/if}
    </div>
</main>
