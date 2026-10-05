<script module lang="ts">
    import { session } from "../../session.svelte";
    import { num, forumUrl, pageList } from "./common";

    export { top, breadcrumb, pager, pageLinks, body };
</script>

{#snippet top(category?: any, tail?: string)}
    <div class="forum-top">
        <div class="forum-top-left">
            {#if category || tail}
                {@render breadcrumb(category, tail)}
            {/if}
        </div>
        <div class="forum-links">
            <a href="/forum">Home</a>
            <a href="/forum/search">Search</a>
            {#if session.me}
                <a href="/my/forums">MyForums</a>
            {/if}
        </div>
    </div>
{/snippet}

{#snippet breadcrumb(category?: any, tail?: string)}
    <div class="forum-crumbs">
        <span class="forum-crumb"><a href="/forum">None Forum</a></span>
        {#if category}
            <span class="forum-crumb"><b>»</b> <a href="/forum#{encodeURIComponent(category.section)}">{category.section}</a></span>
            <span class="forum-crumb"><b>»</b> <a href={forumUrl(category.id)}>{category.name}</a></span>
        {/if}
        {#if tail}
            <span class="forum-crumb"><b>»</b> <span class="forum-crumb-tail">{tail}</span></span>
        {/if}
    </div>
{/snippet}

{#snippet pageLinks(pages: number[], url: (p: number) => string)}
    {#each pages as p, i}{#if i > 0}<span class="forum-page-sep">{pages[i - 1] === p - 1 ? ", " : " ... "}</span>{/if}<a href={url(p)}>{num(p)}</a>{/each}
{/snippet}

{#snippet pager(page: number, pages: number, base: string)}
    {@const last = Math.max(1, pages)}
    {@const cur = Math.min(Math.max(1, page), last)}
    {@const url = (p: number) => base + (base.includes("?") ? "&" : "?") + "page=" + p}
    <div class="forum-pager">
        <span>Page {num(cur)} of {num(last)}</span>
        {#if last > 1}
            <span class="forum-goto">
                Go to page:
                {#if cur > 1}<a href={url(cur - 1)}>Prev</a>&nbsp;{/if}{@render pageLinks(pageList(cur, last), url)}{#if cur < last}&nbsp;<a href={url(cur + 1)}>Next</a>{/if}
            </span>
        {/if}
    </div>
{/snippet}

{#snippet body(text: string)}
    {String(text ?? "")}
{/snippet}
