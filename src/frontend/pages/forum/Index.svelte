<script lang="ts">
    import { api } from "../../api";
    import UserAd from "../../UserAd.svelte";
    import { router } from "../../router.svelte";
    import { list, num, activityTime, currentTime, forumUrl } from "./common";
    import { top } from "./Bits.svelte";

    let groups = $state<any[]>([]);
    let loaded = $state(false);
    let q = $state("");

    api("/forum").then(d => {
        groups = list(d.groups);
    }).catch(() => {}).finally(() => loaded = true);

    const search = (e: Event) => {
        e.preventDefault();
        router.go("/forum/search?q=" + encodeURIComponent(q));
    };
</script>

<svelte:head>
    <title>Forum - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-page">
    <UserAd size="banner" class="user-ad-top" />
    <UserAd size="skyscraper" class="user-ad-side" />
    <div class="forum-container">
        {@render top()}
        <div class="forum-tools">
            <div>
                <b>Current time:</b>
                {currentTime()}
            </div>
            <form class="forum-search" onsubmit={search}>
                <b>Search None Forums:</b>
                <input class="forum-input" type="text" name="q" maxlength="50" bind:value={q}>
                <button class="forum-button" type="submit">Go</button>
            </form>
        </div>

        {#if loaded && groups.length === 0}
            <div class="forum-empty">No forums yet.</div>
        {:else}
            <table class="forum-table forum-groups">
                <colgroup>
                    <col class="forum-col-name">
                    <col class="forum-col-threads">
                    <col class="forum-col-posts">
                    <col class="forum-col-latest">
                </colgroup>
                <tbody>
                    {#each groups as group}
                        <tr class="forum-head">
                            <th id={encodeURIComponent(group.section)}><a href="/forum#{encodeURIComponent(group.section)}">{group.section}</a></th>
                            <th>&nbsp;&nbsp;Threads&nbsp;&nbsp;</th>
                            <th>&nbsp;&nbsp;Posts&nbsp;&nbsp;</th>
                            <th>&nbsp;Last Post&nbsp;</th>
                        </tr>
                        {#each list(group.forums) as forum}
                            <tr class="forum-row">
                                <td>
                                    <a class="forum-summary" href={forumUrl(forum.id)}>
                                        <b>{forum.name}</b>
                                        <span>{forum.description}</span>
                                    </a>
                                </td>
                                <td class="forum-center"><span class="forum-small">{num(forum.threads)}</span></td>
                                <td class="forum-center"><span class="forum-small">{num(forum.posts)}</span></td>
                                <td>
                                    {#if forum.last}
                                        <a class="forum-last" href={forumUrl(forum.id)}>
                                            <b>{activityTime(forum.last.created_at)}</b>
                                            <span>{forum.last.username || "Unknown"}</span>
                                        </a>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
</main>
