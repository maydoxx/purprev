<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const me = session.me!;
    const tabs = ["inbox", "sent", "news", "archive"];
    const empties: Record<string, string> = {
        inbox: "You don't have any messages.",
        sent: "You haven't sent any messages.",
        news: "You don't have any news messages.",
        archive: "Your archive is empty."
    };

    const tab = $derived(tabs.includes(router.query.tab!) ? router.query.tab! : "inbox");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const compose = $derived("compose" in router.query);
    const detailId = $derived(compose ? 0 : Number(router.query.id) || 0);
    const justSent = $derived("sent" in router.query);

    let error = $state("");
    let busy = $state(false);

    let data = $state<any>(null);
    let selected = $state<number[]>([]);

    let detail = $state<any>(null);
    let detailMissing = $state(false);

    let to = $state("");
    let subject = $state("");
    let body = $state("");

    const showList = $derived(!compose && (detailId === 0 || detailMissing));
    const ids = $derived(data ? data.messages.map((m: any) => m.id) : []);
    const allChecked = $derived(ids.length > 0 && ids.every((id: number) => selected.includes(id)));

    const load = async () => {
        data = null;
        selected = [];
        try {
            const d = await api(`/messages?tab=${tab}&page=${page}`);
            data = Array.isArray(d.messages) ? d : {
                messages: [],
                totalPages: 1,
                newsUnread: 0
            };
        } catch (err: any) {
            error = err.message;
        }
    };

    $effect(() => {
        if (!showList) return;
        tab;
        page;
        load();
    });

    $effect(() => {
        if (detailId === 0) return;
        detail = null;
        detailMissing = false;
        api(`/messages/${detailId}`).then(d => {
            detail = d.id ? d : null;
            detailMissing = !detail;
        }).catch(() => {
            detailMissing = true;
        });
    });

    $effect(() => {
        if (!compose) return;
        error = "";
        to = "";
        subject = "";
        body = "";
        const toId = Number(router.query.to) || 0;
        const replyId = Number(router.query.reply) || 0;
        if (toId > 0) {
            api(`/user/profile/${toId}`).then(u => {
                if (u.username) to = u.username;
            }).catch(() => {});
        }
        if (replyId > 0) {
            api(`/messages/${replyId}`).then(m => {
                if (!m.id || m.recipient_id !== me.id || !(m.sender_id > 0)) return;
                to = m.sender_username;
                subject = /^re:/i.test(m.subject) ? m.subject : "Re: " + m.subject;
            }).catch(() => {});
        }
    });

    const send = async (e: Event) => {
        e.preventDefault();
        busy = true;
        error = "";
        try {
            await api("/messages", {
                to: to.trim(),
                subject,
                body
            });
            router.go("/my/messages?tab=sent&sent=1");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const bulk = async (action: string, messageIds: number[]) => {
        if (messageIds.length === 0) return;
        busy = true;
        error = "";
        try {
            await api("/messages/bulk", {
                action,
                message_ids: messageIds
            });
            if (detailId > 0) router.go(tabUrl(tab));
            else await load();
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const selectAll = (on: boolean) => {
        selected = on ? [...ids] : [];
    };

    const tabUrl = (t: string) => `/my/messages?tab=${t}`;
    const pageUrl = (p: number) => `/my/messages?tab=${tab}&page=${Math.max(1, p)}`;
    const when = (t: number) => {
        const d = new Date(t * 1000);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        }) + " | " + d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        });
    };
    const preview = (text: string, limit = 90) => {
        const s = String(text ?? "").replace(/\s+/g, " ").trim();
        return s.length <= limit ? s : s.slice(0, limit - 1) + "…";
    };
    const pic = (id: number) => id > 0 ? `/api/user/getProfilePicture?userId=${id}&type=headshot` : "/img/noneRevSmall.png";
    const fallback = (e: Event) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = "/img/pending.png";
    };
</script>

<svelte:head>
    <title>Messages - NoneRev</title>
    <link rel="stylesheet" href="/css/messages.css">
</svelte:head>

{#snippet pager()}
    {@const first = page <= 1}
    {@const last = !data || page >= data.totalPages}
    <div class="messages-pager">
        <a class="pager-btn first" class:disabled={first} href={first ? "#" : pageUrl(1)} aria-label="First page">|‹</a>
        <a class="pager-btn" class:disabled={first} href={first ? "#" : pageUrl(page - 1)} aria-label="Previous page">‹</a>
        <span>{page.toLocaleString()} of {(data?.totalPages ?? 1).toLocaleString()}</span>
        <a class="pager-btn" class:disabled={last} href={last ? "#" : pageUrl(page + 1)} aria-label="Next page">›</a>
        <a class="pager-btn last" class:disabled={last} href={last ? "#" : pageUrl(data?.totalPages ?? 1)} aria-label="Last page">›|</a>
    </div>
{/snippet}

{#snippet toolbar(cls: string)}
    <div class="messages-toolbar {cls}">
        {#if tab === "sent"}
            <span class="messages-sent-label">Sent Messages</span>
        {:else}
            <label class="messages-select-all"><input type="checkbox" checked={allChecked} onchange={e => selectAll(e.currentTarget.checked)}> <span>All</span></label>
            {#if tab === "archive"}
                <button type="button" disabled={busy} onclick={() => bulk("restore", selected)}>Restore</button>
            {:else}
                <button type="button" disabled={busy} onclick={() => bulk("archive", selected)}>Archive</button>
            {/if}
            <button type="button" disabled={busy} onclick={() => bulk("read", selected)}>Mark As Read</button>
            <button type="button" disabled={busy} onclick={() => bulk("unread", selected)}>Mark As Unread</button>
        {/if}
        {@render pager()}
    </div>
{/snippet}

<main class="rbx-content messages-2016">
    <div class="messages-shell">
        <div class="messages-title-row">
            <h1>Messages</h1>
            <a class="messages-compose-btn" href="/my/messages?compose=1">New Message</a>
        </div>

        {#if error}
            <div class="messages-alert error">{error}</div>
        {:else if justSent}
            <div class="messages-alert success">Your message was sent.</div>
        {/if}

        {#if compose}
            <section class="messages-compose-panel">
                <div class="messages-panel-heading">
                    <h2>New Message</h2>
                    <a href="/my/messages">Back to Messages</a>
                </div>
                <form class="messages-compose-form" onsubmit={send}>
                    <div class="messages-field">
                        <label for="message-to">To</label>
                        <input id="message-to" type="text" bind:value={to} maxlength="32" placeholder="Username" required>
                    </div>
                    <div class="messages-field">
                        <label for="message-subject">Subject</label>
                        <input id="message-subject" type="text" bind:value={subject} maxlength="120" required>
                    </div>
                    <div class="messages-field">
                        <label for="message-body">Message</label>
                        <textarea id="message-body" bind:value={body} maxlength="5000" rows="10" required></textarea>
                    </div>
                    <div class="messages-form-actions">
                        <button type="submit" class="messages-primary-btn" disabled={busy}>Send</button>
                        <a href="/my/messages" class="messages-control-btn">Cancel</a>
                    </div>
                </form>
            </section>
        {:else if detail}
            {@const received = detail.recipient_id === me.id}
            {@const otherId = received ? detail.sender_id : detail.recipient_id}
            {@const otherName = (received ? detail.sender_username : detail.recipient_username) || "Unknown"}
            <section class="messages-detail-panel">
                <div class="messages-panel-heading detail-heading">
                    <a class="messages-back-link" href={tabUrl(tab)}>‹ Back</a>
                    <div class="detail-actions">
                        {#if received && detail.sender_id > 0 && detail.message_type === "message"}
                            <a class="messages-primary-btn" href="/my/messages?compose=1&reply={detail.id}">Reply</a>
                        {/if}
                        {#if received}
                            {#if detail.recipient_archived}
                                <button class="messages-control-btn" type="button" disabled={busy} onclick={() => bulk("restore", [detail.id])}>Restore</button>
                            {:else}
                                <button class="messages-control-btn" type="button" disabled={busy} onclick={() => bulk("archive", [detail.id])}>Archive</button>
                            {/if}
                        {/if}
                    </div>
                </div>
                <div class="message-detail-head">
                    <img src={pic(otherId)} alt="" onerror={fallback}>
                    <div>
                        <h2>{detail.subject}</h2>
                        <div class="message-detail-meta">
                            {received ? "From" : "To"}
                            {#if otherId > 0}
                                <a href="/user?id={otherId}">{otherName}</a>
                            {:else}
                                <span>{otherName}</span>
                            {/if}
                            <span class="meta-dot">•</span>
                            {when(detail.created_at)}
                        </div>
                    </div>
                </div>
                <div class="message-detail-body" style="white-space: pre-line">{detail.body}</div>
            </section>
        {:else if showList}
            <nav class="messages-tabs" aria-label="Message folders">
                <a href={tabUrl("inbox")} class:active={tab === "inbox"}>Inbox</a>
                <a href={tabUrl("sent")} class:active={tab === "sent"}>Sent</a>
                <a href={tabUrl("news")} class:active={tab === "news"}>News{#if data && data.newsUnread > 0}<span class="messages-news-badge">{Math.min(99, data.newsUnread)}</span>{/if}</a>
                <a href={tabUrl("archive")} class:active={tab === "archive"}>Archive</a>
            </nav>

            <div class="messages-folder-heading">
                <h2>{tab === "inbox" ? "Inbox" : tab === "sent" ? "Sent Messages" : tab === "news" ? "News" : "Archive"} <span>({data?.total ?? 0})</span></h2>
            </div>

            {@render toolbar(tab === "sent" ? "top-toolbar sent-toolbar" : "top-toolbar")}

            <section class="messages-list">
                {#if !data}
                    <div class="messages-empty">Loading...</div>
                {:else if data.messages.length === 0}
                    <div class="messages-empty">{empties[tab]}</div>
                {:else}
                    {#each data.messages as message (message.id)}
                        <article class="message-row" class:unread={tab !== "sent" && !message.is_read}>
                            {#if tab !== "sent"}
                                <div class="message-check"><input type="checkbox" bind:group={selected} value={message.id} aria-label="Select message"></div>
                            {/if}
                            <a class="message-avatar" href={message.other_id ? `/user?id=${message.other_id}` : "#"}>
                                <img src={pic(message.other_id)} alt="" onerror={fallback}>
                            </a>
                            <a class="message-main" href="/my/messages?tab={tab}&id={message.id}">
                                <div class="message-line-one">
                                    <span class="message-user">{message.other_username}</span>
                                    <time>{when(message.created_at)}</time>
                                </div>
                                <div class="message-line-two">
                                    <span class="message-subject">{message.subject}</span>
                                    <span class="message-preview"> - {preview(message.body)}</span>
                                </div>
                            </a>
                        </article>
                    {/each}
                {/if}
            </section>

            {#if tab !== "sent"}
                {@render toolbar("bottom-toolbar")}
            {/if}
        {/if}
    </div>
</main>
