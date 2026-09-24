<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, forumUrl, threadUrl } from "./common";
    import { topLinks, breadcrumb, body as bodyText } from "./Bits.svelte";

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
        if (notFound || !admin) return;

        if (action === "move") {
            api(`/forum/threads/${id}?page=1`).then(d => {
                thread = d.thread ?? null;
                forum = d.forum ?? null;
                forumId = Number(thread?.forum_id) || 0;
            }).catch(err => {
                if (err.status === 404) notFound = true;
                else error = err.message;
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
                if (err.status === 404) notFound = true;
                else error = err.message;
            });
        }
    });

    const backUrl = $derived(post?.thread_id ? `${threadUrl(post.thread_id)}#post-${id}` : "/forum");

    const save = async () => {
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

    const move = async () => {
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

    const remove = async () => {
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

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        {@render breadcrumb(forum, tails[action] ?? "Moderate")}
        <div class="forum-head-row compact">{@render topLinks()}</div>
        {#if !admin}
            <div class="forum-empty">Forbidden</div>
        {:else if notFound}
            <div class="forum-empty">{action === "move" ? "That thread does not exist." : "That post does not exist."}</div>
        {:else if action === "edit"}
            <div class="forum-moderation-box">
                <h1>Edit Post</h1>
                <p class="forum-mod-note">Editing post #{id} by {post?.author_username || "Unknown"}</p>
                {#if error}<div class="forum-alert error">{error}</div>{/if}
                <form class="forum-mod-form" onsubmit={e => { e.preventDefault(); save(); }}>
                    {#if isFirst}
                        <label>Subject<input type="text" name="subject" maxlength="120" bind:value={subject} required></label>
                    {/if}
                    <label>Message<textarea name="body" rows="12" maxlength="10000" bind:value={body} required></textarea></label>
                    <div class="forum-mod-actions"><button type="submit" disabled={busy}>Save Changes</button><a href={backUrl}>Cancel</a></div>
                </form>
            </div>
        {:else if action === "move"}
            <div class="forum-moderation-box">
                <h1>Move Thread</h1>
                <p class="forum-mod-note">{thread?.subject ?? ""}</p>
                {#if error}<div class="forum-alert error">{error}</div>{/if}
                <form class="forum-mod-form" onsubmit={e => { e.preventDefault(); move(); }}>
                    <label>Move to
                        <select name="forum_id" bind:value={forumId} required>
                            {#each groups as group}
                                <optgroup label={group.section}>
                                    {#each list(group.forums) as f}<option value={f.id}>{f.name}</option>{/each}
                                </optgroup>
                            {/each}
                        </select>
                    </label>
                    <div class="forum-mod-actions"><button type="submit" disabled={busy}>Move Thread</button><a href={threadUrl(id)}>Cancel</a></div>
                </form>
            </div>
        {:else if action === "delete"}
            <div class="forum-moderation-box">
                <h1>{isFirst ? "Delete Thread" : "Delete Post"}</h1>
                {#if error}<div class="forum-alert error">{error}</div>{/if}
                <div class="forum-delete-preview"><strong>{post?.author_username || "Unknown"}:</strong><div>{@render bodyText(post?.body ?? "")}</div></div>
                <p>{isFirst ? "This is the first post. Deleting it will delete the entire thread and all replies." : "Are you sure you want to delete this reply?"}</p>
                <form class="forum-mod-actions" onsubmit={e => { e.preventDefault(); remove(); }}>
                    <button class="danger" type="submit" disabled={busy}>{isFirst ? "Delete Thread" : "Delete Post"}</button>
                    <a href={backUrl}>Cancel</a>
                </form>
            </div>
        {:else}
            <div class="forum-empty">Unknown action.</div>
        {/if}
    </div>
</main>
