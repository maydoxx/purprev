<script lang="ts">
    import { api } from "./api";
    import { router } from "./router.svelte";
    import { session } from "./session.svelte";

    type Props = {
        kind: "game" | "item";
        target: number;
    };

    let { kind, target }: Props = $props();

    const MAX_CHARS = 200;
    const MAX_NEWLINES = 10;
    const LINK = /(([a-zA-Z0-9-]+\.[a-zA-Z]{2,4}[:#/?]+)|([a-zA-Z0-9]\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,4}))/;

    let comments = $state<any[]>([]);
    let hasMore = $state(false);
    let loading = $state(false);
    let loaded = $state(false);
    let failed = $state(false);
    let text = $state("");
    let counter = $state("");
    let error = $state("");
    let posting = $state(false);

    const headshot = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const avatar = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;

    const load = async (start: number) => {
        const current = target;
        loading = true;
        failed = false;
        try {
            const d = await api(`/comments?kind=${kind}&id=${current}&start=${start}`);
            if (current !== target) {
                return;
            }
            const seen = new Set(comments.map(c => c.id));
            comments = start === 0 ? d.comments : [...comments, ...d.comments.filter((c: any) => !seen.has(c.id))];
            hasMore = d.hasMore;
            loaded = true;
        } catch {
            failed = true;
        }
        loading = false;
    };

    $effect(() => {
        comments = [];
        hasMore = false;
        loaded = false;
        text = "";
        counter = "";
        error = "";
        if (target > 0) {
            load(0);
        }
    });

    const onInput = () => {
        error = "";
        const lines = text.split("\n");
        if (lines.length - 1 > MAX_NEWLINES) {
            text = lines.slice(0, MAX_NEWLINES + 1).join("\n");
            error = "Too many newlines!";
        }
        if (text.length > MAX_CHARS) {
            text = text.slice(0, MAX_CHARS);
            error = "Too many characters!";
        }
        counter = `${MAX_CHARS - text.length} characters remaining`;
    };

    const post = async (e: Event) => {
        e.preventDefault();
        const body = text.trim();
        if (body === "" || posting) {
            return;
        }
        if (!session.me) {
            router.go("/login");
            return;
        }
        if (LINK.test(body.replace(/\n/g, ""))) {
            error = "Comments should be about the item or place on which you are commenting. Links are not permitted.";
            return;
        }
        posting = true;
        error = "";
        try {
            const c = await api("/comments", {
                kind,
                id: target,
                body
            });
            comments = [c, ...comments];
            text = "";
            counter = "";
        } catch (err: any) {
            error = err.message;
        }
        posting = false;
    };

    const remove = async (c: any) => {
        try {
            await api(`/comments/${c.id}`, undefined, "DELETE");
            comments = comments.filter(x => x.id !== c.id);
        } catch (err: any) {
            error = err.message;
        }
    };

    const ago = (at: number) => {
        const secs = Math.max(0, Math.floor(Date.now() / 1000) - at);
        const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? "" : "s"}`;
        if (secs < 60) {
            return unit(secs, "second");
        }
        if (secs < 3600) {
            return unit(Math.floor(secs / 60), "minute");
        }
        if (secs < 86400) {
            return unit(Math.floor(secs / 3600), "hour");
        }
        if (secs < 30 * 86400) {
            return unit(Math.floor(secs / 86400), "day");
        }
        if (secs < 365 * 86400) {
            return unit(Math.floor(secs / (30 * 86400)), "month");
        }
        return unit(Math.floor(secs / (365 * 86400)), "year");
    };
</script>

{#if kind === "game"}
    <div class="comments-container">
        <h3>Comments</h3>
        <div class="section-content AddAComment">
            <div class="comment-form">
                <form class="form-horizontal" onsubmit={post}>
                    <div class="form-group">
                        <textarea class="form-control input-field rbx-comment-input" placeholder="Write a comment!" rows="1" bind:value={text} oninput={onInput}></textarea>
                        <div class="rbx-comment-msgs">
                            <span class="rbx-comment-error text-error">{error}</span>
                            <span class="rbx-comment-count small">{counter}</span>
                        </div>
                    </div>
                    <button type="submit" class="btn-secondary-md rbx-post-comment" disabled={posting}>Post Comment</button>
                </form>
            </div>
            <div class="comments vlist">
                {#each comments as c (c.id)}
                    <div class="comment-item list-item">
                        <div class="comment-user list-header">
                            <a class="avatar avatar-headshot-md" href="/user?id={c.user_id}" title={c.username}>
                                <img src={headshot(c.user_id)} alt={c.username}>
                            </a>
                        </div>
                        <div class="comment-body list-body">
                            <a class="text-name" href="/user?id={c.user_id}">{c.username}</a>
                            <p class="comment-content list-content">{c.body}</p>
                            <span class="xsmall text-date-hint">{ago(c.created_at)} ago</span>
                        </div>
                        <div class="comment-controls">
                            {#if c.deletable}
                                <button type="button" class="rbx-comment-remove" title="Remove Comment" onclick={() => remove(c)}>
                                    <span class="icon-remove"></span>
                                </button>
                            {:else}
                                <a class="rbx-comment-report-link" href="/abusereport?type=comment&id={c.id}" title="Report Abuse">
                                    <span class="icon-flag"></span>
                                </a>
                            {/if}
                        </div>
                    </div>
                {/each}
                {#if loading}
                    <div class="loading"></div>
                {:else if failed}
                    <div class="empty">Sorry, something went wrong.</div>
                {:else if loaded && comments.length === 0}
                    <div class="empty">No comments found.</div>
                {/if}
            </div>
        </div>
    </div>
    {#if hasMore}
        <div class="ajax-comments-more-button-container">
            <button type="button" class="btn-control-sm rbx-comments-see-more" disabled={loading} onclick={() => load(comments.length)}>See More</button>
        </div>
    {/if}
{:else}
    <div class="AjaxCommentsContainer">
        {#if session.me}
            <div class="PostACommentContainer">
                <form class="PostAComment" onsubmit={post}>
                    <div class="CommentText">
                        <textarea placeholder="Write a comment!" bind:value={text} oninput={onInput}></textarea>
                        <div class="Buttons">
                            <span class="CharsRemaining footnote">{counter}</span>
                            <button type="submit" class="btn-small btn-neutral roblox-comment-button" disabled={posting}>Post Comment</button>
                            {#if error}
                                <div class="commentPaneErrorMessage">{error}</div>
                            {/if}
                        </div>
                    </div>
                </form>
            </div>
        {/if}
        <div class="Comments">
            {#each comments as c (c.id)}
                <div class="Comment text">
                    <div class="Commenter">
                        <div class="Avatar">
                            <a href="/user?id={c.user_id}" title={c.username}>
                                <img src={avatar(c.user_id)} alt={c.username}>
                            </a>
                        </div>
                    </div>
                    <div class="PostContainer">
                        <div class="Post">
                            <div class="Audit">
                                <span class="ByLine footnote">
                                    {#if c.owns}
                                        <span class="UserOwnsAsset" title="User has this item"></span>
                                    {/if}
                                    Posted {ago(c.created_at)} ago by
                                    <a href="/user?id={c.user_id}">{c.username}</a>
                                </span>
                                <div class="ReportAbuse">
                                    <span class="AbuseButton">
                                        <a href="/abusereport?type=comment&id={c.id}">Report Abuse</a>
                                    </span>
                                </div>
                            </div>
                            <div class="Content">{c.body}</div>
                            {#if c.deletable}
                                <div class="Actions">
                                    <button type="button" class="DeleteCommentButton" onclick={() => remove(c)}>Delete Comment</button>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
            {#if loading}
                <div class="loading"></div>
            {:else if failed}
                <div class="empty">Sorry, something went wrong.</div>
            {:else if loaded && comments.length === 0}
                <div class="empty">No comments found.</div>
            {/if}
            {#if hasMore && !loading}
                <div class="more">
                    <button type="button" class="btn-control btn-control-small" onclick={() => load(comments.length)}>More comments</button>
                </div>
            {/if}
        </div>
    </div>
{/if}
