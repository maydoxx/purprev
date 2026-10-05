<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const me = session.me!;
    const tabs = ["inbox", "sent", "news", "archive"];
    const labels: Record<string, string> = {
        inbox: "Inbox",
        sent: "Sent",
        news: "News",
        archive: "Archive"
    };
    const empties: Record<string, string> = {
        inbox: "You have no inbox messages.",
        sent: "You have no sent messages.",
        news: "You have no news messages.",
        archive: "You have no archive messages."
    };
    const warning = "Remember, NoneRev staff will never ask you for your password. People who ask for your password are trying to steal your account.";

    const tab = $derived(tabs.includes(router.query.tab!) ? router.query.tab! : "inbox");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const compose = $derived("compose" in router.query);
    const detailId = $derived(compose ? 0 : Number(router.query.id) || 0);
    const justSent = $derived("sent" in router.query);

    let error = $state("");
    let busy = $state(false);

    let data = $state<any>(null);
    let newsUnread = $state(0);
    let selected = $state<number[]>([]);

    let detail = $state<any>(null);
    let detailMissing = $state(false);
    let replying = $state(false);
    let reply = $state("");
    let includePrevious = $state(true);

    let to = $state("");
    let subject = $state("");
    let body = $state("");

    const showList = $derived(!compose && (detailId === 0 || detailMissing));
    const selectable = $derived(tab === "inbox" || tab === "archive");
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
            newsUnread = data.newsUnread ?? 0;
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
        replying = false;
        reply = "";
        includePrevious = true;
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
                subject = reSubject(m.subject);
            }).catch(() => {});
        }
    });

    const post = async (recipient: string, title: string, text: string) => {
        busy = true;
        error = "";
        try {
            await api("/messages", {
                to: recipient,
                subject: title,
                body: text
            });
            router.go("/my/messages?tab=sent&sent=1");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const send = (e: Event) => {
        e.preventDefault();
        post(to.trim(), subject, body);
    };

    const sendReply = () => {
        let text = reply;
        if (includePrevious) {
            const d = new Date(detail.created_at * 1000);
            const stamp = d.toLocaleDateString("en-US") + " at " + d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit"
            });
            text += `\n\n\n------------------------------\nOn ${stamp}, ${detail.sender_username} wrote:\n${detail.body}`;
        }
        post(detail.sender_username, reSubject(detail.subject), text.slice(0, 5000));
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

    const reSubject = (s: string) => (/^re:/i.test(s) ? s : "Re: " + s).slice(0, 120);
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
    const preview = (text: string, limit = 200) => {
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
    {#if data && data.totalPages > 1}
        {@const first = page <= 1}
        {@const last = page >= data.totalPages}
        <div class="messages-pager">
            <a class="messages-pager-btn" class:disabled={first} href={first ? null : pageUrl(1)} aria-label="First page"><span class="messages-icon first"></span></a>
            <a class="messages-pager-btn" class:disabled={first} href={first ? null : pageUrl(page - 1)} aria-label="Previous page"><span class="messages-icon prev"></span></a>
            <span class="messages-pager-text">{page.toLocaleString()} of {data.totalPages.toLocaleString()}</span>
            <a class="messages-pager-btn" class:disabled={last} href={last ? null : pageUrl(page + 1)} aria-label="Next page"><span class="messages-icon next"></span></a>
            <a class="messages-pager-btn" class:disabled={last} href={last ? null : pageUrl(data.totalPages)} aria-label="Last page"><span class="messages-icon last"></span></a>
        </div>
    {/if}
{/snippet}

{#snippet toolbar(where: string)}
    <div class="messages-toolbar {where}">
        {#if selectable}
            <div class="messages-actions">
                <div class="messages-check messages-check-all">
                    <input type="checkbox" id="messages-all-{where}" checked={allChecked} onchange={e => selectAll(e.currentTarget.checked)}>
                    <label for="messages-all-{where}">All</label>
                </div>
                {#if tab === "archive"}
                    <button type="button" class="messages-btn" disabled={busy} onclick={() => bulk("restore", selected)}>Move to Inbox</button>
                {:else}
                    <button type="button" class="messages-btn" disabled={busy} onclick={() => bulk("archive", selected)}>Archive</button>
                {/if}
                <button type="button" class="messages-btn" disabled={busy} onclick={() => bulk("read", selected)}>Mark As Read</button>
                <button type="button" class="messages-btn" disabled={busy} onclick={() => bulk("unread", selected)}>Mark As Unread</button>
            </div>
        {/if}
        {@render pager()}
    </div>
{/snippet}

<main class="rbx-content messages-page">
    <div class="messages-container">
        {#if compose}
            <h1>New Message</h1>

            {#if error}
                <div class="messages-alert error">{error}</div>
            {/if}

            <form class="messages-new" onsubmit={send}>
                <div class="messages-new-back">
                    <a class="messages-icon-btn md" href="/my/messages" aria-label="Back"><span class="messages-icon prev"></span></a>
                    <span>Back</span>
                </div>
                <div class="messages-new-field">
                    <label class="messages-label" for="message-to">To:</label>
                    <div class="messages-new-input"><input id="message-to" type="text" bind:value={to} maxlength="32" placeholder="Username" required></div>
                </div>
                <div class="messages-new-field">
                    <label class="messages-label" for="message-subject">Subject:</label>
                    <div class="messages-new-input"><input id="message-subject" type="text" bind:value={subject} maxlength="120" required></div>
                </div>
                <textarea class="messages-reply-box" bind:value={body} maxlength="5000" placeholder="Write your message..." aria-label="Message" required></textarea>
                <div class="messages-new-footer">
                    <span class="messages-warning">{warning}</span>
                    <div class="messages-new-actions">
                        <a class="messages-link" href="/my/messages">Discard</a>
                        <button type="submit" class="messages-send" disabled={busy}>Send</button>
                    </div>
                </div>
            </form>
        {:else}
            <div class="messages-title">
                <h1>Messages</h1>
                <a class="messages-btn-secondary messages-compose-btn" href="/my/messages?compose=1">New Message</a>
            </div>

            <ul class="messages-tabs">
                {#each tabs as t (t)}
                    <li class="messages-tab" class:active={tab === t}>
                        <a class="messages-tab-heading" href={tabUrl(t)}><span class="messages-tab-label">{labels[t]}</span>{#if t === "news" && newsUnread > 0}<span class="messages-tab-count">{Math.min(99, newsUnread)}</span>{/if}</a>
                    </li>
                {/each}
            </ul>

            {#if error}
                <div class="messages-alert error">{error}</div>
            {:else if justSent}
                <div class="messages-alert success">Your message was sent.</div>
            {/if}

            {#if detail && !showList}
                {@const received = detail.recipient_id === me.id}
                {@const otherId = received ? detail.sender_id : detail.recipient_id}
                {@const otherName = (received ? detail.sender_username : detail.recipient_username) || "Unknown"}
                {@const canReply = received && detail.sender_id > 0 && detail.message_type === "message"}
                <div class="messages-toolbar detail">
                    <a class="messages-icon-btn" href={tabUrl(tab)} aria-label="Back"><span class="messages-icon prev"></span></a>
                    {#if canReply}
                        <button type="button" class="messages-btn-secondary" disabled={replying} onclick={() => replying = true}>Reply</button>
                    {/if}
                    {#if received}
                        {#if detail.recipient_archived}
                            <button type="button" class="messages-btn" disabled={busy} onclick={() => bulk("restore", [detail.id])}>Move to Inbox</button>
                        {:else}
                            <button type="button" class="messages-btn" disabled={busy} onclick={() => bulk("archive", [detail.id])}>Archive</button>
                        {/if}
                    {/if}
                </div>

                <div class="messages-detail">
                    <div class="messages-detail-head">
                        <h3>{detail.subject}</h3>
                        <a class="messages-avatar" class:system={!(otherId > 0)} href={otherId > 0 ? `/user?id=${otherId}` : null}>
                            <img src={pic(otherId)} alt="" onerror={fallback}>
                        </a>
                        <div class="messages-detail-from">
                            {#if !received}
                                <span class="messages-label">To:</span>
                            {/if}
                            {#if otherId > 0}
                                <a class="messages-name" href="/user?id={otherId}">{otherName}</a>
                            {:else}
                                <span class="messages-name">{otherName}</span>
                            {/if}
                            <span class="messages-date">{when(detail.created_at)}</span>
                        </div>
                    </div>
                    <div class="messages-detail-body">{detail.body}</div>
                    {#if canReply}
                        <a class="messages-report" href="/abusereport?type=user&id={detail.sender_id}">Report Abuse</a>
                    {/if}

                    {#if replying}
                        <div class="messages-reply">
                            <textarea class="messages-reply-box" bind:value={reply} maxlength="5000" aria-label="Reply"></textarea>
                            <div class="messages-reply-footer">
                                <span class="messages-warning">{warning}</span>
                                <div class="messages-check messages-include">
                                    <input type="checkbox" id="messages-include" bind:checked={includePrevious}>
                                    <label for="messages-include">Include Previous Message</label>
                                </div>
                                <button type="button" class="messages-btn-primary" disabled={busy} onclick={sendReply}>Send Reply</button>
                            </div>
                        </div>
                    {/if}
                </div>
            {:else if showList && data}
                {#if data.messages.length === 0}
                    <div class="messages-empty">{empties[tab]}</div>
                {:else}
                    {@render toolbar("top")}

                    <div class="messages-list">
                        {#each data.messages as message (message.id)}
                            <div class="messages-row" class:unread={tab !== "sent" && !message.is_read} class:no-check={!selectable}>
                                {#if selectable}
                                    <div class="messages-check">
                                        <input type="checkbox" id="messages-check-{message.id}" bind:group={selected} value={message.id} aria-label="Select message">
                                        <label for="messages-check-{message.id}"></label>
                                    </div>
                                {/if}
                                <a class="messages-avatar" class:system={!message.other_id} href={message.other_id ? `/user?id=${message.other_id}` : null}>
                                    <img src={pic(message.other_id)} alt="" onerror={fallback}>
                                </a>
                                <a class="messages-summary" href="/my/messages?tab={tab}&id={message.id}">
                                    <span class="messages-summary-name">{message.other_username}</span>
                                    <span class="messages-summary-date">{when(message.created_at)}</span>
                                    <span class="messages-summary-content"><span class="messages-subject">{message.subject}</span> <span class="messages-preview">{preview(message.body)}</span></span>
                                </a>
                            </div>
                        {/each}
                    </div>

                    {@render toolbar("bottom")}
                {/if}
            {/if}
        {/if}
    </div>
</main>
