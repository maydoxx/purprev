<script lang="ts">
    import { api } from "../../api";
    import { list, num, activityTime, threadUrl } from "./common";
    import { topLinks, breadcrumb } from "./Bits.svelte";

    let mine = $state<any[]>([]);
    let tracked = $state<any[]>([]);

    api("/forum/my").then(d => {
        mine = list(d.mine);
        tracked = list(d.tracked);
    }).catch(() => {});
</script>

{#snippet section(title: string, rows: any[])}
    <section class="forum-my-section">
        <div class="forum-blue-title left">{title}</div>
        {#if rows.length === 0}
            <div class="forum-empty">No threads here yet.</div>
        {/if}
        {#each rows as row}
            <div class="forum-my-row">
                <img class="forum-thread-icon" src="/img/Forums/thread-read.png" alt="">
                <div><a href={threadUrl(row.id)}>{row.subject}</a><small>{row.forum_name ?? row.forum?.name ?? "Unknown"} · {num(Math.max(0, Number(row.post_count || 0) - 1))} replies</small></div>
                <time>{activityTime(row.updated_at)}</time>
            </div>
        {/each}
    </section>
{/snippet}

<svelte:head>
    <title>My Forums - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        <div class="forum-top-row">{@render breadcrumb(null, "MyForums")}{@render topLinks()}</div>
        <h1 class="forum-form-title">My Forums</h1>
        {@render section("My Threads", mine)}
        {@render section("Tracked Threads", tracked)}
    </div>
</main>
