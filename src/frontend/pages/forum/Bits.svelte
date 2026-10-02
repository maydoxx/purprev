<script module lang="ts">
    import { forumUrl } from "./common";

    export { top, breadcrumb, pager, body };
</script>

{#snippet top(category?: any, tail?: string)}
    <div class="forum-top">
        {#if category || tail}
            {@render breadcrumb(category, tail)}
        {/if}
        <div class="forum-links">
            <a href="/forum">Home</a>
            <a href="/forum/search">Search</a>
            <a href="/my/forums">MyForums</a>
        </div>
    </div>
{/snippet}

{#snippet breadcrumb(category?: any, tail?: string)}
    <div class="forum-crumbs">
        <a href="/forum">None Forum</a>
        {#if category}
            »
            <a href="/forum#{encodeURIComponent(category.section)}">{category.section}</a>
            »
            <a href={forumUrl(category.id)}>{category.name}</a>
        {/if}
        {#if tail}
            »
            <span>{tail}</span>
        {/if}
    </div>
{/snippet}

{#snippet pager(page: number, pages: number, base: string)}
    {@const last = Math.max(1, pages)}
    {@const cur = Math.min(Math.max(1, page), last)}
    {@const url = (p: number) => base + (base.includes("?") ? "&" : "?") + "page=" + p}
    {@const start = Math.max(1, cur - 2)}
    {@const end = Math.min(last, cur + 2)}
    <div class="forum-pager">
        <span>Page {cur} of {last}</span>
        {#if last > 1}
            <div class="forum-goto">
                <span>Goto page:</span>
                {#if cur > 1}
                    <a href={url(cur - 1)}>Prev</a>
                {/if}
                {#if start > 1}
                    <a class="forum-goto-page" href={url(1)}>1</a>
                    {#if start > 2}
                        <span class="forum-goto-page">…</span>
                    {/if}
                {/if}
                {#each { length: end - start + 1 } as _, i}
                    {@const p = start + i}
                    {#if p === cur}
                        <span class="forum-goto-page current">{p}</span>
                    {:else}
                        <a class="forum-goto-page" href={url(p)}>{p}</a>
                    {/if}
                {/each}
                {#if end < last}
                    {#if end < last - 1}
                        <span class="forum-goto-page">…</span>
                    {/if}
                    <a class="forum-goto-page" href={url(last)}>{last}</a>
                {/if}
                {#if cur < last}
                    <a href={url(cur + 1)}>Next</a>
                {/if}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet body(text: string)}
    {#each String(text ?? "").split("\n") as line, i}
        {#if i > 0}
            <br>
        {/if}
        {line}
    {/each}
{/snippet}
