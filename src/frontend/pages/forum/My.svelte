<script lang="ts">
    import { api } from "../../api";
    import { list, num, replies, activityTime, threadUrl, threadIcon, seenThreads } from "./common";
    import { top } from "./Bits.svelte";

    let mine = $state<any[]>([]);
    let tracked = $state<any[]>([]);
    let names = $state(new Map<number, string>());
    let loaded = $state(false);

    const seen = seenThreads();

    api("/forum/my").then(d => {
        mine = list(d.mine);
        tracked = list(d.tracked);
    }).catch(() => {}).finally(() => loaded = true);

    api("/forum").then(d => {
        names = new Map(list(d.groups).flatMap(g => list(g.forums)).map(f => [Number(f.id), f.name]));
    }).catch(() => {});

    const forumName = (row: any) => row.forum_name ?? row.forum?.name ?? names.get(Number(row.forum_id)) ?? "";
</script>

{#snippet section(title: string, rows: any[])}
    <table class="forum-table forum-threads forum-mine">
        <colgroup>
            <col class="forum-col-icon">
            <col>
            <col class="forum-col-forum">
            <col class="forum-col-replies">
            <col class="forum-col-last">
        </colgroup>
        <tbody>
            <tr class="forum-head">
                <th colspan="2">&nbsp;{title}&nbsp;</th>
                <th>&nbsp;Forum&nbsp;</th>
                <th class="forum-center">&nbsp;Replies&nbsp;</th>
                <th class="forum-center">&nbsp;Last Post&nbsp;</th>
            </tr>
            {#if loaded && rows.length === 0}
                <tr class="forum-row">
                    <td class="forum-empty" colspan="5">No threads here yet.</td>
                </tr>
            {/if}
            {#each rows as row}
                {@const icon = threadIcon(row, seen.has(Number(row.id)))}
                {@const count = replies(row)}
                <tr class="forum-row">
                    <td class="forum-icon"><img src={icon.src} title={icon.title} alt={icon.title}></td>
                    <td><a class="forum-subject" href={threadUrl(row.id)}>{row.subject}</a></td>
                    <td><span class="forum-small">{forumName(row)}</span></td>
                    <td class="forum-center"><span class="forum-small">{count > 0 ? num(count) : "-"}</span></td>
                    <td>
                        <a class="forum-last" href={threadUrl(row.id)}>
                            <b>{activityTime(row.last_post_at ?? row.updated_at)}</b>
                            <span>{row.last_post_username || row.author_username || "Unknown"}</span>
                        </a>
                    </td>
                </tr>
            {/each}
            <tr class="forum-foot">
                <td colspan="5">&nbsp;</td>
            </tr>
        </tbody>
    </table>
{/snippet}

<svelte:head>
    <title>My Forums - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <div class="forum-container">
        {@render top(null, "MyForums")}
        <h2 class="forum-title">My Forums</h2>
        {@render section("Tracked Threads", tracked)}
        {@render section("My Threads", mine)}
    </div>
</main>
