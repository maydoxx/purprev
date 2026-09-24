<script module lang="ts">
    import { forumUrl } from "./common";

    export { topLinks, breadcrumb, pager, body };
</script>

{#snippet topLinks()}
    <div class="forum-top-links">
        <a href="/forum">Home</a>
        <span>|</span>
        <a href="/forum/search">Search</a>
        <span>|</span>
        <a href="/my/forums">MyForums</a>
    </div>
{/snippet}

{#snippet breadcrumb(category?: any, tail?: string)}
    <div class="forum-breadcrumb">
        <a href="/forum">None Forum</a>
        {#if category}
            <span>»</span><a href="/forum#{encodeURIComponent(category.section)}">{category.section}</a>
            <span>»</span><a href={forumUrl(category.id)}>{category.name}</a>
        {/if}
        {#if tail}
            <span>»</span><span>{tail}</span>
        {/if}
    </div>
{/snippet}

{#snippet pager(page: number, pages: number, base: string)}
    {@const last = Math.max(1, pages)}
    {@const cur = Math.min(Math.max(1, page), last)}
    {@const url = (p: number) => base + (base.includes("?") ? "&" : "?") + "page=" + p}
    {@const start = Math.max(1, cur - 2)}
    {@const end = Math.min(last, cur + 2)}
    <div class="forum-pagination">
        <span class="forum-page-count">Page {cur} of {last}</span>
        {#if last > 1}
            <div class="forum-goto">
                <strong>Goto page:</strong>
                {#if cur > 1}<a href={url(cur - 1)}>Prev</a>{/if}
                {#if start > 1}
                    <a href={url(1)}>1</a>
                    {#if start > 2}<span>...</span>{/if}
                {/if}
                {#each { length: end - start + 1 } as _, i}
                    {@const p = start + i}
                    {#if p === cur}<span class="current">{p}</span>{:else}<a href={url(p)}>{p}</a>{/if}
                {/each}
                {#if end < last}
                    {#if end < last - 1}<span>...</span>{/if}
                    <a href={url(last)}>{last}</a>
                {/if}
                {#if cur < last}<a href={url(cur + 1)}>Next</a>{/if}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet body(text: string)}
    {#each String(text ?? "").split("\n") as line, i}{#if i > 0}<br>{/if}{line}{/each}
{/snippet}
