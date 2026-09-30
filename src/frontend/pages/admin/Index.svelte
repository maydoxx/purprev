<script lang="ts">
    import { api } from "../../api";
    import { rows, num, adminDate } from "./util";
    import Layout from "./Layout.svelte";

    const actionNames: Record<number, string> = {
        1: "Warning",
        2: "1 day ban",
        3: "3 day ban",
        4: "7 day ban",
        5: "14 day ban",
        6: "Deleted"
    };

    let stats = $state<any>(null);
    let users = $state<any>(null);
    let servers = $state<any>(null);
    let moderation = $state<any>(null);
    let games = $state<any>(null);

    api("/admin/stats").then(d => stats = d).catch(() => {});
    api("/admin/users").then(d => users = d).catch(() => {});
    api("/admin/moderation").then(d => moderation = d).catch(() => {});
    api("/admin/games").then(d => games = d).catch(() => {});

    const loadServers = () => api("/admin/servers").then(d => servers = d).catch(() => {});
    const round = (v: number) => Number.isInteger(v) ? num(v) : v.toFixed(2);
    loadServers();

    const shutDown = async (jobId: string) => {
        if (!confirm("Shut down this game server? Everyone in it gets kicked.")) return;
        try {
            await api(`/admin/servers/${jobId}`, undefined, "DELETE");
            await loadServers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const recentUsers = $derived(rows(users).slice(0, 8));
    const recentGames = $derived(rows(games).slice(0, 6));
    const active = $derived(rows(moderation).slice(0, 6));

    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const club = (u: any) => u.membership && u.membership !== "None" ? u.membership : "";
    const n = (v: any) => stats ? num(v) : "—";
</script>

{#snippet stat(label: string, value: string, sub = "")}
    <div class="col-6 col-md-4 col-xl-3">
        <div class="card admin-stat-card h-100">
            <div class="card-body">
                <div class="admin-stat-label">{label}</div>
                <div class="admin-stat-number">{value}</div>
                {#if sub}<div class="admin-stat-sub">{sub}</div>{/if}
            </div>
        </div>
    </div>
{/snippet}

<Layout title="Dashboard">
    <div class="admin-heading">
        <h1>Dashboard</h1>
        <p>Signed in as an admin. Here is what the site is doing.</p>
    </div>

    <div class="row g-3 mb-4">
        {@render stat("Users", n(stats?.users), stats ? `${num(stats.online)} online, ${num(stats.signups_today)} joined today` : "")}
        {@render stat("Playing", n(stats?.players), stats ? `${num(stats.servers)} server${stats.servers === 1 ? "" : "s"}, RCC ${stats.rcc}` : "")}
        {@render stat("Games", n(stats?.games), stats ? `${num(stats.published)} with a place file` : "")}
        {@render stat("Catalog items", n(stats?.catalog), stats ? `${num(stats.models)} toolbox models` : "")}
        {@render stat("Builders Club", n(stats?.club), stats ? `${num(stats.admins)} admins` : "")}
        {@render stat("Moderated", n(stats?.moderation), "active actions")}
        {@render stat("Invite keys", n(stats?.invites), "unused")}
        {@render stat("Applications", n(stats?.applications), "waiting")}
    </div>

    <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span class="admin-card-title">Running game servers</span>
            <span class="admin-muted">{servers ? servers.health?.rcc === "up" ? "RCC is up" : "RCC is down" : "checking…"}</span>
        </div>
        <div class="table-responsive">
            <table class="table table-hover admin-table">
                <thead>
                    <tr>
                        <th>Place</th>
                        <th>Job</th>
                        <th>Port</th>
                        <th>Players</th>
                        <th>Started</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each servers?.servers ?? [] as s}
                        <tr>
                            <td><a href="/game?id={s.placeId}">{s.title || s.placeId}</a></td>
                            <td class="admin-key">{s.jobId}{s.ready ? "" : " (starting)"}</td>
                            <td>{s.port}</td>
                            <td>{s.players}</td>
                            <td>{new Date(s.startedAt).toLocaleString("en-US")}</td>
                            <td class="admin-actions"><button type="button" class="btn btn-sm btn-outline-danger" onclick={() => shutDown(s.jobId)}>Shut down</button></td>
                        </tr>
                    {:else}
                        <tr><td colspan="6" class="admin-empty">No game servers are running.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span class="admin-card-title">Engine counters</span>
            <span class="admin-muted">what clients and servers report, since the API started</span>
        </div>
        <div class="table-responsive">
            <table class="table table-hover admin-table">
                <thead>
                    <tr>
                        <th>Counter</th>
                        <th>Last</th>
                        <th>Average</th>
                        <th>Samples</th>
                        <th>Seen</th>
                    </tr>
                </thead>
                <tbody>
                    {#each servers?.counters ?? [] as c}
                        <tr>
                            <td class="admin-key">{c.name}</td>
                            <td>{round(c.last)}</td>
                            <td>{round(c.avg)}</td>
                            <td>{num(c.samples)}</td>
                            <td>{new Date(c.at).toLocaleTimeString("en-US")}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="admin-empty">Nothing reported yet.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="row g-4 mb-4">
        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span class="admin-card-title">Newest users</span>
                    <a href="/admi/users" class="small">All users</a>
                </div>
                <ul class="admin-list">
                    {#each recentUsers as u}
                        <li>
                            <img class="admin-avatar" src={pic(u.id)} alt="">
                            <div class="grow">
                                <a href="/user?id={u.id}">{u.username}</a>
                                {#if Number(u.admin) > 0}<span class="admin-pill admin">Admin</span>{/if}
                                {#if u.ongoing_action_id != null}<span class="admin-pill danger">Moderated</span>{/if}
                                {#if club(u)}<span class="admin-pill {club(u).toLowerCase()}">{club(u)}</span>{/if}
                                <div class="admin-muted">joined {adminDate(u.created_at)}{#if u.invited_by} &middot; invited by {u.invited_by}{/if}</div>
                            </div>
                            <span class="admin-muted">N${num(u.currency)}</span>
                        </li>
                    {:else}
                        <li class="admin-empty">No users yet.</li>
                    {/each}
                </ul>
            </div>
        </div>

        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span class="admin-card-title">Active moderation</span>
                    <a href="/admi/viewmoderation" class="small">All actions</a>
                </div>
                <ul class="admin-list">
                    {#each active as m}
                        <li>
                            <img class="admin-avatar" src={pic(m.id)} alt="">
                            <div class="grow">
                                <a href="/user?id={m.id}">{m.username}</a>
                                <span class="admin-pill danger">{actionNames[Number(m.action)] ?? "Action"}</span>
                                <div class="admin-muted text-truncate">{m.reason || "no note"}</div>
                            </div>
                            <span class="admin-muted">{Number(m.action) === 6 ? "never expires" : Number(m.expiresAt) > 0 ? `until ${adminDate(m.expiresAt)}` : ""}</span>
                        </li>
                    {:else}
                        <li class="admin-empty">Nobody is moderated right now.</li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span class="admin-card-title">Newest games</span>
            <a href="/admi/games" class="small">All games</a>
        </div>
        <div class="table-responsive">
            <table class="table table-hover admin-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Game</th>
                        <th>Creator</th>
                        <th>File</th>
                        <th>Playing</th>
                    </tr>
                </thead>
                <tbody>
                    {#each recentGames as g}
                        <tr>
                            <td style="width:64px"><img class="admin-thumb" src={g.icon || "/img/DefaultPlaceIcon.jpg"} alt=""></td>
                            <td><a href="/game?id={g.id}">{g.title}</a> <span class="admin-muted">#{g.id}</span></td>
                            <td>{g.creator_name || "Unknown"}</td>
                            <td>{#if g.published_at}<span class="admin-pill ok">published</span>{:else}<span class="admin-muted">none</span>{/if}</td>
                            <td>{num(g.playing)}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="admin-empty">No games yet.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</Layout>
