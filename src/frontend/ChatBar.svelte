<script lang="ts">
    import { onMount } from "svelte";
    import { api } from "./api";

    type Person = {
        id: number;
        username: string;
        online: boolean;
    };
    type Message = {
        id: number;
        from: number;
        mine: boolean;
        body: string;
        at: number;
    };
    type Window = {
        person: Person;
        messages: Message[];
        draft: string;
        open: boolean;
        error: string;
    };

    let listOpen = $state(false);
    let unread = $state(0);
    let conversations = $state<any[]>([]);
    let friends = $state<Person[]>([]);
    let windows = $state<Window[]>([]);

    const headshot = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const time = (at: number) => new Date(at * 1000).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });

    const refresh = async () => {
        try {
            const d = await api("/user/chat");
            unread = d.unread;
            conversations = d.conversations;
            friends = d.friends;
        } catch {
            return;
        }
    };

    const pull = async (w: Window) => {
        const after = w.messages.length ? w.messages[w.messages.length - 1]!.id : 0;
        try {
            const list: Message[] = await api(`/user/chat/${w.person.id}?after=${after}`);
            if (list.length > 0) {
                w.messages = [...w.messages, ...list];
                scrollDown(w);
            }
        } catch {
            return;
        }
    };

    const scrollDown = (w: Window) => {
        requestAnimationFrame(() => {
            const box = document.getElementById(`chat-log-${w.person.id}`);
            if (box) {
                box.scrollTop = box.scrollHeight;
            }
        });
    };

    const open = (person: Person) => {
        const existing = windows.find(w => w.person.id === person.id);
        if (existing) {
            existing.open = true;
            scrollDown(existing);
            return;
        }
        const w: Window = {
            person,
            messages: [],
            draft: "",
            open: true,
            error: ""
        };
        windows = [...windows.slice(-3), w];
        pull(w).then(() => refresh());
    };

    const close = (w: Window) => {
        windows = windows.filter(x => x !== w);
    };

    const send = async (w: Window) => {
        const body = w.draft.trim();
        if (!body) {
            return;
        }
        w.draft = "";
        w.error = "";
        try {
            const m: Message = await api(`/user/chat/${w.person.id}`, {
                body
            });
            w.messages = [...w.messages, m];
            scrollDown(w);
        } catch (err: any) {
            w.error = err.message;
        }
    };

    const unreadFor = (id: number) => conversations.find(c => c.id === id)?.unread ?? 0;

    onMount(() => {
        refresh();
        const slow = setInterval(refresh, 10000);
        const fast = setInterval(() => {
            for (const w of windows) {
                if (w.open) {
                    pull(w);
                }
            }
        }, 3000);
        return () => {
            clearInterval(slow);
            clearInterval(fast);
        };
    });

    const people = $derived([
        ...friends.filter(f => f.online),
        ...friends.filter(f => !f.online)
    ]);
</script>

<div class="chat-bar">
    {#each windows as w (w.person.id)}
        <div class="chat-window" class:closed={!w.open}>
            <div class="chat-tab" role="button" tabindex="0" onclick={() => w.open = !w.open} onkeydown={e => e.key === "Enter" && (w.open = !w.open)}>
                <span class="chat-tab-name">{w.person.username}</span>
                {#if !w.open && unreadFor(w.person.id) > 0}
                    <span class="chat-badge">{unreadFor(w.person.id)}</span>
                {/if}
                <button type="button" class="chat-tab-close" aria-label="Close" onclick={e => { e.stopPropagation(); close(w); }}>&times;</button>
            </div>
            {#if w.open}
                <div class="chat-log" id="chat-log-{w.person.id}">
                    {#each w.messages as m (m.id)}
                        <div class="chat-line" class:mine={m.mine}>
                            <span class="chat-who">{m.mine ? "You" : w.person.username}</span>
                            <span class="chat-text">{m.body}</span>
                            <span class="chat-when">{time(m.at)}</span>
                        </div>
                    {:else}
                        <div class="chat-empty">Say hi to {w.person.username}.</div>
                    {/each}
                </div>
                {#if w.error}
                    <div class="chat-error">{w.error}</div>
                {/if}
                <form class="chat-compose" onsubmit={e => { e.preventDefault(); send(w); }}>
                    <input type="text" maxlength="500" placeholder="Send a message" bind:value={w.draft} autocomplete="off">
                </form>
            {/if}
        </div>
    {/each}

    <div class="chat-window chat-list" class:closed={!listOpen}>
        <div class="chat-tab" role="button" tabindex="0" onclick={() => listOpen = !listOpen} onkeydown={e => e.key === "Enter" && (listOpen = !listOpen)}>
            <span class="chat-tab-name">Chat &amp; Party</span>
            {#if unread > 0}
                <span class="chat-badge">{unread}</span>
            {/if}
        </div>
        {#if listOpen}
            <div class="chat-people">
                {#if conversations.length > 0}
                    <div class="chat-people-title">Recent</div>
                    {#each conversations as c (c.id)}
                        <button type="button" class="chat-person" onclick={() => open(c)}>
                            <img src={headshot(c.id)} alt="">
                            <span class="chat-person-name">{c.username}</span>
                            {#if c.unread > 0}
                                <span class="chat-badge">{c.unread}</span>
                            {:else}
                                <span class="chat-person-dot" class:online={c.online}></span>
                            {/if}
                        </button>
                    {/each}
                {/if}
                <div class="chat-people-title">Friends</div>
                {#each people as f (f.id)}
                    <button type="button" class="chat-person" onclick={() => open(f)}>
                        <img src={headshot(f.id)} alt="">
                        <span class="chat-person-name">{f.username}</span>
                        <span class="chat-person-dot" class:online={f.online}></span>
                    </button>
                {:else}
                    <div class="chat-empty">Add some friends to chat with them here.</div>
                {/each}
            </div>
        {/if}
    </div>
</div>
