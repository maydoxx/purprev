<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";
    import { preferredTheme, setTheme } from "../theme.svelte";
    import { resolve, type Theme } from "../themes";
    import themeMeta from "virtual:site-themes";
    import { customTheme, customThemeLoad, reloadCustomTheme, saveCustomTheme, validateCustomCss, CUSTOM_CSS_LIMIT, CUSTOM_CSS_RECOVERY } from "../custom-theme.svelte";

    type Tab = "account" | "security" | "privacy" | "billing" | "invites" | "developer";
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
        },
        {
            id: "developer",
            label: "Developer"
        }
    ];

    const pick = (id: string | undefined): Tab => {
        if (id === "notifications") {
            return "privacy";
        }
        return tabs.some(item => item.id === id) ? id as Tab : "account";
    };

    let tab = $state<Tab>(pick(router.query.tab));
    $effect(() => { tab = pick(router.query.tab); });
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

    const themeNames: [Theme, string][] = [
        ["auto", "Automatic"],
        ["classic", "Classic"],
        ["dark", "Dark"],
        ["halloween", "Halloween"],
        ["sakura", "Sakura"]
    ];

    let theme = $state(preferredTheme());
    const shownMeta = $derived(themeMeta[resolve(theme, new Date())]);
    let themeError = $state("");
    let customCss = $state(customTheme.css);
    let customUrl = $state(customTheme.url);
    let customEnabled = $state(customTheme.enabled);
    let customError = $state("");
    let customMessage = $state("");
    let customFileInput = $state<HTMLInputElement>();

    const cssBytes = $derived(new TextEncoder().encode(customCss).length);

    const kb = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

    $effect(() => {
        customCss = customTheme.css;
        customUrl = customTheme.url;
        customEnabled = customTheme.enabled;
    });

    const saveCss = () => {
        customError = "";
        customMessage = "";
        try {
            saveCustomTheme(customCss, customEnabled, customUrl);
            reloadCustomTheme();
            if (router.query.customCss === "off") router.replace("/my/settings?tab=developer");
            customMessage = customEnabled ? "Custom CSS saved and enabled in this browser." : "Custom CSS saved. It is currently disabled.";
        } catch (err) {
            customError = err instanceof Error ? err.message : "Could not save custom CSS.";
        }
    };

    const disableCss = () => {
        customError = "";
        try {
            saveCustomTheme(customTheme.css, false, customTheme.url);
            customMessage = "Custom CSS disabled. Your saved URL and CSS are still available.";
        } catch (err) {
            customError = err instanceof Error ? err.message : "Could not disable custom CSS.";
        }
    };

    const importCss = async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        customError = "";
        customMessage = "";
        try {
            if (!file.name.toLowerCase().endsWith(".css")) throw new Error("Choose a .css file.");
            if (file.size > CUSTOM_CSS_LIMIT) throw new Error("Custom CSS must be 256 KB or smaller.");
            const css = await file.text();
            validateCustomCss(css);
            customCss = css;
            customMessage = "CSS imported into the editor. Save to apply your changes.";
        } catch (err) {
            customError = err instanceof Error ? err.message : "Could not read that CSS file.";
        }
    };

    const exportCss = () => {
        const url = URL.createObjectURL(new Blob([customCss], { type: "text/css;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "nonerev-custom-theme.css";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const pickTheme = async (next: Theme) => {
        theme = next;
        themeError = "";
        setTheme(next);
        try {
            await api("/user/settings/theme", {
                theme: next
            });
        } catch (err: any) {
            themeError = err.message;
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
                <button type="button" role="tab" aria-selected={tab === item.id} onclick={() => { router.go(`/my/settings?tab=${item.id}`); notice = null; }}>{item.label}</button>
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

            <h3>Site Theme</h3>
            <div class="settings-card settings-theme">
                <label class="settings-field">
                    <span class="settings-label">Theme:</span>
                    <select class="settings-input settings-theme-select" value={theme} onchange={e => pickTheme(e.currentTarget.value as Theme)}>
                        {#each themeNames as [value, label]}
                            <option {value}>{label}</option>
                        {/each}
                    </select>
                </label>
                {#if shownMeta}
                    <div class="settings-theme-meta">
                        <p><strong>{shownMeta.name}</strong>{#if shownMeta.author}&nbsp;by {shownMeta.author}{/if}{#if theme === "auto"}<span class="settings-hint">&nbsp;(this month's theme)</span>{/if}</p>
                        {#if shownMeta.description}
                            <p class="settings-hint">{shownMeta.description}</p>
                        {/if}
                        {#if shownMeta.credits.length}
                            <p class="settings-hint settings-theme-credits-title">Artwork</p>
                            <ul class="settings-theme-credits">
                                {#each shownMeta.credits as credit}
                                    <li>
                                        {#if credit.url}
                                            <a class="settings-link" href={credit.url} target="_blank" rel="noopener noreferrer">{credit.text}</a>
                                        {:else}
                                            {credit.text}
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                {/if}
                {#if themeError}
                    <p class="settings-theme-error">{themeError}</p>
                {/if}
            </div>
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
        {:else if tab === "developer"}
            <form class="settings-developer" onsubmit={e => { e.preventDefault(); saveCss(); }}>
                <h3>Custom CSS Theme</h3>
                <div class="settings-card">
                    <p>Create your own theme with a stylesheet URL, CSS overrides or both! It applies on top of your Site Theme and is saved for your account in this browser!</p>
                    <p class="settings-dev-links">
                        <a class="settings-link" href="https://github.com/nonerev/site-themes" target="_blank" rel="noopener noreferrer">Theme source and starter CSS</a>
                        <a class="settings-link" href="/my/theme-test">Component test page</a>
                    </p>
                    <div class="settings-dev-switch">
                        <label class="settings-custom-toggle">
                            <input type="checkbox" bind:checked={customEnabled}> Enable custom CSS
                        </label>
                        <span class="settings-dev-state" class:on={customTheme.enabled}>{customTheme.enabled ? "On in this browser" : "Off"}</span>
                    </div>
                </div>

                <h3>Stylesheet URL</h3>
                <div class="settings-card">
                    <label class="settings-label settings-dev-label" for="settings-custom-url">URL (optional)</label>
                    <input id="settings-custom-url" class="settings-input" type="url" bind:value={customUrl} maxlength="4096" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="settings-url-help" placeholder="https://example.com/theme.css">
                    <p id="settings-url-help" class="settings-hint settings-dev-hint">Public CSS file served as text/css. It can be raw github link or served via webserver.</p>
                    {#if customThemeLoad.status !== "idle"}
                        <div class="settings-url-status">
                            <p class:settings-theme-error={customThemeLoad.status === "error"} role="status">{customThemeLoad.status === "loading" ? "Loading saved stylesheet…" : customThemeLoad.status === "loaded" ? "Saved stylesheet loaded." : customThemeLoad.error}</p>
                            <button type="button" class="settings-btn" onclick={reloadCustomTheme}>Reload</button>
                        </div>
                    {/if}
                </div>

                <h3>CSS Overrides</h3>
                <div class="settings-card">
                    <textarea id="settings-custom-css" class="settings-input settings-css-editor" bind:value={customCss} spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="CSS overrides" aria-describedby="settings-css-help" placeholder="/* Your theme CSS */"></textarea>
                    <div class="settings-dev-meta">
                        <p id="settings-css-help" class="settings-hint settings-dev-hint">Applied after the stylesheet URL. Use full HTTPS URLs or site paths for images and fonts.</p>
                        <span class="settings-dev-size" class:over={cssBytes > CUSTOM_CSS_LIMIT}>{kb(cssBytes)} / 256 KB</span>
                    </div>
                    <input class="settings-hidden" type="file" accept=".css,text/css" aria-label="Import CSS file" bind:this={customFileInput} onchange={e => importCss(e.currentTarget)}>
                    <div class="settings-css-actions">
                        <button type="button" class="settings-btn" onclick={() => customFileInput?.click()}>Import</button>
                        <button type="button" class="settings-btn" disabled={!customCss.trim()} onclick={exportCss}>Export</button>
                        <span class="settings-css-gap"></span>
                        <button type="button" class="settings-btn" disabled={!customTheme.enabled} onclick={disableCss}>Disable</button>
                        <button type="submit" class="settings-btn-primary">Save CSS</button>
                    </div>
                    {#if customError || customTheme.error}
                        <p class="settings-theme-error" role="alert">{customError || customTheme.error}</p>
                    {/if}
                    {#if customMessage}
                        <p class="settings-css-message" role="status">{customMessage}</p>
                    {/if}
                </div>

                <p class="settings-hint settings-dev-hint">If a theme hides these controls, open <a class="settings-link" href={CUSTOM_CSS_RECOVERY}>settings with custom CSS turned off</a>. Your URL and CSS are kept.</p>
            </form>
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
