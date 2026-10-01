<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    const siteName = "NoneRev";
    const defaultCategories: Record<string, string> = {
        news: "News",
        community: "Community",
        development: "Development",
        events: "Events"
    };

    const postId = $derived(Math.max(0, Number(router.query.id) || 0));
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let categories = $state<Record<string, string>>(defaultCategories);
    const category = $derived(router.query.category && categories[router.query.category] ? router.query.category : "");

    let post = $state<any>(null);
    let more = $state<any[]>([]);
    let posts = $state<any[]>([]);
    let totalPages = $state(1);
    let loaded = $state(false);

    $effect(() => {
        loaded = false;
        post = null;
        more = [];
        posts = [];

        const req = postId > 0
            ? api(`/site/blog/${postId}`).then(d => {
                if (d?.post?.id) {
                    post = d.post;
                    more = Array.isArray(d.more) ? d.more : [];
                } else if (d?.id) {
                    post = d;
                }
                if (d?.categories) categories = d.categories;
            })
            : api(`/site/blog?category=${encodeURIComponent(router.query.category ?? "")}&page=${page}`).then(d => {
                const list = Array.isArray(d) ? d : d?.posts;
                posts = Array.isArray(list) ? list : [];
                totalPages = Math.max(1, Number(d?.totalPages) || 1);
                if (d?.categories) categories = d.categories;
            });

        req.catch(() => {}).finally(() => {
            loaded = true;
        });
    });

    const featured = $derived(page === 1 && posts.length > 0 ? posts[0] : null);
    const rest = $derived(featured ? posts.slice(1) : posts);
    const pages = $derived.by(() => {
        const out = [];
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) out.push(i);
        return out;
    });

    const name = (key: string) => categories[key] ?? (key ? key[0].toUpperCase() + key.slice(1) : "");
    const url = (cat: string, p = 1) => {
        const params = new URLSearchParams();
        if (cat) params.set("category", cat);
        if (p > 1) params.set("page", String(p));
        const s = params.toString();
        return "/blog" + (s ? "?" + s : "");
    };
    const long = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
    const short = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    const excerpt = (p: any, len: number) => {
        if (p.excerpt?.trim()) return p.excerpt.trim();
        const body = String(p.body ?? "").replace(/\s+/g, " ").trim();
        return body.length <= len ? body : body.slice(0, len - 1).trimEnd() + "…";
    };
    const paragraphs = (body: string) => String(body ?? "").trim().split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
</script>

<svelte:head>
    <title>{post ? post.title : postId > 0 && loaded ? "Post Not Found" : "Blog"} - {siteName}</title>
    <link rel="stylesheet" href="/css/blog.css">
</svelte:head>

{#snippet badge(key: string)}
    <span class="badge blog-category-badge">{name(key)}</span>
{/snippet}

{#snippet fallback(large: boolean)}
    <div class="blog-image-fallback" class:blog-image-fallback-large={large}>
        <span>{siteName}</span>
    </div>
{/snippet}

<nav class="navbar navbar-expand-lg navbar-dark blog-navbar">
    <div class="container">
        <a class="navbar-brand blog-brand" href="/blog">
            <img src="/img/nonelogo.png" alt={siteName}>
            <span>Blog</span>
        </a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#blogNavbar" aria-controls="blogNavbar" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="blogNavbar">
            <ul class="navbar-nav ms-lg-4 me-auto mb-2 mb-lg-0">
                <li class="nav-item">
                    <a class="nav-link" class:active={category === "" && !postId} href="/blog">Latest</a>
                </li>
                {#each Object.entries(categories) as [key, label]}
                    <li class="nav-item">
                        <a class="nav-link" class:active={category === key && !postId} href={url(key)}>{label}</a>
                    </li>
                {/each}
            </ul>

            <a href="/home" class="btn btn-outline-light btn-sm px-3">Back to {siteName}</a>
        </div>
    </div>
</nav>

<main class="blog-main">
    {#if postId > 0}
        {#if !loaded}
            <div class="container py-5"></div>
        {:else if !post}
            <div class="container py-5">
                <div class="card border-0 shadow-sm blog-empty-card">
                    <div class="card-body text-center py-5 px-4">
                        <div class="blog-empty-code">404</div>
                        <h1 class="h3 mb-2">Post not found</h1>
                        <p class="text-secondary mb-4">That post doesn't exist or isn't published.</p>
                        <a href="/blog" class="btn btn-primary">Back to Blog</a>
                    </div>
                </div>
            </div>
        {:else}
            <article>
                <div class="blog-article-heading border-bottom">
                    <div class="container py-4 py-lg-5">
                        <nav aria-label="breadcrumb" class="mb-3">
                            <ol class="breadcrumb blog-breadcrumb mb-0">
                                <li class="breadcrumb-item"><a href="/blog">Blog</a></li>
                                <li class="breadcrumb-item"><a href={url(post.category)}>{name(post.category)}</a></li>
                                <li class="breadcrumb-item active" aria-current="page">Article</li>
                            </ol>
                        </nav>

                        <div class="row justify-content-center">
                            <div class="col-xl-10">
                                <span class="badge blog-category-badge mb-3">{name(post.category)}</span>
                                <h1 class="blog-article-title">{post.title}</h1>
                                <div class="blog-article-meta mt-3">
                                    <strong>{post.author_name || siteName}</strong>
                                    <span class="blog-meta-dot"></span>
                                    <span>{long(post.published_at)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="container py-4 py-lg-5">
                    <div class="row justify-content-center">
                        <div class="col-xl-10">
                            {#if post.image?.trim()}
                                <div class="blog-article-hero mb-4 mb-lg-5">
                                    <img src={post.image} alt={post.title}>
                                </div>
                            {/if}

                            <div class="row g-4 g-lg-5">
                                <div class="col-lg-8">
                                    <div class="blog-article-body">
                                        {#each paragraphs(post.body) as p}
                                            <p style="white-space: pre-line">{p}</p>
                                        {/each}
                                    </div>

                                    <div class="blog-article-footer mt-5 pt-4 border-top">
                                        <a href="/blog" class="btn btn-outline-secondary">&larr; Back to all posts</a>
                                    </div>
                                </div>

                                <aside class="col-lg-4">
                                    <div class="card border-0 shadow-sm blog-sidebar-card sticky-lg-top">
                                        <div class="card-body p-4">
                                            <h2 class="h5 mb-3">More from the blog</h2>

                                            {#if more.length === 0}
                                                <p class="text-secondary small mb-0">No other posts yet.</p>
                                            {:else}
                                                <div class="blog-more-list">
                                                    {#each more as m (m.id)}
                                                        <a href="/blog?id={m.id}" class="blog-more-item">
                                                            <div class="blog-more-category">{name(m.category)}</div>
                                                            <div class="blog-more-title">{m.title}</div>
                                                            <div class="blog-more-date">{short(m.published_at)}</div>
                                                        </a>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        {/if}
    {:else}
        <div class="container py-4 py-lg-5">
            <div class="d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-3 mb-4">
                <div>
                    <p class="blog-eyebrow mb-1">{category ? "Browsing" : "Newsroom"}</p>
                    <h1 class="blog-page-title mb-1">{category ? categories[category] : `Latest from ${siteName}`}</h1>
                    <p class="blog-page-subtitle mb-0">
                        {category ? `Posts filed under ${categories[category]}.` : "Updates, announcements, community stories and development news."}
                    </p>
                </div>

                {#if category}
                    <a href="/blog" class="btn btn-outline-secondary">View all posts</a>
                {/if}
            </div>

            {#if !loaded}
            {:else if posts.length === 0}
                <div class="card border-0 shadow-sm blog-empty-card">
                    <div class="card-body text-center py-5 px-4">
                        <h2 class="h4 mb-2">Nothing here yet</h2>
                        <p class="text-secondary mb-0">There aren't any published posts in this section yet.</p>
                    </div>
                </div>
            {:else}
                {#if featured}
                    <section class="card border-0 shadow-sm blog-featured-card mb-4 mb-lg-5 overflow-hidden">
                        <div class="row g-0 align-items-stretch">
                            <div class="col-lg-7 blog-featured-media">
                                <a href="/blog?id={featured.id}" aria-label="Read {featured.title}">
                                    {#if featured.image?.trim()}
                                        <img src={featured.image} alt={featured.title}>
                                    {:else}
                                        {@render fallback(true)}
                                    {/if}
                                </a>
                            </div>

                            <div class="col-lg-5">
                                <div class="card-body blog-featured-copy h-100 d-flex flex-column justify-content-center">
                                    <div class="mb-3">
                                        {@render badge(featured.category)}
                                    </div>
                                    <h2 class="blog-featured-title">
                                        <a href="/blog?id={featured.id}">{featured.title}</a>
                                    </h2>
                                    <div class="blog-post-meta mb-3">
                                        {long(featured.published_at)} · {featured.author_name || siteName}
                                    </div>
                                    <p class="blog-featured-excerpt">{excerpt(featured, 260)}</p>
                                    <div class="mt-2">
                                        <a href="/blog?id={featured.id}" class="btn btn-primary px-4">Read post</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                {/if}

                {#if rest.length > 0}
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h2 class="h4 mb-0">{featured ? "More posts" : "Posts"}</h2>
                        <span class="text-secondary small">Page {page} of {totalPages}</span>
                    </div>

                    <section class="row g-4">
                        {#each rest as item (item.id)}
                            <div class="col-md-6 col-xl-4">
                                <article class="card h-100 border-0 shadow-sm blog-post-card">
                                    <a href="/blog?id={item.id}" class="blog-post-image-link">
                                        {#if item.image?.trim()}
                                            <img class="card-img-top blog-post-image" src={item.image} alt={item.title}>
                                        {:else}
                                            {@render fallback(false)}
                                        {/if}
                                    </a>

                                    <div class="card-body p-4 d-flex flex-column">
                                        <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                                            {@render badge(item.category)}
                                            <span class="blog-card-date">{short(item.published_at)}</span>
                                        </div>

                                        <h3 class="blog-card-title">
                                            <a href="/blog?id={item.id}">{item.title}</a>
                                        </h3>

                                        <p class="blog-card-excerpt">{excerpt(item, 155)}</p>

                                        <div class="mt-auto pt-2 d-flex align-items-center justify-content-between gap-3">
                                            <span class="blog-card-author">By {item.author_name || siteName}</span>
                                            <a href="/blog?id={item.id}" class="blog-read-more">Read more &rarr;</a>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        {/each}
                    </section>
                {/if}

                {#if totalPages > 1}
                    <nav class="mt-5" aria-label="Blog pages">
                        <ul class="pagination justify-content-center mb-0">
                            <li class="page-item" class:disabled={page <= 1}>
                                <a class="page-link" href={url(category, Math.max(1, page - 1))}>Previous</a>
                            </li>
                            {#each pages as i}
                                <li class="page-item" class:active={i === page}>
                                    <a class="page-link" href={url(category, i)}>{i}</a>
                                </li>
                            {/each}
                            <li class="page-item" class:disabled={page >= totalPages}>
                                <a class="page-link" href={url(category, Math.min(totalPages, page + 1))}>Next</a>
                            </li>
                        </ul>
                    </nav>
                {/if}
            {/if}
        </div>
    {/if}
</main>

<footer class="blog-footer border-top">
    <div class="container py-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div class="blog-footer-brand">{siteName} Blog</div>
        <div class="text-secondary small">News and updates from {siteName}.</div>
    </div>
</footer>
