<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    type Tab = "account" | "security" | "privacy" | "billing" | "invites";
    type Modal = "username" | "funds" | "password" | "email" | "done";

    const tabs: { id: Tab; label: string }[] = [
        {
            id: "account",
            label: "Account Info"
        },
        {
            id: "security",
            label: "Security"
        },
        {
            id: "privacy",
            label: "Privacy"
        },
        {
            id: "billing",
            label: "Billing"
        },
        {
            id: "invites",
            label: "Invites"
        }
    ];

    const pick = (id: string | undefined): Tab => {
        if (id === "notifications") {
            return "privacy";
        }
        return tabs.some(item => item.id === id) ? id as Tab : "account";
    };

    let tab = $state<Tab>(pick(router.query.tab));
    let modal = $state<Modal | null>(null);
    let busy = $state(false);
    let error = $state("");
    let success = $state("");
    let notice = $state<{ text: string; ok: boolean } | null>(null);
    let newEmail = $state("");
    let newBio = $state(session.me?.about ?? "");
    let socialDiscord = $state(session.me?.social_discord ?? "");
    let socialTwitter = $state(session.me?.social_twitter ?? "");
    let socialYoutube = $state(session.me?.social_youtube ?? "");
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let inviteKey = $state("");
    let newUsername = $state("");
    let usernamePassword = $state("");
    let invitesOn = $state(true);
    let pastNames = $state<string[]>([]);

    api("/site/settings").then(d => invitesOn = !!d.invites_enabled).catch(() => {});

    const loadPastNames = () => {
        if (!session.me) return;
        api(`/user/profile/${session.me.id}`).then(d => pastNames = d.previousUsernames ?? []).catch(() => {});
    };

    loadPastNames();

    const USERNAME_PRICE = 1000;
    const short = $derived(USERNAME_PRICE - (session.me?.currency ?? 0));
    const canBuy = $derived(newUsername.trim().length >= 3 && usernamePassword.length > 0 && !busy);
    const canUpdate = $derived(currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0 && !busy);
    const email = $derived(session.me?.email ?? "");
    const hiddenEmail = $derived(email ? "*******" + email.slice(email.indexOf("@")) : "");

    const titles: Record<Modal, string> = {
        username: "Change Username",
        funds: "Insufficient Funds",
        password: "Change Password",
        email: "Change My Email",
        done: "Success"
    };

    const title = $derived(modal === "email" && !email ? "Add My Email" : modal ? titles[modal] : "");

    $effect(() => {
        if (!notice) return;
        const timer = setTimeout(() => notice = null, 5000);
        return () => clearTimeout(timer);
    });

    const open = (next: Modal) => {
        error = "";
        notice = null;
        newUsername = "";
        usernamePassword = "";
        currentPassword = "";
        newPassword = "";
        confirmPassword = "";
        newEmail = email;
        modal = next;
    };

    const close = () => {
        modal = null;
        error = "";
    };

    const save = async (path: string, body: unknown, done: string) => {
        busy = true;
        error = "";
        notice = null;
        try {
            await api(path, body);
            await session.refresh();
            if (modal) {
                success = done;
                modal = "done";
            } else {
                notice = {
                    text: done,
                    ok: true
                };
            }
        } catch (err: any) {
            if (modal) {
                error = err.message;
            } else {
                notice = {
                    text: err.message,
                    ok: false
                };
            }
        } finally {
            busy = false;
        }
    };

    const changeUsername = () => {
        if (!canBuy) return;
        save("/user/settings/changeusername", {
            newUsername: newUsername.trim(),
            password: usernamePassword
        }, "Username changed.").then(loadPastNames);
    };

    const changePassword = () => {
        if (!canUpdate) return;
        if (newPassword !== confirmPassword) {
            error = "Your new and confirm passwords do not match.";
            return;
        }
        save("/user/settings/changepassword", {
            currentPassword,
            newPassword,
            confirmPassword
        }, "Password changed.");
    };

    const saveSocials = () => {
        save("/user/settings/socials", {
            discord: socialDiscord,
            twitter: socialTwitter,
            youtube: socialYoutube
        }, "Social networks saved.");
    };

    const generate = async () => {
        busy = true;
        notice = null;
        try {
            inviteKey = (await api("/user/invites/generate", {})).key;
            notice = {
                text: "Invite key generated.",
                ok: true
            };
        } catch (err: any) {
            notice = {
                text: err.message,
                ok: false
            };
        } finally {
            busy = false;
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(inviteKey);
            notice = {
                text: "Invite key copied.",
                ok: true
            };
        } catch {
            notice = {
                text: "Could not copy the invite key.",
                ok: false
            };
        }
    };
</script>

<svelte:head>
    <title>Settings - NoneRev</title>
    <link rel="stylesheet" href="/css/settings.css">
</svelte:head>

{#if notice}
    <div class="settings-alert" class:error={!notice.ok} role="status">{notice.text}</div>
{/if}

{#if modal}
    <div class="settings-modal">
        <div class="settings-modal-backdrop" role="presentation" onclick={close}></div>
        <div class="settings-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" tabindex="-1">
            <div class="settings-modal-header">
                <button type="button" class="settings-modal-close" aria-label="Close" onclick={close}></button>
                <h4 id="settings-modal-title">{title}</h4>
            </div>

            <div class="settings-modal-body">
                {#if modal === "funds"}
                    <p>You need <img class="settings-currency" src="/img/nonebux-green.png" alt="Nonebux"> {short.toLocaleString("en-US")} more to change your username.</p>
                    <p>Would you like to buy more Nonebux?</p>
                    <div class="settings-modal-btns">
                        <a class="settings-btn-primary" href="/upgrades/nonebux" onclick={close}>Buy</a>
                    </div>
                {:else if modal === "username"}
                    <form onsubmit={e => { e.preventDefault(); changeUsername(); }}>
                        <input class="settings-input" type="text" bind:value={newUsername} placeholder="Desired Username (3-20 characters)" maxlength="20" autocomplete="off" aria-label="Desired username">
                        <input class="settings-input" type="password" bind:value={usernamePassword} placeholder="Current Password" autocomplete="current-password" aria-label="Current password">
                        {#if error}
                            <p class="settings-modal-error">{error}</p>
                        {/if}
                        <div class="settings-modal-btns">
                            <button type="submit" class="settings-btn-primary" disabled={!canBuy}>Buy for <img class="settings-currency" src="/img/nonebux-nav.png" alt="Nonebux">{USERNAME_PRICE.toLocaleString("en-US")}</button>
                        </div>
                        <p class="settings-modal-note"><strong>Important:</strong> Original account creation date and forum post count will carry over to your new username.<br>Previous forum posts will appear under your old username and will NOT carry over to your new username.</p>
                    </form>
                {:else if modal === "password"}
                    <form class="settings-password" onsubmit={e => { e.preventDefault(); changePassword(); }}>
                        <input class="settings-input" type="password" bind:value={currentPassword} placeholder="Current Password" autocomplete="current-password" aria-label="Current password">
                        <input class="settings-input" type="password" bind:value={newPassword} placeholder="New Password" minlength="8" autocomplete="new-password" aria-label="New password">
                        <input class="settings-input" type="password" bind:value={confirmPassword} placeholder="Confirm Password" minlength="8" autocomplete="new-password" aria-label="Confirm password">
                        {#if error}
                            <p class="settings-modal-error">{error}</p>
                        {/if}
                        <div class="settings-modal-btns">
                            <button type="submit" class="settings-btn-primary" disabled={!canUpdate}>Update</button>
                        </div>
                    </form>
                {:else if modal === "email"}
                    <form onsubmit={e => { e.preventDefault(); save("/user/settings/changeemail", { newEmail }, "Email updated."); }}>
                        <input class="settings-input" type="email" bind:value={newEmail} placeholder="My Email Address" required aria-label="Email address">
                        {#if error}
                            <p class="settings-modal-error">{error}</p>
                        {/if}
                        <div class="settings-modal-btns">
                            <button type="submit" class="settings-btn-primary" disabled={busy || !newEmail.trim()}>{email ? "Change Email" : "Add Email"}</button>
                        </div>
                    </form>
                {:else}
                    <p>{success}</p>
                    <div class="settings-modal-btns">
                        <button type="button" class="settings-btn" onclick={close}>Ok</button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<main class="settings-page" id="user-account">
    <h1>My Settings</h1>

    <ul class="settings-tabs" role="tablist">
        {#each tabs as item}
            <li class="settings-tab" class:active={tab === item.id}>
                <button type="button" role="tab" aria-selected={tab === item.id} onclick={() => { tab = item.id; notice = null; }}>{item.label}</button>
            </li>
        {/each}
    </ul>

    <div class="settings-content">
        {#if tab === "account"}
            <h3>Account Info</h3>
            <div class="settings-card">
                <div class="settings-row">
                    <p><span class="settings-label">Username:</span> {session.me?.username}</p>
                    <button type="button" class="settings-edit" title="Change Username" aria-label="Change Username" onclick={() => open(short > 0 ? "funds" : "username")}></button>
                </div>
                <div class="settings-row">
                    <p><span class="settings-label">Password:</span> *******</p>
                    <button type="button" class="settings-edit" title="Change Password" aria-label="Change Password" onclick={() => open("password")}></button>
                </div>
                {#if pastNames.length}
                    <div class="settings-row settings-past">
                        <p>(Previous usernames: {pastNames.join(", ")} )</p>
                    </div>
                {/if}
                <div class="settings-row" class:empty={!email}>
                    {#if email}
                        <p><span class="settings-label">Email address:</span> {hiddenEmail}</p>
                        <button type="button" class="settings-edit" title="Change Email" aria-label="Change Email" onclick={() => open("email")}></button>
                    {:else}
                        <p><span class="settings-label">Email address:</span> <span class="settings-warning"></span> <span class="settings-error">Add email</span></p>
                        <button type="button" class="settings-link" onclick={() => open("email")}>Add Email</button>
                    {/if}
                </div>
            </div>

            <h3>Personal</h3>
            <form class="settings-card settings-personal" onsubmit={e => { e.preventDefault(); save("/user/settings/changebio", { newBio }, "Personal blurb saved."); }}>
                <label class="settings-hidden" for="settings-bio">Describe yourself</label>
                <textarea id="settings-bio" class="settings-input settings-bio" bind:value={newBio} maxlength="1000" placeholder="Describe yourself (1000 character limit)"></textarea>
                <p class="settings-hint">Do not provide any details that can be used to identify you outside NoneRev.</p>
                <div class="settings-actions">
                    <button type="submit" class="settings-btn" disabled={busy}>Save</button>
                </div>
            </form>

            <h3>Social Networks</h3>
            <form class="settings-card settings-social" onsubmit={e => { e.preventDefault(); saveSocials(); }}>
                <label class="settings-field">
                    <span class="settings-label">Discord:</span>
                    <input class="settings-input" type="text" bind:value={socialDiscord} maxlength="40" placeholder="e.g. nonerev" autocomplete="off">
                </label>
                <label class="settings-field">
                    <span class="settings-label">Twitter:</span>
                    <input class="settings-input" type="text" bind:value={socialTwitter} maxlength="60" placeholder="e.g. @NoneRev" autocomplete="off">
                </label>
                <label class="settings-field">
                    <span class="settings-label">YouTube:</span>
                    <input class="settings-input" type="text" bind:value={socialYoutube} maxlength="120" placeholder="e.g. www.youtube.com/@NoneRev" autocomplete="off">
                </label>
                <div class="settings-actions">
                    <button type="submit" class="settings-btn" disabled={busy}>Save</button>
                </div>
            </form>
        {:else if tab === "security"}
            <h3>Secure Sign Out</h3>
            <div class="settings-card">
                <div class="settings-split">
                    <p>Sign out of all other sessions</p>
                    <button type="button" class="settings-btn" disabled={busy} onclick={() => save("/user/settings/signout", {}, "Signed out of all other sessions.")}>Sign out</button>
                </div>
            </div>
        {:else if tab === "privacy"}
            <h3>Privacy Setting</h3>
            <div class="settings-card">
                <p>There are no privacy options for this account yet.</p>
            </div>

            <h3>Notifications</h3>
            <div class="settings-card">
                <p>There are no notification options for this account yet.</p>
            </div>
        {:else if tab === "billing"}
            <h3>Builders Club</h3>
            <div class="settings-card">
                {#if session.me?.membership && session.me.membership !== "None"}
                    <p>You are a <strong>{session.me.membership === "BC" ? "Builders Club" : session.me.membership === "TBC" ? "Turbo Builders Club" : "Outrageous Builders Club"}</strong> member{#if session.me.membership_expires > 0}&nbsp;until <span class="settings-success">{new Date(session.me.membership_expires * 1000).toLocaleDateString("en-US")}</span>{/if}.</p>
                    <p class="settings-hint">You get {session.me.membership === "BC" ? 15 : session.me.membership === "TBC" ? 35 : 60} Nonebux every day you visit, and you can buy Builders Club only items.</p>
                {:else}
                    <p>You are not a Builders Club member.</p>
                    <p class="settings-hint">Builders Club gives you daily Nonebux and the club only items in the catalog. <a class="settings-link" href="/premium/membership">Upgrade now</a>.</p>
                {/if}
            </div>
        {:else}
            <h3>Invites</h3>
            <div class="settings-card">
                <div class="settings-split">
                    {#if invitesOn}
                        <p>Generate a single-use invite key for someone joining NoneRev.</p>
                        <button type="button" class="settings-btn" disabled={busy} onclick={generate}>Generate Invite Key</button>
                    {:else}
                        <p>Invite keys are turned off right now.</p>
                    {/if}
                </div>
                {#if inviteKey}
                    <div class="settings-invite">
                        <input class="settings-input" aria-label="Invite key" value={inviteKey} readonly>
                        <button type="button" class="settings-btn" onclick={copy}>Copy</button>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</main>
