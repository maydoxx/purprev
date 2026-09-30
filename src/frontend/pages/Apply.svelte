<script lang="ts">
    import AuthBackground from "../AuthBackground.svelte";
    import Turnstile from "../Turnstile.svelte";
    import { api } from "../api";
    import { router } from "../router.svelte";

    const KEY = "nonerev-application";
    const token = $derived(router.query.token ?? "");
    const fresh = $derived(router.query.new === "1");

    let name = $state("");
    let discord = $state("");
    let email = $state("");
    let found = $state("");
    let why = $state("");
    let revivals = $state("");
    let about = $state("");
    let socials = $state("");
    let password = $state("");
    let confirmpassword = $state("");
    let error = $state("");
    let busy = $state(false);
    let closed = $state(false);
    let status = $state<any>(null);
    let missing = $state(false);
    let siteKey = $state("");
    let turnstile = $state("");
    let captcha = $state<Turnstile>();

    api("/site/settings").then(d => {
        closed = !d.applications_enabled;
        siteKey = d.turnstile_site_key ?? "";
    }).catch(() => {});

    const remembered = () => {
        try {
            return localStorage.getItem(KEY) ?? "";
        } catch {
            return "";
        }
    };

    const remember = (t: string) => {
        try {
            if (t) localStorage.setItem(KEY, t);
            else localStorage.removeItem(KEY);
        } catch {}
    };

    $effect(() => {
        if (!token && !fresh) {
            const t = remembered();
            if (t) router.replace(`/apply?token=${t}`);
        }
    });

    $effect(() => {
        status = null;
        missing = false;
        if (!token) return;
        api(`/applications/status?token=${token}`).then(d => status = d).catch(() => {
            missing = true;
            if (remembered() === token) remember("");
        });
    });

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        busy = true;
        try {
            const d = await api("/applications", {
                name,
                discord,
                email,
                found,
                why,
                revivals,
                about,
                socials,
                password,
                confirmpassword,
                turnstile
            });
            remember(d.token);
            router.go(`/apply?token=${d.token}`);
        } catch (err: any) {
            error = err.message;
            captcha?.reset();
            window.scrollTo(0, 0);
        } finally {
            busy = false;
        }
    };

    const again = () => {
        remember("");
        router.go("/apply?new=1");
    };

    const when = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
</script>

<svelte:head>
    <title>Apply - None.</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<AuthBackground />
<main class="none-auth-main none-apply" class:none-apply-wide={!token}>
    <div class="none-auth-container">
        <a href="/" class="none-auth-logo-link"><img src="/img/nonelogo.png" alt="None."></a>
        <div class="none-auth-panel">
            {#if token}
                {#if missing}
                    <h1>Your Application</h1>
                    <div class="none-auth-error" role="alert">No application matches that link.</div>
                    <p class="none-auth-note"><a href="/apply?new=1">Apply</a> or go <a href="/">home</a>.</p>
                {:else if !status}
                    <h1>Your Application</h1>
                    <p class="none-auth-note">Loading…</p>
                {:else}
                    <div class="none-apply-status {status.status}">
                        <div class="none-apply-status-icon">
                            {#if status.status === "approved"}✓{:else if status.status === "denied"}✕{:else}…{/if}
                        </div>
                        <h1>
                            {#if status.status === "approved"}You are in, {status.name}!
                            {:else if status.status === "denied"}Not this time, {status.name}
                            {:else}Hang tight, {status.name}{/if}
                        </h1>
                        <p>
                            {#if status.status === "approved"}
                                Your account is ready with the password you picked. Welcome to NoneRev.
                            {:else if status.status === "denied"}
                                Your application was not accepted{#if status.reason}, here is why{:else}.{/if}
                            {:else}
                                Sent {when(status.created_at)}. Someone on the team will read it soon, this page updates by itself when they do.
                            {/if}
                        </p>
                        {#if status.status === "denied" && status.reason}
                            <blockquote class="none-apply-reason">{status.reason}</blockquote>
                        {/if}
                    </div>
                    {#if status.status === "approved"}
                        <a href="/login" class="none-auth-button">Log In</a>
                    {:else if status.status === "denied"}
                        <button type="button" class="none-auth-button" onclick={again}>Apply Again</button>
                    {:else}
                        <p class="none-auth-note">Bookmark this page or come back to /apply on this browser, it remembers you.</p>
                    {/if}
                {/if}
                <p class="none-auth-note"><a href="/">Back to the site</a></p>
            {:else}
                <h1>Apply to Join</h1>
                <p class="none-apply-intro">No invite key? Pick your username and password, tell us a bit about you, and once we say yes the account is yours.</p>
                {#if error}<div class="none-auth-error" role="alert">{error}</div>{/if}
                {#if closed}
                    <div class="none-auth-error" role="alert">Applications are closed right now, check back later.</div>
                {:else}
                    <form onsubmit={submit}>
                        <h2 class="none-auth-subtitle">Your Account</h2>
                        <div class="none-apply-grid">
                            <div class="none-auth-field">
                                <label for="name">Username</label>
                                <input id="name" type="text" required maxlength="20" autocomplete="off" bind:value={name} placeholder="3 to 20 letters or numbers">
                            </div>
                            <div class="none-auth-field">
                                <label for="discord">Discord</label>
                                <input id="discord" type="text" required maxlength="40" autocomplete="off" bind:value={discord} placeholder="so we can reach you">
                            </div>
                            <div class="none-auth-field">
                                <label for="password">Password</label>
                                <input id="password" type="password" required autocomplete="new-password" bind:value={password} placeholder="At least 8 characters">
                            </div>
                            <div class="none-auth-field">
                                <label for="confirm-password">Confirm Password</label>
                                <input id="confirm-password" type="password" required autocomplete="new-password" bind:value={confirmpassword} placeholder="Same again">
                            </div>
                            <div class="none-auth-field">
                                <label for="email">Email <span>optional</span></label>
                                <input id="email" type="email" maxlength="120" autocomplete="email" bind:value={email} placeholder="you@example.com">
                            </div>
                            <div class="none-auth-field">
                                <label for="socials">Your socials</label>
                                <input id="socials" type="text" required maxlength="500" bind:value={socials} placeholder="reddit, roblox profile, anything">
                            </div>
                        </div>

                        <h2 class="none-auth-subtitle">Why Us?</h2>
                        <div class="none-auth-field">
                            <label for="found">Where did you find us?</label>
                            <input id="found" type="text" required maxlength="200" bind:value={found} placeholder="a friend, youtube, ...">
                        </div>
                        <div class="none-auth-field">
                            <label for="why">Why do you want to play NoneRev specifically?</label>
                            <textarea id="why" required minlength="20" maxlength="1000" rows="3" bind:value={why} placeholder="A few sentences is plenty"></textarea>
                        </div>
                        <div class="none-auth-field">
                            <label for="revivals">What other revivals did you play before?</label>
                            <input id="revivals" type="text" maxlength="500" bind:value={revivals} placeholder="none is fine">
                        </div>
                        <div class="none-auth-field">
                            <label for="about">Could you tell us something about yourself?</label>
                            <textarea id="about" required minlength="20" maxlength="1000" rows="3" bind:value={about} placeholder="What you like to build or play, how long you have been around, anything"></textarea>
                        </div>
                        <Turnstile bind:this={captcha} {siteKey} bind:token={turnstile} />
                        <button type="submit" class="none-auth-button" disabled={busy || (!!siteKey && !turnstile)}>{busy ? "Please wait…" : "Send Application"}</button>
                    </form>
                {/if}
                <p class="none-auth-note">Already have a key? <a href="/signup">Sign Up</a> &middot; Already applied? <a href="/apply">Check your status</a></p>
            {/if}
        </div>
    </div>
</main>
