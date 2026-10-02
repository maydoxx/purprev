<script lang="ts">
    import { api } from "../../api";
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
    <div class="forum-container">
        {@render top()}
        <div class="forum-tools">
            <div class="forum-time">
                <strong>Current time:</strong>
                {currentTime()}
            </div>
            <form class="forum-search" onsubmit={search}>
                <label for="forum-q">Search None Forums:</label>
                <input id="forum-q" type="text" name="q" maxlength="120" bind:value={q}>
                <button class="forum-btn forum-btn-go" type="submit">Go</button>
            </form>
        </div>

        {#if loaded && groups.length === 0}
            <div class="forum-empty">No forums yet.</div>
        {/if}
        {#each groups as group}
            <section class="forum-section" id={encodeURIComponent(group.section)}>
                <div class="forum-head">
                    <div>{group.section}</div>
                    <div class="forum-col-threads">Threads</div>
                    <div class="forum-col-posts">Posts</div>
                    <div class="forum-col-latest">Last Post</div>
                </div>
                {#each list(group.forums) as forum}
                    <div class="forum-row">
                        <a class="forum-info" href={forumUrl(forum.id)}>
                            <strong>{forum.name}</strong>
                            <span>{forum.description}</span>
                        </a>
                        <div class="forum-cell forum-col-threads">{num(forum.threads)}</div>
                        <div class="forum-cell forum-col-posts">{num(forum.posts)}</div>
                        <div class="forum-cell forum-col-latest forum-last">
                            {#if forum.last}
                                <strong>{activityTime(forum.last.created_at)}</strong>
                                <span>{forum.last.username || "Unknown"}</span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </section>
        {/each}
    </div>
</main>
