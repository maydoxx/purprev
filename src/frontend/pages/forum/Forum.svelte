<script lang="ts">
    import { api } from "../../api";
    import UserAd from "../../UserAd.svelte";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { list, num, pageNum, pageList, replies, activityTime, forumUrl, threadUrl, threadIcon, seenThreads, markSeen } from "./common";
    import { top, breadcrumb, pager, pageLinks } from "./Bits.svelte";

    const POSTS_PER_PAGE = 15;

    const forumId = $derived(Number(router.query.ForumID) || 0);
    const q = $derived(router.query.q ?? "");
    const page = $derived(pageNum(router.query.page));

    let forum = $state<any>(null);
    let threads = $state<any[]>([]);
    let seen = $state(seenThreads());
    let pages = $state(1);
    let loaded = $state(false);
    let notFound = $state(false);
    let error = $state("");
    let search = $state("");
    let days = $state(0);
    let hideRead = $state(false);

    $effect(() => {
        search = q;
        notFound = forumId <= 0;
        error = "";
        if (notFound) {
            return;
        }
        api(`/forum/${forumId}/threads?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            forum = d.forum ?? null;
            threads = list(d.threads);
            pages = Math.max(1, Number(d.pages) || 1);
            loaded = true;
        }).catch(err => {
            if (err.status === 404) {
                notFound = true;
            } else {
                error = err.message;
            }
        });
    });

    const submit = (e: Event) => {
        e.preventDefault();
        router.go(forumUrl(forumId) + (search ? "&q=" + encodeURIComponent(search) : ""));
    };

    const markAll = (e: Event) => {
        e.preventDefault();
        markSeen(...threads.map(t => Number(t.id)));
        seen = seenThreads();
    };

    const base = $derived(forumUrl(forumId) + (q ? "&q=" + encodeURIComponent(q) : ""));
    const threadPages = (t: any) => Math.max(1, Math.ceil(Number(t.post_count || 0) / POSTS_PER_PAGE));
    const lastAt = (t: any) => Number(t.last_post_at ?? t.updated_at ?? 0);

    const shown = $derived(threads.filter(t => {
        if (hideRead && seen.has(Number(t.id))) {
            return false;
        }
        return days === 0 || lastAt(t) >= Date.now() / 1000 - days * 86400;
    }));
</script>

<svelte:head>
    <title>{forum ? forum.name : notFound ? "Forum Not Found" : "Forum"} - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <UserAd size="banner" class="user-ad-top" />
    <UserAd size="skyscraper" class="user-ad-side" />
    <div class="forum-container">
        {@render top(forum)}
        {#if notFound}
            <div class="forum-empty">That forum does not exist.</div>
        {:else}
            <div class="forum-tools">
                <a class="forum-button forum-button-gap" href="/forum/new?ForumID={forumId}">New Thread</a>
                <form class="forum-search" onsubmit={submit}>
                    <b>Search this forum:</b>
                    <input class="forum-input" type="text" name="q" maxlength="120" bind:value={search}>
                    <button class="forum-button" type="submit">&nbsp;Go&nbsp;</button>
                </form>
            </div>
            {#if error}
                <div class="forum-error">{error}</div>
            {/if}

            <table class="forum-table forum-threads">
                <colgroup>
                    <col class="forum-col-icon">
                    <col class="forum-col-subject">
                    <col class="forum-col-pages">
                    <col class="forum-col-author">
                    <col class="forum-col-replies">
                    <col class="forum-col-views">
                    <col class="forum-col-last">
                </colgroup>
                <tbody>
                    <tr class="forum-head">
                        <th colspan="3">&nbsp;Subject&nbsp;</th>
                        <th>&nbsp;Author&nbsp;</th>
                        <th class="forum-center">&nbsp;Replies&nbsp;</th>
                        <th class="forum-center">&nbsp;Views&nbsp;</th>
                        <th class="forum-center">&nbsp;Last Post&nbsp;</th>
                    </tr>
                    {#if loaded && shown.length === 0}
                        <tr class="forum-row">
                            <td class="forum-empty" colspan="7">No threads found.</td>
                        </tr>
                    {/if}
                    {#each shown as thread}
                        {@const tp = threadPages(thread)}
                        {@const icon = threadIcon(thread, seen.has(Number(thread.id)))}
                        {@const count = replies(thread)}
                        <tr class="forum-row">
                            <td class="forum-icon"><img src={icon.src} title={icon.title} alt={icon.title}></td>
                            <td><a class="forum-subject" href={threadUrl(thread.id)}>{thread.subject}</a></td>
                            <td class="forum-pages">
                                {#if tp > 1}
                                    {@render pageLinks(pageList(1, tp), p => `${threadUrl(thread.id)}&page=${p}`)}
                                {/if}
                            </td>
                            <td><a class="forum-author-link" href="/user?id={thread.author_id}"><span>{thread.author_username || "Unknown"}</span></a></td>
                            <td class="forum-center"><span class="forum-small">{count > 0 ? num(count) : "-"}</span></td>
                            <td class="forum-center"><span class="forum-small">{num(thread.views)}</span></td>
                            <td>
                                <a class="forum-last" href={tp > 1 ? `${threadUrl(thread.id)}&page=${tp}` : threadUrl(thread.id)}>
                                    <b>{thread.is_pinned ? "Pinned Post" : activityTime(lastAt(thread))}</b>
                                    <span>{thread.last_post_username || thread.author_username || "Unknown"}</span>
                                </a>
                            </td>
                        </tr>
                    {/each}
                    <tr class="forum-foot">
                        <td colspan="7">&nbsp;</td>
                    </tr>
                </tbody>
            </table>
            {@render pager(page, pages, base)}

            <div class="forum-bottom">
                {@render breadcrumb(forum)}
                <div class="forum-display">
                    <div class="forum-display-days">
                        <b>Display threads for:</b>
                        <select class="forum-select" name="days" bind:value={days}>
                            <option value={0}>All Days</option>
                            <option value={1}>Today</option>
                            <option value={3}>Past 3 Days</option>
                            <option value={7}>Past Week</option>
                            <option value={14}>Past 2 Weeks</option>
                            <option value={30}>Past Month</option>
                            <option value={90}>Past 3 Months</option>
                            <option value={180}>Past 6 Months</option>
                            <option value={360}>Past Year</option>
                        </select>
                    </div>
                    <a href={base} onclick={markAll}>Mark all threads as read</a>
                    {#if session.me}
                        <div>
                            <label class="forum-check"><input type="checkbox" name="hide_read" bind:checked={hideRead}>Hide read threads</label>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</main>
