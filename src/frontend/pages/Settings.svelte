<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    type Tab = "account" | "security" | "privacy" | "billing" | "notifications" | "invites";
    const tabs: { id: Tab; label: string }[] = [
        { id: "account", label: "Account Info" },
        { id: "security", label: "Security" },
        { id: "privacy", label: "Privacy" },
        { id: "billing", label: "Billing" },
        { id: "notifications", label: "Notifications" },
        { id: "invites", label: "Invites" }
    ];

    let tab = $state<Tab>(tabs.some(item => item.id === router.query.tab) ? router.query.tab as Tab : "account");
    let editingEmail = $state(false);
    let editingPassword = $state(false);
    let busy = $state(false);
    let notice = $state<{ text: string; ok: boolean } | null>(null);
    let newEmail = $state(session.me?.email ?? "");
    let newBio = $state(session.me?.about ?? "");
    let socialDiscord = $state(session.me?.social_discord ?? "");
    let socialTwitter = $state(session.me?.social_twitter ?? "");
    let socialYoutube = $state(session.me?.social_youtube ?? "");
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let inviteKey = $state("");
    let editingUsername = $state(false);
    let newUsername = $state(session.me?.username ?? "");
    let usernamePassword = $state("");
    let invitesOn = $state(true);

    api("/site/settings").then(d => invitesOn = !!d.invites_enabled).catch(() => {});

    const show = (text: string, ok = true) => notice = { text, ok };

    const USERNAME_PRICE = 1000;
    const canBuy = $derived(newUsername.trim().length >= 3 && usernamePassword.length > 0 && !busy);

    const save = async (path: string, body: unknown, done: string) => {
        busy = true;
        notice = null;
        try {
            await api(path, body);
            await session.refresh();
            show(done);
            editingEmail = false;
            editingPassword = false;
            editingUsername = false;
            usernamePassword = "";
            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
        } catch (err: any) {
            show(err.message, false);
        } finally {
            busy = false;
        }
    };

    const generate = async () => {
        busy = true;
        notice = null;
        try {
            inviteKey = (await api("/user/invites/generate", {})).key;
            show("Invite key generated.");
        } catch (err: any) {
            show(err.message, false);
        } finally {
            busy = false;
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(inviteKey);
            show("Invite key copied.");
        } catch {
            show("Could not copy the invite key.", false);
        }
    };
</script>

{#if editingUsername}
    <div class="settings-modal-backdrop" role="presentation" onclick={() => editingUsername = false}>
        <div class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="change-username-title" onclick={e => e.stopPropagation()}>
            <div class="settings-modal-header">
                <h3 id="change-username-title">Change Username</h3>
                <button type="button" class="settings-modal-close" aria-label="Close" onclick={() => editingUsername = false}>&times;</button>
            </div>
            <form class="settings-modal-body" onsubmit={e => { e.preventDefault(); if (canBuy) save("/user/settings/changeusername", { newUsername: newUsername.trim(), password: usernamePassword }, "Username changed."); }}>
                <p class="settings-modal-price">Change username for <img src="/img/nonebux-green.png" alt="Nonebux"> <span>{USERNAME_PRICE.toLocaleString("en-US")}</span>?</p>
                <input type="text" bind:value={newUsername} placeholder="Username" maxlength="20" autocomplete="off" aria-label="New username">
                <input type="password" bind:value={usernamePassword} placeholder="Account Password" autocomplete="current-password" aria-label="Account password">
                <p class="settings-modal-note"><strong>Important:</strong> Original account creation date and forum post count will carry over to your new username.<br>Previous forum posts will appear under your old username and will NOT carry over to your new username.</p>
                {#if notice && !notice.ok}
                    <p class="settings-modal-error">{notice.text}</p>
                {/if}
                <button type="submit" class="settings-modal-buy" disabled={!canBuy}>Buy</button>
            </form>
        </div>
    </div>
{/if}

<svelte:head>
    <title>My Settings - NoneRev</title>
    <link rel="stylesheet" href="/css/settings.css">
</svelte:head>

<main class="settings-page" id="user-account">
    <h1>My Settings</h1>
    <div class="settings-layout">
        <nav class="settings-navigation" aria-label="Settings sections">
            {#each tabs as item}
                <button type="button" class:active={tab === item.id} onclick={() => { tab = item.id; notice = null; }}>{item.label}</button>
            {/each}
        </nav>

        <div class="settings-content">
            {#if notice}
                <div class="settings-message" class:success={notice.ok} class:error={!notice.ok} role="status">{notice.text}</div>
            {/if}

            {#if tab === "account"}
                <section class="settings-section">
                    <h2>Account Info</h2>
                    <div class="settings-card settings-account-card">
                        <div class="settings-info-row"><span>Username: <strong>{session.me?.username}</strong></span><button type="button" class="settings-edit-icon" aria-label="Change username" onclick={() => { newUsername = ""; usernamePassword = ""; notice = null; editingUsername = true; }}>✎</button></div>
                        <div class="settings-info-row"><span>Password: <strong>••••••••</strong></span><button type="button" class="settings-edit-icon" aria-label="Change password" onclick={() => { tab = "security"; editingPassword = true; }}>✎</button></div>
                        <div class="settings-info-row"><span>Email address: <strong>{session.me?.email || "Not set"}</strong></span><button type="button" class="settings-edit-icon" aria-label="Edit email address" onclick={() => editingEmail = !editingEmail}>✎</button></div>
                        {#if editingEmail}
                            <form class="settings-inline-editor" onsubmit={e => { e.preventDefault(); save("/user/settings/changeemail", { newEmail }, "Email updated."); }}>
                                <label for="settings-email">Email address</label>
                                <div class="settings-inline-controls"><input id="settings-email" type="email" bind:value={newEmail} required><button type="submit" disabled={busy}>Save</button><button type="button" onclick={() => editingEmail = false}>Cancel</button></div>
                            </form>
                        {/if}
                    </div>
                </section>

                <section class="settings-section">
                    <h2>Personal</h2>
                    <div class="settings-card settings-personal-card">
                        <form onsubmit={e => { e.preventDefault(); save("/user/settings/changebio", { newBio }, "Personal blurb saved."); }}>
                            <label class="settings-visually-hidden" for="settings-bio">Describe yourself</label>
                            <textarea id="settings-bio" bind:value={newBio} maxlength="1000" rows="4" placeholder="Describe yourself (1000 character limit)"></textarea>
                            <p class="settings-help">Do not provide any details that can be used to identify you outside NoneRev.</p>
                            <div class="settings-save-row"><button type="submit" disabled={busy}>Save</button></div>
                        </form>
                    </div>
                </section>

                <section class="settings-section">
                    <h2>Social Networks</h2>
                    <div class="settings-card settings-social-card">
                        <form onsubmit={e => { e.preventDefault(); save("/user/settings/socials", { discord: socialDiscord, twitter: socialTwitter, youtube: socialYoutube }, "Social networks saved."); }}>
                            <p>These show on your profile. Leave one empty to hide it.</p>
                            <label>Discord<input type="text" bind:value={socialDiscord} maxlength="40" placeholder="e.g. yourname" autocomplete="off"></label>
                            <label>Twitter<input type="text" bind:value={socialTwitter} maxlength="60" placeholder="e.g. @yourname" autocomplete="off"></label>
                            <label>YouTube<input type="text" bind:value={socialYoutube} maxlength="120" placeholder="e.g. @yourchannel or a youtube.com link" autocomplete="off"></label>
                            <div class="settings-save-row"><button type="submit" disabled={busy}>Save</button></div>
                        </form>
                    </div>
                </section>
            {:else if tab === "security"}
                <section class="settings-section">
                    <h2>Security</h2>
                    <div class="settings-card settings-security-card">
                        <div class="settings-info-row"><span>Password: <strong>••••••••</strong></span><button type="button" class="settings-edit-icon" onclick={() => editingPassword = !editingPassword}>✎</button></div>
                        {#if editingPassword}
                            <form class="settings-password-form" onsubmit={e => { e.preventDefault(); save("/user/settings/changepassword", { currentPassword, newPassword, confirmPassword }, "Password changed."); }}>
                                <label>Current password<input type="password" bind:value={currentPassword} autocomplete="current-password" required></label>
                                <label>New password<input type="password" bind:value={newPassword} minlength="8" autocomplete="new-password" required></label>
                                <label>Confirm new password<input type="password" bind:value={confirmPassword} minlength="8" autocomplete="new-password" required></label>
                                <button type="submit" disabled={busy}>Change Password</button>
                            </form>
                        {/if}
                    </div>
                </section>
            {:else if tab === "billing"}
                <section class="settings-section">
                    <h2>Builders Club</h2>
                    <div class="settings-card settings-billing-card">
                        {#if session.me?.membership && session.me.membership !== "None"}
                            <p>You are a <strong>{session.me.membership === "BC" ? "Builders Club" : session.me.membership === "TBC" ? "Turbo Builders Club" : "Outrageous Builders Club"}</strong> member{#if session.me.membership_expires > 0}&nbsp;until {new Date(session.me.membership_expires * 1000).toLocaleDateString("en-US")}{/if}.</p>
                            <p class="settings-help">You get {session.me.membership === "BC" ? 15 : session.me.membership === "TBC" ? 35 : 60} Nonebux every day you visit, and you can buy Builders Club only items.</p>
                        {:else}
                            <p>You are not a Builders Club member.</p>
                            <p class="settings-help">Builders Club gives you daily Nonebux and the club only items in the catalog. <a href="/premium/membership">Upgrade now</a>.</p>
                        {/if}
                    </div>
                </section>
            {:else if tab === "invites"}
                <section class="settings-section">
                    <h2>Invites</h2>
                    <div class="settings-card settings-invite-card">
                        {#if invitesOn}
                            <p>Generate a single-use invite key for someone joining NoneRev.</p>
                            <button type="button" disabled={busy} onclick={generate}>Generate Invite Key</button>
                        {:else}
                            <p>Invite keys are turned off right now.</p>
                        {/if}
                        {#if inviteKey}<div class="settings-invite-result"><input aria-label="Invite key" value={inviteKey} readonly><button type="button" onclick={copy}>Copy</button></div>{/if}
                    </div>
                </section>
            {:else}
                <section class="settings-section">
                    <h2>{tabs.find(item => item.id === tab)?.label}</h2>
                    <div class="settings-card settings-empty-card">There are no {tabs.find(item => item.id === tab)?.label.toLowerCase()} options for this account yet.</div>
                </section>
            {/if}
        </div>
    </div>
</main>
