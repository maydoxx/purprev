<script module lang="ts">
    const linkPattern = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;

    const sameSite = (host: string) => host.replace(/^www\./, "") === location.hostname.replace(/^www\./, "");

    export const linkify = (text: string) => {
        const parts: { text: string; href?: string }[] = [];
        let last = 0;

        for (const match of text.matchAll(linkPattern)) {
            const raw = match[0].replace(/[.,!?)]+$/, "");
            const start = match.index ?? 0;
            let target: URL;
            try {
                target = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw);
            } catch {
                continue;
            }
            if (!sameSite(target.hostname)) {
                continue;
            }
            parts.push({
                text: text.slice(last, start)
            });
            parts.push({
                text: raw,
                href: target.pathname + target.search + target.hash
            });
            last = start + raw.length;
        }

        parts.push({
            text: text.slice(last)
        });
        return parts;
    };
</script>

<script lang="ts">
    import type { Snippet } from "svelte";
    import UserAd from "../../UserAd.svelte";
    import { api, apiForm } from "../../api";
    import { session } from "../../session.svelte";
    import { router } from "../../router.svelte";

    let {
        my = false,
        gid = 0,
        side,
        onchange
    }: {
        my?: boolean;
        gid?: number;
        side?: Snippet;
        onchange?: () => void;
    } = $props();

    const OWNER_RANK = 255;
    const SHORT_DESCRIPTION = 247;

    const tabs: Record<string, string> = {
        games: "Games",
        members: "Members",
        affiliates: "Allies",
        store: "Store"
    };

    const id = $derived(my ? gid : Math.max(0, Number(router.query.id) || 0));
    const memberPage = $derived(Math.max(1, Number(router.query.member_page) || 1));
    const wallPage = $derived(Math.max(1, Number(router.query.wall_page) || 1));

    let group = $state<any>(null);
    let notFound = $state(false);
    let roles = $state<any[]>([]);
    let members = $state<any[]>([]);
    let memberPages = $state(1);
    let memberPageInput = $state("1");
    let roleCount = $state<number | null>(null);
    let wall = $state<any[]>([]);
    let wallPages = $state(1);
    let wallPageInput = $state("1");
    let games = $state<any[]>([]);
    let allies = $state<any>({
        accepted: [],
        incoming: [],
        outgoing: []
    });
    let store = $state<any[]>([]);
    let linksLoaded = $state(false);
    let targetId = $state(0);
    let manage = $state<any[]>([]);
    let requests = $state<any[]>([]);
    let search = $state("");
    let expanded = $state(false);

    let error = $state("");
    let success = $state("");
    let busy = $state(false);

    let shout = $state("");
    let post = $state("");
    let settingsForm = $state({
        description: "",
        approval_required: false,
        wall_enabled: true,
        bc_only: false
    });
    let iconFile = $state<FileList | null>(null);
    let newRole = $state({
        role_name: "",
        rank: 2,
        can_post_wall: false,
        can_shout: false,
        can_delete_wall: false,
        can_manage_members: false
    });

    const me = $derived(session.me?.id ?? 0);
    const isOwner = $derived(!!group && me > 0 && group.owner_id === me);
    const isMember = $derived(!!group && me > 0 && (isOwner || !!group.is_member));
    const joinPending = $derived(!!group && !isMember && !!group.join_pending);
    const viewerRank = $derived(group?.viewer_rank ?? 0);
    const can = (p: string) => !!group && me > 0 && (isOwner || !!group[`can_${p}`]);
    const memberCount = $derived(Number(group?.member_count ?? 0));

    const visibleTabs = $derived(Object.keys(tabs).filter(key => {
        if (key === "games") {
            return games.length > 0 || isOwner;
        }
        if (key === "affiliates") {
            return allies.accepted.length > 0 || isOwner;
        }
        return true;
    }));
    const defaultTab = $derived(games.length > 0 ? "games" : "members");
    const tab = $derived(visibleTabs.includes(router.query.tab ?? "") ? router.query.tab! : defaultTab);

    const roleOptionsAsc = $derived([...roles].sort((a, b) => a.rank - b.rank));
    const memberRole = $derived(router.query.role ?? roleOptionsAsc[0]?.name ?? "");

    const settings = $derived(!!group && (isOwner || can("manage_members")) && "settings" in router.query);
    const settingsTabs = $derived<Record<string, string>>(isOwner ? {
        general: "General",
        roles: "Roles",
        members: "Members",
        requests: "Join Requests"
    } : {
        members: "Members",
        requests: "Join Requests"
    });
    const settingsTab = $derived(settingsTabs[router.query.settings_tab ?? ""] ? router.query.settings_tab! : Object.keys(settingsTabs)[0]);

    const description = $derived((group?.description ?? "").trim());
    const shortened = $derived(my && !expanded && description.length > SHORT_DESCRIPTION);
    const shoutText = $derived((group?.shout ?? "").trim());
    const shownStore = $derived(isOwner ? store : store.slice(0, 3));

    const list = (d: any) => Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : [];

    const url = (extra: Record<string, string | number> = {}, t = tab) => {
        const p = new URLSearchParams(my ? {
            gid: String(id)
        } : {
            id: String(id)
        });
        if (t !== defaultTab) {
            p.set("tab", t);
        }
        for (const [k, v] of Object.entries(extra)) {
            if (v !== "") {
                p.set(k, String(v));
            }
        }
        return (my ? "/my/groups?" : "/groups?") + p;
    };

    const load = async () => {
        try {
            const d = await api(`/groups/${id}`);
            group = d?.id ? d : null;
        } catch {
            group = null;
        }
        notFound = !group;
        if (!group) {
            return;
        }

        shout = "";
        settingsForm = {
            description: group.description ?? "",
            approval_required: !!group.approval_required,
            wall_enabled: !!group.wall_enabled,
            bc_only: !!group.bc_only
        };
        roles = list(await api(`/groups/${id}/roles`).catch(() => []));
    };

    const loadMembers = async () => {
        const d = await api(`/groups/${id}/members?page=${memberPage}${memberRole !== "" ? `&role=${encodeURIComponent(memberRole)}` : ""}`).catch(() => null);
        members = list(d);
        memberPages = Math.max(1, d?.pages ?? 1);
        memberPageInput = String(memberPage);
        roleCount = typeof d?.total === "number" ? d.total : memberPages === 1 ? members.length : null;
    };

    const loadWall = async () => {
        const d = await api(`/groups/${id}/wall?page=${wallPage}`).catch(() => null);
        wall = list(d);
        wallPages = Math.max(1, d?.pages ?? 1);
        wallPageInput = String(wallPage);
    };

    const loadLinks = async () => {
        const currentId = id;
        const [g, a, s] = await Promise.all([
            api(`/groups/${currentId}/games`).catch(() => []),
            api(`/groups/${currentId}/affiliates`).catch(() => null),
            api(`/groups/${currentId}/store`).catch(() => [])
        ]);
        if (id !== currentId) {
            return;
        }
        games = list(g);
        allies = {
            accepted: a?.accepted ?? [],
            incoming: a?.incoming ?? [],
            outgoing: a?.outgoing ?? []
        };
        store = list(s);
        linksLoaded = true;
    };

    const loadSettings = async () => {
        const [m, r] = await Promise.all([
            api(`/groups/${id}/members?page=1`).catch(() => []),
            api(`/groups/${id}/requests`).catch(() => [])
        ]);
        manage = list(m).map((x: any) => ({
            ...x,
            role_id: x.role_id ?? roles.find(role => role.rank === x.rank)?.id
        }));
        requests = list(r);
    };

    $effect(() => {
        id;
        group = null;
        notFound = false;
        linksLoaded = false;
        expanded = false;
        error = "";
        success = "";
        if (id > 0) {
            load();
            loadLinks();
        } else {
            notFound = !my;
        }
    });

    $effect(() => {
        id;
        memberRole;
        memberPage;
        if (id > 0) {
            loadMembers();
        }
    });

    $effect(() => {
        id;
        wallPage;
        if (id > 0) {
            loadWall();
        }
    });

    $effect(() => {
        if (settings) {
            loadSettings();
        }
    });

    const act = async (run: () => Promise<any>, done: string, after: () => Promise<any> = load) => {
        busy = true;
        error = "";
        success = "";
        try {
            await run();
            success = done;
            await after();
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const send = (path: string, body: unknown = {}) => api(`/groups/${id}${path}`, body);
    const del = (path: string) => api(`/groups/${id}${path}`, undefined, "DELETE");

    const searchGroups = (e: Event) => {
        e.preventDefault();
        const q = search.trim();
        if (q === "") {
            return;
        }
        router.go(`/groups/search?q=${encodeURIComponent(q)}`);
    };

    const join = () => {
        const approval = !!group.approval_required;
        act(() => send("/join"), approval ? "Join request sent." : "You joined the group.", async () => {
            if (!my && !approval) {
                router.go(`/my/groups?gid=${id}`);
                return;
            }
            await load();
            onchange?.();
        });
    };

    const leave = () => {
        if (!confirm("Are you sure you want to leave this group?")) {
            return;
        }
        act(() => send("/leave"), "You left the group.", async () => {
            if (my) {
                onchange?.();
                router.go("/my/groups");
                return;
            }
            await load();
        });
    };

    const setShout = (e: Event) => {
        e.preventDefault();
        act(() => send("/shout", {
            shout
        }), "Group shout updated.");
    };

    const postWall = (e: Event) => {
        e.preventDefault();
        act(() => send("/wall", {
            body: post
        }), "", async () => {
            post = "";
            await loadWall();
        });
    };

    const deleteWall = (postId: number) => act(() => del(`/wall/${postId}`), "", loadWall);

    const submitPager = (e: Event, go: (page: number) => void, input: string) => {
        e.preventDefault();
        go(Number(input) || 1);
    };

    const goMemberPage = (page: number) => {
        const target = Math.min(memberPages, Math.max(1, page));
        router.go(url({
            role: memberRole,
            member_page: target
        }, "members"));
    };

    const goWallPage = (page: number) => {
        const target = Math.min(wallPages, Math.max(1, page));
        router.go(url({
            wall_page: target
        }));
    };

    const addLink = (e: Event) => {
        e.preventDefault();
        if (!targetId) {
            return;
        }
        act(() => send(`/${tab}`, {
            targetId
        }), tab === "affiliates" ? "Ally request sent." : "Added to group.", async () => {
            targetId = 0;
            await loadLinks();
        });
    };

    const removeLink = (value: number) => act(() => del(`/${tab}/${value}`), "Removed from group.", loadLinks);
    const acceptAlly = (value: number) => act(() => send(`/affiliates/${value}/accept`), "Ally request accepted.", loadLinks);

    const saveSettings = (e: Event) => {
        e.preventDefault();
        act(async () => {
            if (iconFile?.[0]) {
                const fd = new FormData();
                fd.append("description", settingsForm.description);
                fd.append("approval_required", String(settingsForm.approval_required));
                fd.append("wall_enabled", String(settingsForm.wall_enabled));
                fd.append("bc_only", String(settingsForm.bc_only));
                fd.append("icon", iconFile[0]);
                await apiForm(`/groups/${id}/settings`, fd, "PATCH");
                iconFile = null;
            } else {
                await api(`/groups/${id}/settings`, settingsForm, "PATCH");
            }
        }, "Group settings saved.");
    };

    const deleteGroup = () => {
        if (!confirm("Permanently delete this group? This cannot be undone.")) {
            return;
        }
        act(() => del(""), "", async () => router.go("/my/groups"));
    };

    const perms = (r: any) => ({
        can_post_wall: !!r.can_post_wall,
        can_shout: !!r.can_shout,
        can_delete_wall: !!r.can_delete_wall,
        can_manage_members: !!r.can_manage_members
    });

    const addRole = (e: Event) => {
        e.preventDefault();
        act(() => send("/roles", {
            role_name: newRole.role_name,
            rank: Number(newRole.rank),
            ...perms(newRole)
        }), "Role created.", async () => {
            newRole = {
                role_name: "",
                rank: 2,
                can_post_wall: false,
                can_shout: false,
                can_delete_wall: false,
                can_manage_members: false
            };
            await load();
        });
    };

    const updateRole = (e: Event, r: any) => {
        e.preventDefault();
        act(() => api(`/groups/${id}/roles/${r.id}`, {
            role_name: r.name,
            ...perms(r)
        }, "PATCH"), "Role updated.");
    };

    const deleteRole = (roleId: number) => {
        if (!confirm("Delete this role? Members with it will become Members.")) {
            return;
        }
        act(() => del(`/roles/${roleId}`), "Role deleted.");
    };

    const setRank = (e: Event, m: any) => {
        e.preventDefault();
        act(() => api(`/groups/${id}/members/${m.id}`, {
            role_id: Number(m.role_id)
        }, "PATCH"), "Member rank updated.", loadSettings);
    };

    const exile = (userId: number) => {
        if (!confirm("Exile this member and delete their wall posts?")) {
            return;
        }
        act(() => del(`/members/${userId}`), "Member exiled.", async () => {
            await load();
            await loadSettings();
        });
    };

    const approve = (userId: number) => act(() => send(`/requests/${userId}/approve`), "Join request approved.", async () => {
        await load();
        await loadSettings();
    });

    const deny = (userId: number) => act(() => send(`/requests/${userId}/deny`), "Join request declined.", loadSettings);

    const canManageThis = (m: any) => m.id !== group.owner_id && (isOwner || (m.rank ?? 0) < viewerRank);
    const roleOptions = $derived(roles.filter(r => r.rank !== OWNER_RANK && (isOwner || r.rank < viewerRank)));

    const pic = (userId: number, type = "full") => `/api/user/getProfilePicture?userId=${userId}&type=${type}`;

    const when = (t: number) => {
        const d = new Date(t * 1000);
        return `${d.toLocaleDateString("en-US")} ${d.toLocaleTimeString("en-US")}`;
    };
</script>

<svelte:head>
    <title>{my ? "Groups" : group ? group.name : notFound ? "Group Not Found" : "Group"} - NoneRev</title>
    <link rel="stylesheet" href="/css/groups.css">
</svelte:head>

{#snippet linked(text: string)}{#each linkify(text) as part}{#if part.href}<a class="group-text-link" href={part.href}>{part.text}</a>{:else}{part.text}{/if}{/each}{/snippet}

{#snippet user(u: any)}
    <a href="/user?id={u.id}">
        <img src={pic(u.id, "headshot")} alt="">
        <strong>{u.username}</strong>
    </a>
{/snippet}

{#snippet permBoxes(r: any, disabled: boolean)}
    <label>
        <input type="checkbox" bind:checked={r.can_post_wall} {disabled}>
        Wall
    </label>
    <label>
        <input type="checkbox" bind:checked={r.can_shout} {disabled}>
        Shout
    </label>
    <label>
        <input type="checkbox" bind:checked={r.can_delete_wall} {disabled}>
        Moderate wall
    </label>
    <label>
        <input type="checkbox" bind:checked={r.can_manage_members} {disabled}>
        Members
    </label>
{/snippet}

{#snippet pager(page: number, pages: number, input: string, go: (page: number) => void, onInput: (value: string) => void)}
    <div class="group-pager">
        <span class="group-pager-inner">
            <button type="button" class="group-pager-arrow previous" aria-label="Previous page" disabled={page <= 1} onclick={() => go(page - 1)}></button>
            <form class="group-pager-pages" onsubmit={e => submitPager(e, go, input)}>
                Page
                <input type="text" value={input} aria-label="Page" oninput={e => onInput(e.currentTarget.value)}>
                of
                <span>{pages}</span>
            </form>
            <button type="button" class="group-pager-arrow next" aria-label="Next page" disabled={page >= pages} onclick={() => go(page + 1)}></button>
        </span>
    </div>
{/snippet}

<main class="group-page">
    <UserAd size="banner" class="user-ad-top" />
    <UserAd size="skyscraper" class="user-ad-side" />
    <div class="group-container" class:group-my={my}>
        {@render side?.()}
        <div class="group-mid">
            <form class="group-search" onsubmit={searchGroups}>
                <input type="text" class="group-search-keyword" bind:value={search} maxlength="100" placeholder="Search all groups" aria-label="Search all groups">
                <input type="submit" class="group-button" value="Search">
            </form>

            {#if my && id === 0}
                <div class="group-none">You haven't joined any groups yet.</div>
            {:else if notFound}
                <div class="group-box">
                    <span class="group-box-header">Group not found</span>
                    <div class="group-box-body group-not-found">
                        <p>This group doesn't exist.</p>
                        <a href="/my/groups">Back to Groups</a>
                    </div>
                </div>
            {:else if group}
                {#if error}
                    <div class="group-alert error">{error}</div>
                {/if}
                {#if success}
                    <div class="group-alert success">{success}</div>
                {/if}

                <div class="group-panel">
                    <div class="group-left">
                        <div class="group-thumb">
                            <a class="group-emblem" href={url({})} title={group.name}>
                                <img src={group.icon || "/img/pending.png"} alt={group.name} width="150" height="150">
                            </a>
                        </div>
                        <div class="group-owner">
                            <div>
                                Owned By:
                                <br>
                                <a class="group-owner-name" href="/user?id={group.owner_id}">{group.owner_username || "Unknown"}</a>
                            </div>
                            <div>Members: {memberCount}</div>
                        </div>
                        {#if isMember}
                            <div class="group-rank">
                                My Rank:
                                <span>{group.viewer_role}</span>
                            </div>
                        {:else if joinPending}
                            <button type="button" class="group-join" disabled>Request Pending</button>
                        {:else if me > 0}
                            <button type="button" class="group-join" disabled={busy} onclick={join}>Join Group</button>
                        {:else}
                            <a class="group-join" href="/login">Join Group</a>
                        {/if}
                        {#if group.bc_only}
                            <p class="group-bc-only">
                                <img src="/img/groups/hardhat-bc-only.png" alt="" width="32" height="32">
                                Builders Club Only
                            </p>
                        {/if}
                    </div>
                    <div class="group-right">
                        <h2>{group.name}</h2>
                        <div class="group-description">
                            <pre>{@render linked(shortened ? description.slice(0, SHORT_DESCRIPTION) : description)}{#if shortened}... <button type="button" class="group-more" onclick={() => expanded = true}>More</button>{/if}</pre>
                        </div>
                        <div class="group-report">
                            <a href="/abusereport?type=group&id={id}">Report Abuse</a>
                        </div>
                        <br>
                        {#if me > 0 && shoutText !== ""}
                            <div class="group-status">
                                <div class="group-status-top">{@render linked(shoutText)}</div>
                                <div class="group-status-bottom">
                                    <div class="group-status-by">
                                        {#if group.shout_username}
                                            <a href="/user?id={group.shout_by}">{group.shout_username}</a>
                                        {/if}
                                        {#if group.shout_at}
                                            <span>{when(group.shout_at)}</span>
                                        {/if}
                                    </div>
                                    <div class="group-report">
                                        <a href="/abusereport?type=group&id={id}">Report Abuse</a>
                                    </div>
                                </div>
                            </div>
                        {/if}
                        {#if can("shout")}
                            <form class="group-status-form" onsubmit={setShout}>
                                <input type="text" class="group-status-input" bind:value={shout} maxlength="255" placeholder="Enter your shout" aria-label="Group shout">
                                <input type="submit" class="group-button" value="Group Shout" disabled={busy}>
                            </form>
                        {/if}
                    </div>
                </div>

                {#if settings}
                    <div class="group-box group-settings">
                        <span class="group-box-header">Configure Group</span>
                        <div class="group-box-body group-admin-card">
                            <nav class="group-admin-tabs">
                                {#each Object.entries(settingsTabs) as [key, label]}
                                    <a class:active={settingsTab === key} href={url({ settings: 1, settings_tab: key }, "members")}>{label}{key === "requests" && requests.length ? ` (${requests.length})` : ""}</a>
                                {/each}
                            </nav>

                            {#if settingsTab === "general"}
                                <form class="groups-settings-form group-admin-pane" onsubmit={saveSettings}>
                                    <label for="group-description">Description</label>
                                    <textarea id="group-description" bind:value={settingsForm.description} rows="6" maxlength="2000"></textarea>
                                    <label for="group-icon">Group Emblem</label>
                                    <div class="group-emblem-setting">
                                        <img src={group.icon || "/img/pending.png"} alt="">
                                        <input id="group-icon" type="file" bind:files={iconFile} accept="image/png,image/jpeg,image/webp">
                                    </div>
                                    <label class="group-check">
                                        <input type="checkbox" bind:checked={settingsForm.approval_required}>
                                        Manual approval required to join
                                    </label>
                                    <label class="group-check">
                                        <input type="checkbox" bind:checked={settingsForm.wall_enabled}>
                                        Enable group wall
                                    </label>
                                    <label class="group-check">
                                        <input type="checkbox" bind:checked={settingsForm.bc_only}>
                                        Builders Club members only
                                    </label>
                                    <div class="groups-settings-actions">
                                        <button class="group-button" type="submit" disabled={busy}>Save</button>
                                    </div>
                                </form>
                                <div class="group-danger-zone">
                                    <h3>Delete Group</h3>
                                    <p>Permanently deletes this group, its roles, join requests and wall posts.</p>
                                    <button class="group-delete-button" type="button" disabled={busy} onclick={deleteGroup}>Delete Group</button>
                                </div>
                            {:else if settingsTab === "roles"}
                                <div class="group-admin-pane">
                                    <h3>Roles</h3>
                                    {#each roles as r (r.id)}
                                        <form class="group-role-row" onsubmit={e => updateRole(e, r)}>
                                            <div class="group-role-rank">Rank {r.rank}</div>
                                            <input type="text" bind:value={r.name} maxlength="32" readonly={r.rank === OWNER_RANK}>
                                            {@render permBoxes(r, r.rank === OWNER_RANK)}
                                            {#if r.rank !== OWNER_RANK}
                                                <button class="group-button" type="submit" disabled={busy}>Save</button>
                                            {/if}
                                        </form>
                                        {#if r.rank !== 1 && r.rank !== OWNER_RANK}
                                            <div class="group-role-delete">
                                                <button type="button" disabled={busy} onclick={() => deleteRole(r.id)}>Delete role</button>
                                            </div>
                                        {/if}
                                    {/each}
                                    <h3>Create Role</h3>
                                    <form class="group-role-create" onsubmit={addRole}>
                                        <input type="text" bind:value={newRole.role_name} maxlength="32" placeholder="Role name" required>
                                        <input type="number" bind:value={newRole.rank} min="2" max="254" placeholder="Rank" required>
                                        {@render permBoxes(newRole, false)}
                                        <button class="group-button" type="submit" disabled={busy}>Create Role</button>
                                    </form>
                                </div>
                            {:else if settingsTab === "members"}
                                <div class="group-admin-pane">
                                    <h3>Members</h3>
                                    {#if manage.length === 0}
                                        <div class="group-empty">No members found.</div>
                                    {/if}
                                    {#each manage as m (m.id)}
                                        <div class="group-manage-member">
                                            {@render user(m)}
                                            <span>{m.role}</span>
                                            {#if canManageThis(m)}
                                                <form onsubmit={e => setRank(e, m)}>
                                                    <select bind:value={m.role_id}>
                                                        {#each roleOptions as r}
                                                            <option value={r.id}>{r.name}</option>
                                                        {/each}
                                                    </select>
                                                    <button class="group-button" type="submit" disabled={busy}>Set Rank</button>
                                                </form>
                                                <button class="group-danger-link" type="button" disabled={busy} onclick={() => exile(m.id)}>Exile</button>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <div class="group-admin-pane">
                                    <h3>Join Requests</h3>
                                    {#if requests.length === 0}
                                        <div class="group-empty">No pending requests.</div>
                                    {:else}
                                        {#each requests as r (r.user_id)}
                                            <div class="group-join-request">
                                                {@render user({ id: r.user_id, username: r.username })}
                                                <span>{when(r.created_at)}</span>
                                                <button class="group-button" type="button" disabled={busy} onclick={() => approve(r.user_id)}>Accept</button>
                                                <button class="group-button" type="button" disabled={busy} onclick={() => deny(r.user_id)}>Decline</button>
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else if linksLoaded}
                    <div class="group-people">
                        <div class="group-tabs">
                            {#each visibleTabs as key}
                                <a class="group-tab" class:active={tab === key} href={url({}, key)}>{tabs[key]}</a>
                            {/each}
                        </div>
                        <div class="group-tab-content">
                            {#if tab === "games"}
                                {#if isOwner}
                                    <form class="group-link-form" onsubmit={addLink}>
                                        <label for="group-link-id">Game ID:</label>
                                        <input id="group-link-id" type="number" min="1" bind:value={targetId} required>
                                        <input type="submit" class="group-button" value="Add" disabled={busy}>
                                    </form>
                                {/if}
                                {#if games.length}
                                    <div class="group-places">
                                        {#each games as g (g.id)}
                                            <div class="group-place">
                                                <div>
                                                    <a href="/game?id={g.id}">
                                                        <img src={g.icon || "/img/DefaultPlaceIcon.jpg"} alt="" title={g.title} width="100" height="100">
                                                    </a>
                                                </div>
                                                <div class="group-place-name">
                                                    <a href="/game?id={g.id}">{g.title}</a>
                                                </div>
                                                {#if isOwner}
                                                    <button type="button" class="group-text-button" disabled={busy} onclick={() => removeLink(g.id)}>Remove</button>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <div class="group-no-results">This group has no games yet.</div>
                                {/if}
                            {:else if tab === "members"}
                                <div class="group-members-dropdown">
                                    <select value={memberRole} aria-label="Role" onchange={e => router.go(url({ role: e.currentTarget.value }, "members"))}>
                                        {#if roleOptionsAsc.length === 0}
                                            <option value="">All Members</option>
                                        {/if}
                                        {#each roleOptionsAsc as r}
                                            <option value={r.name}>{r.name}{r.name === memberRole && roleCount !== null ? ` (${roleCount})` : ""}</option>
                                        {/each}
                                    </select>
                                    <div class="group-report">
                                        <a href="/abusereport?type=group&id={id}">Report Abuse</a>
                                    </div>
                                </div>
                                <div class="group-members">
                                    <div class="group-members-spacer"></div>
                                    {#if members.length === 0}
                                        <div class="group-no-results">No results found.</div>
                                    {:else}
                                        {#each members as m (m.id)}
                                            <div class="group-member">
                                                <div class="group-member-avatar">
                                                    {#if typeof m.online === "boolean"}
                                                        <span class="group-member-status">
                                                            <img src={m.online ? "/img/groups/online.png" : "/img/groups/offline.png"} alt={m.online ? "Online" : "Offline"} width="9" height="9">
                                                        </span>
                                                    {/if}
                                                    <a href="/user?id={m.id}" title={m.username}>
                                                        <img src={pic(m.id)} alt={m.username} width="100" height="100">
                                                    </a>
                                                </div>
                                                <div class="group-member-summary">
                                                    <a class="group-member-name" href="/user?id={m.id}" title={m.username}>{m.username}</a>
                                                </div>
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                                {#if memberPages > 1}
                                    {@render pager(memberPage, memberPages, memberPageInput, goMemberPage, (value: string) => memberPageInput = value)}
                                {/if}
                            {:else if tab === "affiliates"}
                                <div class="group-allies">
                                    {#each allies.accepted as a (a.id)}
                                        <div class="group-ally">
                                            <a href="/groups?id={a.id}" title={a.name}>
                                                <img src={a.icon || "/img/pending.png"} alt={a.name} width="42" height="42">
                                            </a>
                                        </div>
                                    {/each}
                                </div>
                                {#if isOwner}
                                    <form class="group-link-form" onsubmit={addLink}>
                                        <label for="group-link-id">Group ID:</label>
                                        <input id="group-link-id" type="number" min="1" bind:value={targetId} required>
                                        <input type="submit" class="group-button" value="Request Ally" disabled={busy}>
                                    </form>
                                    {#if allies.accepted.length}
                                        <h3>Allies</h3>
                                        {#each allies.accepted as a (a.id)}
                                            <div class="group-link-request">
                                                <a href="/groups?id={a.id}">{a.name}</a>
                                                <button type="button" class="group-button" disabled={busy} onclick={() => removeLink(a.id)}>Remove</button>
                                            </div>
                                        {/each}
                                    {/if}
                                    {#if allies.incoming.length}
                                        <h3>Ally Requests</h3>
                                        {#each allies.incoming as a (a.id)}
                                            <div class="group-link-request">
                                                <a href="/groups?id={a.id}">{a.name}</a>
                                                <button type="button" class="group-button" disabled={busy} onclick={() => acceptAlly(a.id)}>Accept</button>
                                                <button type="button" class="group-button" disabled={busy} onclick={() => removeLink(a.id)}>Decline</button>
                                            </div>
                                        {/each}
                                    {/if}
                                    {#if allies.outgoing.length}
                                        <h3>Requests Sent</h3>
                                        {#each allies.outgoing as a (a.id)}
                                            <div class="group-link-request">
                                                <a href="/groups?id={a.id}">{a.name}</a>
                                                <button type="button" class="group-button" disabled={busy} onclick={() => removeLink(a.id)}>Cancel</button>
                                            </div>
                                        {/each}
                                    {/if}
                                {/if}
                            {:else}
                                <div class="group-store-instructions">
                                    <p>Groups have the ability to create and sell official shirts, pants, and t-shirts! All revenue goes to the group owner.</p>
                                </div>
                                {#if isOwner}
                                    <form class="group-link-form" onsubmit={addLink}>
                                        <label for="group-link-id">Catalog item ID:</label>
                                        <input id="group-link-id" type="number" min="1" bind:value={targetId} required>
                                        <input type="submit" class="group-button" value="Add" disabled={busy}>
                                    </form>
                                {/if}
                                <div class="group-store">
                                    {#if shownStore.length}
                                        {#each shownStore as item (item.id)}
                                            <div class="group-store-item">
                                                <a href="/catalog/item?id={item.id}" title={item.name}>
                                                    <img src={item.thumbnail || "/img/pending.png"} alt={item.name} width="110" height="110">
                                                </a>
                                                <a class="group-store-name" href="/catalog/item?id={item.id}" title={item.name}>{item.name}</a>
                                                {#if Number(item.price ?? 0) > 0}
                                                    <span class="group-store-price nonebux">{Number(item.price).toLocaleString()}</span>
                                                {/if}
                                                {#if Number(item.tix_price ?? 0) > 0}
                                                    <span class="group-store-price tix">{Number(item.tix_price).toLocaleString()}</span>
                                                {/if}
                                                {#if item.price === 0 || (item.price === null && item.tix_price === 0)}
                                                    <span class="group-store-free">Free</span>
                                                {/if}
                                                {#if isOwner}
                                                    <button type="button" class="group-text-button" disabled={busy} onclick={() => removeLink(item.id)}>Remove</button>
                                                {/if}
                                            </div>
                                        {/each}
                                    {:else}
                                        <p>This group has no items.</p>
                                    {/if}
                                    <div class="group-store-more">
                                        <a href="/catalog?creator={encodeURIComponent(group.owner_username ?? "")}">See more items for sale by this group</a>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="group-box group-wall-header">
                        <span class="group-box-header">Wall</span>
                        {#if group.wall_enabled && can("post_wall")}
                            <form class="group-wall-form" onsubmit={postWall}>
                                <textarea class="group-wall-text" bind:value={post} maxlength="500" aria-label="Wall post"></textarea>
                                <input type="submit" class="group-button group-wall-post-button" value="Post" disabled={busy}>
                            </form>
                        {/if}
                    </div>
                    <div class="group-wall" id="wall">
                        {#if !group.wall_enabled}
                            <div class="group-wall-note">The group wall is disabled.</div>
                        {:else if isMember && !can("post_wall")}
                            <div class="group-wall-note">Your rank cannot post on the group wall.</div>
                        {/if}

                        {#if wall.length === 0}
                            <div class="group-wall-empty">Nobody has said anything yet...</div>
                        {:else}
                            {#each wall as p, i (p.id)}
                                <div class="group-wall-row" class:odd={i % 2 === 0}>
                                    <div class="group-wall-avatar">
                                        <a href="/user?id={p.user_id}" title={p.username}>
                                            <img src={pic(p.user_id)} alt={p.username} width="100" height="100">
                                        </a>
                                    </div>
                                    <div class="group-wall-body">
                                        <div class="group-wall-post">{@render linked(p.body ?? "")}</div>
                                        <div class="group-wall-date">
                                            <span class="group-wall-time">{when(p.created_at)}</span>
                                            by
                                            <a href="/user?id={p.user_id}">{p.username}</a>
                                            <div class="group-report">
                                                <a href="/abusereport?type=groupwallpost&id={p.id}">Report Abuse</a>
                                            </div>
                                        </div>
                                        {#if me > 0 && (can("delete_wall") || p.user_id === me)}
                                            <div class="group-wall-tools">
                                                <button type="button" class="group-text-button" disabled={busy} onclick={() => deleteWall(p.id)}>Delete</button>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        {/if}
                        {#if wallPages > 1}
                            {@render pager(wallPage, wallPages, wallPageInput, goWallPage, (value: string) => wallPageInput = value)}
                        {/if}
                    </div>
                {/if}
            {/if}
        </div>
        <div class="group-side">
            {#if group && isMember}
                <div class="group-controls">
                    <span class="group-box-header">Controls</span>
                    {#if isOwner || can("manage_members")}
                        <div>
                            {#if settings}
                                <a class="group-button" href={url({})}>Back to Group</a>
                            {:else}
                                <a class="group-button" href="/groups?id={id}&settings=1">Group Admin</a>
                            {/if}
                        </div>
                    {/if}
                    {#if !isOwner}
                        <div>
                            <button type="button" class="group-button" disabled={busy} onclick={leave}>Leave Group</button>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</main>
