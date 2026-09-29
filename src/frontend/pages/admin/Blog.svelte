<script lang="ts">
    import { untrack } from "svelte";
    import { api, apiForm } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";

    const categories: [string, string][] = [
        ["news", "News"],
        ["community", "Community"],
        ["development", "Development"],
        ["events", "Events"]
    ];

    const edit = $derived(Number(router.query.edit) || 0);

    const blank = () => ({
        id: 0,
        title: "",
        excerpt: "",
        body: "",
        category: "news",
        image: "",
        is_published: false
    });

    let data = $state<any>(null);
    let form = $state<any>(blank());
    let file = $state<File | null>(null);
    let fileInput = $state<HTMLInputElement>();
    let removeImage = $state(false);
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api("/admin/blog").then(d => data = d).catch(err => note("danger", err.message));
    load();

    $effect(() => {
        file = null;
        removeImage = false;
        untrack(() => {
            if (fileInput) fileInput.value = "";
        });
        if (!edit) {
            form = blank();
            return;
        }
        const p = rows(data).find(p => p.id === edit);
        if (!p) return;
        form = {
            id: p.id,
            title: p.title ?? "",
            excerpt: p.excerpt ?? "",
            body: p.body ?? "",
            category: p.category ?? "news",
            image: p.image ?? "",
            is_published: Number(p.is_published) === 1 || p.is_published === true
        };
    });

    const upload = (path: string, method: string, fd: FormData) => apiForm(path, fd, method);

    const save = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            const fd = new FormData();
            fd.append("title", form.title);
            fd.append("excerpt", form.excerpt);
            fd.append("body", form.body);
            fd.append("category", form.category);
            fd.append("is_published", String(form.is_published));
            if (file) fd.append("image", file);

            if (form.id > 0) {
                if (removeImage && form.image) await api(`/admin/blog/${form.id}/image`, undefined, "DELETE");
                await upload(`/admin/blog/${form.id}`, "PATCH", fd);
                note("success", "Blog post updated.");
                load();
            } else {
                const d = await upload("/admin/blog", "POST", fd);
                note("success", "Blog post created.");
                if (d?.id) router.go(`/admi/blog?edit=${d.id}`);
                else form = blank();
                load();
            }
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this blog post?")) return;
        try {
            await api(`/admin/blog/${id}`, undefined, "DELETE");
            note("success", "Blog post deleted.");
            if (edit === id) router.go("/admi/blog");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const published = (p: any) => Number(p.is_published) === 1 || p.is_published === true;
    const label = (key: string) => categories.find(c => c[0] === key)?.[1] ?? key.charAt(0).toUpperCase() + key.slice(1);
</script>

<Layout title="Manage Blog">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Blog</h1>
            <p>Create and publish posts for the public blog and homepage news box.</p>
        </div>
        <div class="d-flex gap-2">
            <a href="/blog" class="btn btn-outline-secondary btn-sm" target="_blank">View blog</a>
            {#if edit}<a href="/admi/blog" class="btn btn-primary btn-sm">New post</a>{/if}
        </div>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="row g-4">
        <div class="col-lg-5">
            <div class="card admin-form-card">
                <div class="card-header"><span class="admin-card-title">{form.id > 0 ? "Edit post" : "New post"}</span></div>
                <div class="card-body">
                    <form onsubmit={save}>
                        <div class="mb-3">
                            <label class="form-label" for="post-title">Title</label>
                            <input type="text" class="form-control" id="post-title" maxlength="180" required bind:value={form.title}>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="post-category">Category</label>
                            <select class="form-select" id="post-category" bind:value={form.category}>
                                {#each categories as [value, text]}
                                    <option {value}>{text}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="post-excerpt">Short excerpt</label>
                            <textarea class="form-control" id="post-excerpt" rows="3" maxlength="320" bind:value={form.excerpt}></textarea>
                            <div class="form-text">Optional. If blank, the start of the post is used.</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="post-body">Post body</label>
                            <textarea class="form-control" id="post-body" rows="12" required bind:value={form.body}></textarea>
                            <div class="form-text">Plain text. Blank lines create new paragraphs.</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="post-image">Feature image</label>
                            <input type="file" class="form-control" id="post-image" accept="image/png,image/jpeg,image/webp" bind:this={fileInput} onchange={e => file = e.currentTarget.files?.[0] ?? null}>
                            {#if form.image}
                                <div class="mt-2"><img src={form.image} alt="" style="max-width:180px;max-height:110px;object-fit:cover;border:1px solid #ddd"></div>
                                <div class="form-check mt-2">
                                    <input class="form-check-input" type="checkbox" id="removeImage" bind:checked={removeImage}>
                                    <label class="form-check-label" for="removeImage">Remove current image</label>
                                </div>
                            {/if}
                        </div>

                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="published" bind:checked={form.is_published}>
                            <label class="form-check-label" for="published">Published</label>
                        </div>

                        <button class="btn btn-primary" type="submit" disabled={busy}>{form.id > 0 ? "Save changes" : "Create post"}</button>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-lg-7">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span class="admin-card-title">Posts</span>
                    <span class="admin-muted">{num(rows(data).length)} total</span>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover mb-0 admin-table">
                        <thead class="table-light">
                            <tr>
                                <th>Post</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each rows(data) as p (p.id)}
                                <tr>
                                    <td>
                                        <div class="fw-semibold">{p.title}</div>
                                        <div class="admin-muted">{p.author_name || "Unknown"} &middot; {adminDate(p.published_at || p.created_at)}</div>
                                    </td>
                                    <td>{label(p.category ?? "")}</td>
                                    <td>
                                        {#if published(p)}
                                            <span class="badge text-bg-success">Published</span>
                                        {:else}
                                            <span class="badge text-bg-secondary">Draft</span>
                                        {/if}
                                    </td>
                                    <td class="text-end admin-actions">
                                        {#if published(p)}<a class="btn btn-sm btn-outline-secondary" href="/blog?id={p.id}" target="_blank">View</a>{/if}
                                        <a class="btn btn-sm btn-outline-primary" href="/admi/blog?edit={p.id}">Edit</a>
                                        <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(p.id)}>Delete</button>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="4" class="text-center text-muted py-4">No blog posts yet.</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</Layout>
