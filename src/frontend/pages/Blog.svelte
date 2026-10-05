<script lang="ts">
    import { tick } from "svelte";
    import { slide } from "svelte/transition";
    import { api } from "../api";
    import { router } from "../router.svelte";

    const siteName = "NoneRev";
    const tagline = `${siteName} Blog | News and updates from ${siteName}.`;
    const defaultCategories: Record<string, string> = {
        news: "News",
        community: "Community",
        development: "Development",
        events: "Events"
    };

    const postId = $derived(Math.max(0, Number(router.query.id) || 0));
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const query = $derived((router.query.q ?? "").trim());

    let categories = $state<Record<string, string>>(defaultCategories);
    const category = $derived(router.query.category && categories[router.query.category] ? router.query.category : "");

    let post = $state<any>(null);
    let more = $state<any[]>([]);
    let prevPost = $state<any>(null);
    let nextPost = $state<any>(null);
    let posts = $state<any[]>([]);
    let totalPages = $state(1);
    let loaded = $state(false);
    let menuOpen = $state(false);
    let searchOpen = $state(false);
    let term = $state("");
    let searchInput = $state<HTMLInputElement>();

    $effect(() => {
        loaded = false;
        post = null;
        more = [];
        prevPost = null;
        nextPost = null;
        posts = [];

        const req = postId > 0
            ? api(`/site/blog/${postId}`).then(d => {
                if (d?.post?.id) {
                    post = d.post;
                    more = Array.isArray(d.more) ? d.more : [];
                    prevPost = d.prev?.id ? d.prev : null;
                    nextPost = d.next?.id ? d.next : null;
                } else if (d?.id) {
                    post = d;
                }
                if (d?.categories) categories = d.categories;
            })
            : api(`/site/blog?category=${encodeURIComponent(router.query.category ?? "")}&page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}`).then(d => {
                const list = Array.isArray(d) ? d : d?.posts;
                posts = Array.isArray(list) ? list : [];
                totalPages = Math.max(1, Number(d?.totalPages) || 1);
                if (d?.categories) categories = d.categories;
            });

        req.catch(() => {}).finally(() => {
            loaded = true;
        });
    });

    const home = $derived(!postId && !category && !query);

    const heading = $derived(postId ? "" : query ? `Search Results for: ${query}` : category ? categories[category] : "");

    const title = $derived.by(() => {
        if (post) return `${post.title} | ${tagline}`;
        if (postId > 0) return loaded ? `Post Not Found | ${tagline}` : tagline;
        if (query) return `Search Results ${query} | ${tagline}`;
        if (category) return `${categories[category]} | ${tagline}`;
        return tagline;
    });

    const pager = $derived.by(() => {
        const out: (number | null)[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
                out.push(i);
            } else if (out[out.length - 1] !== null) {
                out.push(null);
            }
        }
        return out;
    });

    const name = (key: string) => categories[key] ?? (key ? key[0].toUpperCase() + key.slice(1) : "");
    const url = (cat: string, p = 1, q = "") => {
        const params = new URLSearchParams();
        if (cat) params.set("category", cat);
        if (q) params.set("q", q);
        if (p > 1) params.set("page", String(p));
        const s = params.toString();
        return "/blog" + (s ? "?" + s : "");
    };
    const long = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
    const paragraphs = (body: string) => String(body ?? "").trim().split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
    const excerpt = (p: any, len: number) => {
        if (p.excerpt?.trim()) return p.excerpt.trim();
        const first = (paragraphs(p.body)[0] ?? "").replace(/\s+/g, " ");
        let out = "";
        for (const sentence of first.match(/.+?(?:[.!?]+["')]*(?=\s|$)|$)/g) ?? []) {
            if (out && out.length + sentence.length > len) break;
            out += sentence;
        }
        return out.trim();
    };
    const close = () => {
        menuOpen = false;
    };
    const toggleSearch = async () => {
        searchOpen = !searchOpen;
        if (searchOpen) {
            term = query;
            await tick();
            searchInput?.focus();
        }
    };
    const search = (e: SubmitEvent) => {
        e.preventDefault();
        searchOpen = false;
        router.go(url("", 1, term.trim()));
    };
</script>

<svelte:head>
    <title>{title}</title>
    <link rel="stylesheet" href="/css/blog.css">
</svelte:head>

{#snippet meta(p: any)}
    <div class="blog-meta">
        <span class="blog-meta-date">
            <a href="/blog?id={p.id}"><i class="bi bi-clock"></i>{long(p.published_at)}</a>
        </span>
        <span class="blog-meta-author">
            <svg class="blog-meta-icon" width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                <ellipse cx="7.5" cy="4.25" rx="2.1" ry="2.95"/>
                <path d="M1.75 13.2V11.2C1.75 9.4 3 8 5 7.4L7.45 8.3 9.9 7.4C11.9 8 13 9.4 13 11.2V13.2Q7.4 13.9 1.75 13.2Z"/>
            </svg>{p.author_name || siteName}
        </span>
        <span class="blog-meta-category">
            <svg class="blog-meta-icon" width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                <path d="M1 2H6.8L7.6 4H13.1V12H1Z"/>
            </svg><a href={url(p.category)}>{name(p.category)}</a>
        </span>
    </div>
{/snippet}

<div class="blog-site" class:blog-menu-open={menuOpen}>
    <nav class="blog-menu" aria-label="Blog menu">
        <button class="blog-menu-close" type="button" aria-label="Close menu" onclick={close}>&times;</button>
        <ul>
            <li><a href="/blog" onclick={close}>Home</a></li>
            {#each Object.entries(categories) as [key, label]}
                <li><a href={url(key)} onclick={close}>{label}</a></li>
            {/each}
            <li><a href="/home">Back to {siteName}</a></li>
        </ul>
    </nav>

    <div class="blog-page">
        {#if searchOpen}
            <div class="blog-search" transition:slide={{ duration: 400 }}>
                <form class="blog-search-form" role="search" onsubmit={search}>
                    <input bind:this={searchInput} bind:value={term} type="search" name="q" placeholder="Search &hellip;" aria-label="Search the blog">
                    <button class="blog-search-close" type="button" aria-label="Close search" onclick={() => (searchOpen = false)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>
                        </svg>
                    </button>
                </form>
            </div>
        {/if}

        <header class="blog-masthead" class:blog-masthead-home={home}>
            <div class="blog-masthead-bar">
                <div class="blog-wrap">
                    <a class="blog-logo" href="/blog">
                        <img src="/img/nonelogo.png" alt={siteName}>
                        <span>Blog</span>
                    </a>
                </div>
                <button class="blog-menu-toggle" type="button" aria-label="Open menu" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
                    <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
                        <rect width="28" height="6"/>
                        <rect y="8" width="28" height="6"/>
                        <rect y="16" width="28" height="6"/>
                    </svg>
                </button>
                <button class="blog-search-toggle" type="button" aria-label="Search" aria-expanded={searchOpen} onclick={toggleSearch}>
                    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                        <circle cx="8.5" cy="8.6" r="6.5"/>
                        <path d="M14 14 20.7 20.7"/>
                    </svg>
                </button>
            </div>

            {#if home}
                <div class="blog-hero">
                    <div class="blog-wrap">
                        <p>
                            {#each Object.entries(categories) as [key, label], i}
                                {#if i > 0}{" / "}{/if}<a href={url(key)}>{label}</a>
                            {/each}
                        </p>
                    </div>
                </div>

                <div class="blog-notch">
                    <span class="blog-notch-left"></span>
                    <span class="blog-notch-right"></span>
                </div>
            {/if}
        </header>

        {#if heading}
            <header class="blog-page-header">
                <h1>{heading}</h1>
            </header>
        {/if}

        <main class="blog-main" class:blog-main-single={postId > 0}>
            <div class="blog-wrap">
                <div class="blog-primary">
                    {#if postId > 0}
                        {#if !loaded}
                        {:else if !post}
                            <article class="blog-post blog-post-single">
                                <h1 class="blog-post-heading">Post not found</h1>
                                <div class="blog-post-content">
                                    <p>That post doesn't exist or isn't published.</p>
                                </div>
                                <nav class="blog-post-nav">
                                    <a href="/blog" class="blog-button">Back to Blog</a>
                                </nav>
                            </article>
                        {:else}
                            <article class="blog-post blog-post-single">
                                <header class="blog-post-header">
                                    {#if post.image?.trim()}
                                        <img class="blog-post-hero" src={post.image} alt={post.title}>
                                    {/if}
                                    <h1 class="blog-post-heading">{post.title}</h1>
                                    {@render meta(post)}
                                </header>

                                <div class="blog-post-content">
                                    {#each paragraphs(post.body) as p}
                                        <p style="white-space: pre-line">{p}</p>
                                    {/each}
                                </div>

                                <section class="blog-more">
                                    <h2>More from the blog</h2>
                                    {#if more.length === 0}
                                        <p class="blog-more-empty">No other posts yet.</p>
                                    {:else}
                                        <ul>
                                            {#each more as m (m.id)}
                                                <li>
                                                    <a href="/blog?id={m.id}">{m.title}</a>
                                                    <span>{long(m.published_at)} · {name(m.category)}</span>
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                    <p class="blog-more-all">
                                        <a href="/blog">&larr; Back to all posts</a>
                                    </p>
                                </section>

                                {#if prevPost || nextPost}
                                    <nav class="blog-post-nav" aria-label="Older and newer posts">
                                        {#if prevPost}
                                            <a class="blog-post-prev" href="/blog?id={prevPost.id}" rel="prev" title={prevPost.title} aria-label="Previous post: {prevPost.title}">
                                                <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
                                                    <path d="M19.1 11.8 13.9 18 19.1 24.2"/>
                                                </svg>
                                            </a>
                                        {/if}
                                        {#if nextPost}
                                            <a class="blog-post-next" href="/blog?id={nextPost.id}" rel="next" title={nextPost.title} aria-label="Next post: {nextPost.title}">
                                                <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
                                                    <path d="M14.9 11.8 20.1 18 14.9 24.2"/>
                                                </svg>
                                            </a>
                                        {/if}
                                    </nav>
                                {/if}
                            </article>
                        {/if}
                    {:else if !loaded}
                    {:else if posts.length === 0}
                        <article class="blog-post blog-post-empty">
                            <h2 class="blog-post-title">Nothing here yet</h2>
                            <div class="blog-post-content">
                                <p>{query ? "No posts match your search." : "There aren't any published posts in this section yet."}</p>
                            </div>
                        </article>
                    {:else}
                        {#each posts as item (item.id)}
                            <article class="blog-post">
                                {#if item.image?.trim()}
                                    <div class="blog-post-thumb">
                                        <a href="/blog?id={item.id}">
                                            <img src={item.image} alt={item.title}>
                                        </a>
                                    </div>
                                {/if}

                                <h2 class="blog-post-title">
                                    <a href="/blog?id={item.id}">{item.title}</a>
                                </h2>

                                {@render meta(item)}

                                <div class="blog-post-content">
                                    <p>{excerpt(item, 600)}</p>
                                    <p class="blog-post-more">
                                        <a href="/blog?id={item.id}" class="blog-button">Continue reading &rarr;</a>
                                    </p>
                                </div>
                            </article>
                        {/each}

                        {#if totalPages > 1}
                            <nav class="blog-pager" aria-label="Blog pages">
                                <ul>
                                    {#if page > 1}
                                        <li><a class="blog-page-number" href={url(category, page - 1, query)} aria-label="Previous page">&larr;</a></li>{" "}
                                    {/if}
                                    {#each pager as i}
                                        <li>
                                            {#if i === null}
                                                <span class="blog-page-number blog-page-dots">&hellip;</span>
                                            {:else if i === page}
                                                <span class="blog-page-number blog-page-current">{i}</span>
                                            {:else}
                                                <a class="blog-page-number" href={url(category, i, query)}>{i}</a>
                                            {/if}
                                        </li>{" "}
                                    {/each}
                                    {#if page < totalPages}
                                        <li><a class="blog-page-number blog-page-arrow" href={url(category, page + 1, query)} aria-label="Next page">&rarr;</a></li>
                                    {/if}
                                </ul>
                            </nav>
                        {/if}
                    {/if}
                </div>
            </div>
        </main>

        <section class="blog-promo">
            <div class="blog-wrap">
                <div class="blog-promo-row">
                    <div class="blog-promo-cell">
                        <a class="blog-promo-tile" href="/download">
                            <span>Create Games,<br><b>Play Games</b></span>
                        </a>
                    </div>
                    <div class="blog-promo-cell">
                        <a class="blog-promo-tile" href="/forum">
                            <span>Talk with us on the<br><b>Forum</b></span>
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <section class="blog-social">
            <div class="blog-wrap">
                <a href="/discord" aria-label="Discord"><i class="bi bi-discord"></i></a>
            </div>
        </section>

        <footer class="blog-footer">
            {tagline}
        </footer>
    </div>
</div>
