<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { list, num, activityTime, currentTime, forumUrl } from "./common";
    import { topLinks } from "./Bits.svelte";

    let groups = $state<any[]>([]);
    let q = $state("");

    api("/forum").then(d => {
        groups = list(d.groups);
    }).catch(() => {});

    const search = (e: Event) => {
        e.preventDefault();
        router.go("/forum/search?q=" + encodeURIComponent(q));
    };
</script>

<svelte:head>
    <title>Forum - NoneRev</title>
    <link rel="stylesheet" href="/css/forum.css">
</svelte:head>

<main class="forum-legacy-page">
    <div class="forum-legacy-shell">
        {@render topLinks()}
        <div class="forum-index-tools">
            <div class="forum-current-time"><strong>Current time:</strong> {currentTime()}</div>
            <div class="forum-search-inline">
                <form onsubmit={search}>
                    <label>Search None Forums:</label>
                    <input type="text" name="q" maxlength="120" bind:value={q}>
                    <button type="submit">Go</button>
                </form>
            </div>
        </div>

        <div class="forum-index">
            {#if groups.length === 0}
                <div class="forum-empty">No forums yet.</div>
            {/if}
            {#each groups as group}
                <section class="forum-index-section" id={encodeURIComponent(group.section)}>
                    <div class="forum-index-header">
                        <div>{group.section}</div>
                        <div>Threads</div>
                        <div>Posts</div>
                        <div>Last Post</div>
                    </div>
                    {#each list(group.forums) as forum}
                        <div class="forum-index-row">
                            <div class="forum-index-info">
                                <a href={forumUrl(forum.id)} class="forum-index-name">{forum.name}</a>
                                <div class="forum-index-desc">{forum.description}</div>
                            </div>
                            <div class="forum-index-number">{num(forum.threads)}</div>
                            <div class="forum-index-number">{num(forum.posts)}</div>
                            <div class="forum-index-last">
                                {#if forum.last}
                                    <strong>{activityTime(forum.last.created_at)}</strong>
                                    <span class="forum-last-user">{forum.last.username || "Unknown"}</span>
                                {:else}
                                    No posts yet
                                {/if}
                            </div>
                        </div>
                    {/each}
                </section>
            {/each}
        </div>
    </div>
</main>
