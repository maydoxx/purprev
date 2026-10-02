<script lang="ts">
    import { api } from "../../api";
    import { list, num, activityTime, threadUrl } from "./common";
    import { top } from "./Bits.svelte";

    let mine = $state<any[]>([]);
    let tracked = $state<any[]>([]);
    let loaded = $state(false);

    api("/forum/my").then(d => {
        mine = list(d.mine);
        tracked = list(d.tracked);
    }).catch(() => {}).finally(() => loaded = true);
</script>

{#snippet section(title: string, rows: any[])}
    <section class="forum-threads forum-mine">
        <div class="forum-head">
            <div>{title}</div>
            <div class="forum-col-forum">Forum</div>
            <div class="forum-col-replies">Replies</div>
            <div class="forum-col-last">Last Post</div>
        </div>
        {#if loaded && rows.length === 0}
            <div class="forum-empty">No threads here yet.</div>
        {/if}
        {#each rows as row}
            <div class="forum-row">
                <div class="forum-subject">
                    <img src="/img/forum/thread-read.png" alt="">
                    <a href={threadUrl(row.id)}>{row.subject}</a>
                </div>
                <div class="forum-cell forum-col-forum">{row.forum_name ?? row.forum?.name ?? "Unknown"}</div>
                <div class="forum-cell forum-col-replies">{num(Math.max(0, Number(row.post_count || 0) - 1))}</div>
                <div class="forum-cell forum-col-last forum-last">
                    <strong>{activityTime(row.updated_at)}</strong>
                </div>
            </div>
        {/each}
        <div class="forum-foot"></div>
    </section>
{/snippet}

<svelte:head>
    <title>My Forums - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(null, "MyForums")}
        <h1 class="forum-title">My Forums</h1>
        {@render section("My Threads", mine)}
        {@render section("Tracked Threads", tracked)}
    </div>
</main>
