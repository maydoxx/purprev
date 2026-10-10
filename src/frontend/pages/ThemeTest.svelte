<script lang="ts">
    import { onDestroy } from "svelte";
    import GameCard from "../GameCard.svelte";
    import { themePreview } from "../theme.svelte";
    import type { Theme } from "../themes";
    import { customTheme, customThemeLoad, CUSTOM_CSS_RECOVERY } from "../custom-theme.svelte";

    const themes: [Theme, string][] = [
        ["classic", "Classic"],
        ["dark", "Dark"],
        ["sakura", "Sakura"],
        ["halloween", "Halloween"],
        ["auto", "Automatic"]
    ];
    const game = {
        id: 0,
        title: "Sample place with a long title",
        playing: 123,
        up_votes: 84,
        down_votes: 16,
        like_ratio: 84,
        creator_id: 0,
        creator_name: "ThemeBuilder"
    };
    const unplayed = {
        ...game,
        title: "Sample unplayed place",
        playing: 0,
        up_votes: 0,
        down_votes: 0,
        like_ratio: 0
    };
    let tab = $state("Overview");
    let message = $state("");
    let warningVisible = $state(true);
    let noticeVisible = $state(true);
    let dialog: HTMLDialogElement;

    onDestroy(() => { themePreview.name = null; });

    $effect(() => {
        if (!message) return;
        const timer = setTimeout(() => message = "", 5000);
        return () => clearTimeout(timer);
    });

    const sample = (e: MouseEvent) => {
        if (!(e.target instanceof Element) || !e.target.closest("a")) return;
        e.preventDefault();
        message = "Sample link selected.";
    };

    const dialogKeys = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    };
</script>

<svelte:head>
    <title>Theme Test - NoneRev</title>
    <link rel="stylesheet" href="/css/settings.css">
    <link rel="stylesheet" href="/css/games.css">
    <link rel="stylesheet" href="/css/home.css">
    <link rel="stylesheet" href="/css/profile.css">
    <link rel="stylesheet" href="/css/friends.css">
    <link rel="stylesheet" href="/css/errors.css">
    <link rel="stylesheet" href="/css/warning.css">
    <link rel="stylesheet" href="/css/nonebux.css">
    <link rel="stylesheet" href="/css/theme-test.css">
</svelte:head>

{#if message}
    <div class="settings-alert" role="status">{message}</div>
{/if}

<main class="theme-test-page">
    <h1>Theme Test</h1>
    <p>Try your theme on common site components. Sample actions only affect this page.</p>
    <p><a href="/my/settings?tab=developer">Back to Developer settings</a> · <a href={CUSTOM_CSS_RECOVERY}>Disable custom CSS and recover settings</a></p>

    <section class="settings-card theme-test-controls" aria-label="Theme preview controls">
        <label class="settings-field" for="test-base-theme">Preview base theme</label>
        <select id="test-base-theme" class="settings-input" value={themePreview.name ?? "saved"} onchange={e => themePreview.name = e.currentTarget.value === "saved" ? null : e.currentTarget.value as Theme}>
            <option value="saved">Use saved preference</option>
            {#each themes as [value, label]}<option {value}>{label}</option>{/each}
        </select>
        <p class="settings-hint">Temporary preview; leaving this page restores your saved preference. Saved custom CSS stays applied.</p>
        <p class="settings-hint" role="status">Custom CSS: {customTheme.enabled ? "enabled" : "disabled"}{customTheme.enabled && customTheme.url ? ` · Stylesheet: ${customThemeLoad.status}` : ""}</p>
    </section>

    <section class="settings-page theme-test-sample" aria-labelledby="test-type-title">
        <h3 id="test-type-title">Text and buttons</h3>
        <div class="settings-card">
            <h3>Sample heading</h3>
            <p>Regular text, <strong>bold text</strong>, <em>italic text</em>, and a <a href="#test-type-title">sample link</a>.</p>
            <p class="settings-hint">Secondary text should still be readable on the page and on cards.</p>
            <div class="theme-test-row">
                <button type="button" class="settings-btn-primary" onclick={() => message = "Primary button selected."}>Primary</button>
                <button type="button" class="settings-btn" onclick={() => message = "Secondary button selected."}>Secondary</button>
                <button type="button" class="settings-btn-primary" disabled>Disabled primary</button>
                <button type="button" class="settings-btn" disabled>Disabled secondary</button>
                <button type="button" class="settings-link" onclick={() => message = "Text button selected."}>Text button</button>
            </div>
            <p class="settings-hint">Hover, focus with Tab, and press buttons to check their states.</p>
        </div>
    </section>

    <section class="settings-page theme-test-sample" aria-labelledby="test-fields-title">
        <h3 id="test-fields-title">Forms</h3>
        <div class="settings-card theme-test-fields">
            <label class="settings-field">Text input<input class="settings-input" placeholder="Placeholder text"></label>
            <label class="settings-field">Disabled input<input class="settings-input" value="Disabled text" disabled></label>
            <label class="settings-field">Read-only input<input class="settings-input" value="Read-only text" readonly></label>
            <label class="settings-field">Select<select class="settings-input"><option>First option</option><option>Second option</option></select></label>
            <label class="settings-field">Text area<textarea class="settings-input settings-bio" placeholder="Write a description"></textarea></label>
            <label class="settings-field">Invalid input<input class="settings-input" value="Invalid example" aria-invalid="true" aria-describedby="test-field-error"></label>
            <p id="test-field-error" class="settings-theme-error">Example validation error. Please check this value.</p>
            <div class="theme-test-row">
                <label><input type="checkbox" checked> Checked</label>
                <label><input type="checkbox"> Unchecked</label>
                <label><input type="checkbox" checked disabled> Disabled</label>
            </div>
            <fieldset><legend>Radio options</legend><div class="theme-test-row">
                <label><input type="radio" name="test-radio" checked> First</label>
                <label><input type="radio" name="test-radio"> Second</label>
                <label><input type="radio" name="test-radio" disabled> Disabled</label>
            </div></fieldset>
            <p class="settings-success">Example success message.</p>
        </div>
    </section>

    <section id="test-banners" class="theme-test-banners" aria-labelledby="test-banners-title">
        <h3 id="test-banners-title">Status banners</h3>
        <div class="site-alert site-alert-info">Information banner with a <a href="#test-banners">link</a>.</div>
        {#if warningVisible}
            <div class="site-alert site-alert-warning site-alert-dismissible">Warning banner with a <a href="#test-banners">link</a>.<button class="site-alert-close" type="button" aria-label="Dismiss sample warning" onclick={() => warningVisible = false}>×</button></div>
        {:else}
            <button class="settings-btn" type="button" onclick={() => warningVisible = true}>Restore warning banner</button>
        {/if}
        <div class="site-alert site-alert-success">Success banner with a <a href="#test-banners">link</a>.</div>
        {#if noticeVisible}
            <div class="nonebux-notice" role="status"><span>Inline page notice, like the one after a checkout attempt.</span><button type="button" aria-label="Dismiss sample notice" onclick={() => noticeVisible = false}>×</button></div>
        {:else}
            <button class="settings-btn" type="button" onclick={() => noticeVisible = true}>Restore page notice</button>
        {/if}
    </section>

    <section aria-labelledby="test-cards-title">
        <h3 id="test-cards-title">Game cards</h3>
        <div class="games-page" onclick={sample} role="presentation">
            <ul class="theme-test-games"><GameCard {game} /><GameCard game={unplayed} /></ul>
        </div>
    </section>

    <section aria-labelledby="test-avatars-title">
        <h3 id="test-avatars-title">Avatars, assets, and badges</h3>
        <div class="home-page theme-test-sample" onclick={sample} role="presentation">
            <div class="home-sheet">
                <ul class="home-friends theme-test-avatar-list">
                    <li class="home-friend"><a class="home-friend-link" href="#test-avatars-title"><span class="home-friend-avatar"><img src="/img/DefaultThumb.png" alt="Sample home avatar"></span><span class="home-friend-name">Home friend</span></a></li>
                </ul>
            </div>
        </div>
        <div class="profile-page theme-test-sample" onclick={sample} role="presentation">
            <div class="profile-card">
                <ul class="profile-friend-list theme-test-avatar-list">
                    <li class="profile-friend"><div class="profile-friend-avatar"><a class="profile-friend-link" href="#test-avatars-title"><span class="profile-friend-thumb"><img src="/img/DefaultThumb.png" alt="Sample profile avatar"></span><span class="profile-friend-name">Profile friend</span></a></div></li>
                </ul>
                <ul class="profile-asset-list open theme-test-avatar-list">
                    <li class="profile-asset"><a href="#test-avatars-title"><img src="/img/pending.png" alt="Sample asset"><span class="profile-asset-name">Sample asset</span></a></li>
                    <li class="profile-asset"><a href="#test-avatars-title"><span class="profile-badge-icon profile-badge-friendship"></span><span class="profile-asset-name">Friendship badge</span></a></li>
                </ul>
            </div>
        </div>
        <div class="friends-page theme-test-sample" onclick={sample} role="presentation">
            <ul class="friends-cards"><li class="friends-card-item theme-test-friend">
                <div class="friends-card"><div class="friends-card-content">
                    <div class="friends-card-avatar"><a class="friends-card-avatar-link" href="#test-avatars-title"><img class="friends-card-image" src="/img/DefaultThumb.png" alt="Sample friend avatar"></a><span class="friends-card-status" title="Online"></span></div>
                    <div class="friends-card-caption"><div class="friends-card-name"><a href="#test-avatars-title">SampleFriend</a></div><div class="friends-card-label">Online</div><div class="friends-card-label">Website</div></div>
                </div></div>
            </li></ul>
        </div>
    </section>

    <section class="settings-page theme-test-sample" aria-labelledby="test-navigation-title">
        <h3 id="test-navigation-title">Tabs and menus</h3>
        <ul class="settings-tabs" aria-label="Sample sections">
            {#each ["Overview", "Details", "Activity"] as name}
                <li class="settings-tab" class:active={tab === name}><button type="button" aria-pressed={tab === name} onclick={() => tab = name}>{name}</button></li>
            {/each}
        </ul>
        <div class="settings-card"><p>{tab} sample content.</p>
            <details class="theme-test-menu">
                <summary class="settings-btn">Sample menu</summary>
                <div class="dropdown-menu show">
                    <button class="dropdown-item" type="button" onclick={() => message = "Menu item selected."}>Normal item</button>
                    <button class="dropdown-item active" type="button" onclick={() => message = "Active menu item selected."}>Active item</button>
                    <button class="dropdown-item" type="button" disabled>Disabled item</button>
                </div>
            </details>
            <p class="settings-hint theme-test-menu-label">Header settings menu (hover the items):</p>
            <div class="theme-test-header-menu" onclick={sample} role="presentation">
                <ul class="header-menu" role="menu">
                    <li><a href="#test-navigation-title">Admin</a></li>
                    <li><a href="#test-navigation-title">Settings</a></li>
                    <li><a href="#test-navigation-title">Logout</a></li>
                </ul>
            </div>
        </div>
    </section>

    <section aria-labelledby="test-table-title">
        <h3 id="test-table-title">Table</h3>
        <div class="table-responsive"><table class="table table-striped table-hover">
            <caption>Sample transactions</caption>
            <thead><tr><th scope="col">Item</th><th scope="col">Status</th><th scope="col">Amount</th></tr></thead>
            <tbody><tr><td>Sample shirt</td><td>Complete</td><td>10</td></tr><tr><td>Sample hat</td><td>Pending</td><td>25</td></tr><tr class="table-active"><td>Selected row</td><td>Selected</td><td>50</td></tr></tbody>
        </table></div>
    </section>

    <section aria-labelledby="test-states-title">
        <h3 id="test-states-title">Empty, loading, and error states</h3>
        <div class="profile-card"><span class="profile-empty">No items to display.</span></div>
        <div class="settings-card"><p class="settings-hint"><img src="/img/avatar/spinner.gif" width="16" height="16" alt=""> Loading sample content…</p></div>
        <div class="error-page">
            <div class="error-page-content"><div class="error-card">
                <div class="error-text"><h3 class="error-title">Sample page not found</h3><h4 class="error-message">404 <span>|</span>Page not found</h4></div>
                <img class="error-image" src="/img/builder.png" alt="">
                <div class="error-actions"><button type="button" class="btn-primary-md error-btn" onclick={() => message = "Sample Back selected."}>Back</button> <button type="button" class="error-btn-control error-btn" onclick={() => message = "Sample Home selected."}>Home</button></div>
            </div></div>
            <div class="error-page-content"><div class="error-card warning-card">
                <div class="error-text warning-text"><h3 class="error-title warning-title">Sample warning</h3><p class="warning-lead">A warning card with <strong>important text</strong> and supporting information.</p><ul class="warning-points"><li><strong>Example notice</strong>Check the heading, text, and button colors.</li></ul></div>
                <img class="error-image warning-image" src="/img/builder.png" alt="">
                <div class="error-actions warning-actions"><button type="button" class="btn-primary-md error-btn warning-button" onclick={() => message = "Sample Continue selected."}>Continue</button><button type="button" class="error-btn-control error-btn warning-quiet" onclick={() => message = "Sample Cancel selected."}>Cancel</button></div>
                <p class="warning-card-foot">Sample warning footer.</p>
            </div></div>
        </div>
    </section>

    <section aria-labelledby="test-dialog-title">
        <h3 id="test-dialog-title">Dialog</h3>
        <div class="settings-card"><button type="button" class="settings-btn" onclick={() => dialog.showModal()}>Open sample dialog</button><p class="settings-hint">Check the overlay, text, fields, buttons, and keyboard focus. Escape closes the dialog.</p></div>
    </section>

    <dialog bind:this={dialog} class="settings-modal-dialog theme-test-dialog" aria-labelledby="test-modal-title" onkeydown={dialogKeys}>
        <div class="settings-modal-header"><button type="button" class="settings-modal-close" aria-label="Close sample dialog" onclick={() => dialog.close()}></button><h4 id="test-modal-title">Sample dialog</h4></div>
        <form class="settings-modal-body" method="dialog" onsubmit={() => message = "Sample dialog confirmed."}>
            <p>This uses the site's settings dialog styles.</p>
            <label class="settings-field">Sample name<input class="settings-input" placeholder="Enter a name"></label>
            <p class="settings-modal-error">Example dialog validation message.</p>
            <div class="settings-modal-btns"><button class="settings-btn-primary" type="submit">Confirm</button> <button class="settings-btn" type="button" onclick={() => dialog.close()}>Cancel</button></div>
        </form>
    </dialog>
</main>
