<script lang="ts">
    import { tick } from "svelte";
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
    let errors = $state<Record<string, string>>({});
    let error = $state("");
    let busy = $state(false);
    let closed = $state(false);
    let status = $state<any>(null);
    let missing = $state(false);
    let siteKey = $state("");
    let turnstile = $state("");
    let captcha = $state<Turnstile>();
    let warning = $state<HTMLDivElement>();

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

    const fieldOf = (message: string) => {
        if (/match/i.test(message)) return "confirmpassword";
        if (/password/i.test(message)) return "password";
        if (/username/i.test(message)) return "name";
        if (/discord/i.test(message)) return "discord";
        if (/found us/i.test(message)) return "found";
        if (/why you/i.test(message)) return "why";
        if (/yourself/i.test(message)) return "about";
        if (/socials/i.test(message)) return "socials";
        return "";
    };

    const submit = async (e: Event) => {
        e.preventDefault();
        errors = {};
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
            const field = fieldOf(err.message);
            if (field) {
                errors = {
                    [field]: err.message
                };
            } else {
                error = err.message;
            }
            captcha?.reset();
            await tick();
            if (field) document.getElementById(field)?.focus();
            else warning?.scrollIntoView({ block: "center" });
        } finally {
            busy = false;
        }
    };

    const again = () => {
        remember("");
        router.go("/apply?new=1");
    };

    const headline = $derived.by(() => {
        if (!status) return "Your application";
        if (status.status === "approved") return `You are in, ${status.name}!`;
        if (status.status === "denied") return `Not this time, ${status.name}`;
        return `Hang tight, ${status.name}`;
    });

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

<AuthBackground tall>
    <div class="auth-panel">
        {#if token}
            <h3>{headline}</h3>
            <div class="auth-panel-body">
                {#if missing}
                    <div class="auth-alert" role="alert">No application matches that link.</div>
                    <p class="auth-note"><a href="/apply?new=1">Apply</a> or go <a href="/">home</a>.</p>
                {:else if !status}
                    <p class="auth-note">Loading…</p>
                {:else}
                    <div class="apply-status {status.status}">
                        <div class="apply-status-icon">
                            {#if status.status === "approved"}✓{:else if status.status === "denied"}✕{:else}…{/if}
                        </div>
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
                            <blockquote class="apply-reason">{status.reason}</blockquote>
                        {/if}
                    </div>
                    {#if status.status === "approved"}
                        <a href="/login" class="auth-button">Log In</a>
                    {:else if status.status === "denied"}
                        <button type="button" class="auth-button" onclick={again}>Apply Again</button>
                    {:else}
                        <p class="auth-note">Bookmark this page or come back to /apply on this browser, it remembers you.</p>
                    {/if}
                {/if}
                <p class="auth-note"><a href="/">Back to the site</a></p>
            </div>
        {:else}
            <h3>Apply to join</h3>
            <div class="auth-panel-body">
                <p class="apply-intro">No invite key? Pick your username and password, tell us a bit about you, and once we say yes the account is yours.</p>
                {#if closed}
                    <div class="auth-alert" role="alert">Applications are closed right now, check back later.</div>
                {:else}
                    <form onsubmit={submit}>
                        <h4 class="apply-title">Your Account</h4>
                        <input id="name" class="auth-input" class:auth-input-error={errors.name} type="text" required maxlength="20" autocomplete="off" aria-label="Username" placeholder="Username (length 3-20, letters and numbers)" bind:value={name}>
                        <p class="auth-input-message">{errors.name ?? ""}</p>
                        <input id="discord" class="auth-input" class:auth-input-error={errors.discord} type="text" required maxlength="40" autocomplete="off" aria-label="Discord" placeholder="Discord" bind:value={discord}>
                        <p class="auth-input-message">{errors.discord ?? ""}</p>
                        <input id="password" class="auth-input" class:auth-input-error={errors.password} type="password" required autocomplete="new-password" aria-label="Password" placeholder="Password (minimum length 8)" bind:value={password}>
                        <p class="auth-input-message">{errors.password ?? ""}</p>
                        <input id="confirmpassword" class="auth-input" class:auth-input-error={errors.confirmpassword} type="password" required autocomplete="new-password" aria-label="Confirm Password" placeholder="Confirm Password" bind:value={confirmpassword}>
                        <p class="auth-input-message">{errors.confirmpassword ?? ""}</p>
                        <input id="email" class="auth-input" type="email" maxlength="120" autocomplete="email" aria-label="Email" placeholder="Email (optional)" bind:value={email}>
                        <p class="auth-input-message"></p>
                        <input id="socials" class="auth-input" class:auth-input-error={errors.socials} type="text" required maxlength="500" aria-label="Your socials" placeholder="Your socials (reddit, roblox profile, anything)" bind:value={socials}>
                        <p class="auth-input-message">{errors.socials ?? ""}</p>

                        <h4 class="apply-title">Why Us?</h4>
                        <label class="apply-question" for="found">Where did you find us?</label>
                        <input id="found" class="auth-input" class:auth-input-error={errors.found} type="text" required maxlength="200" placeholder="a friend, youtube, ..." bind:value={found}>
                        <p class="auth-input-message">{errors.found ?? ""}</p>
                        <label class="apply-question" for="why">Why do you want to play NoneRev specifically?</label>
                        <textarea id="why" class="auth-input" class:auth-input-error={errors.why} required minlength="20" maxlength="1000" rows="3" placeholder="A few sentences is plenty" bind:value={why}></textarea>
                        <p class="auth-input-message">{errors.why ?? ""}</p>
                        <label class="apply-question" for="revivals">What other revivals did you play before?</label>
                        <input id="revivals" class="auth-input" type="text" maxlength="500" placeholder="none is fine" bind:value={revivals}>
                        <p class="auth-input-message"></p>
                        <label class="apply-question" for="about">Could you tell us something about yourself?</label>
                        <textarea id="about" class="auth-input" class:auth-input-error={errors.about} required minlength="20" maxlength="1000" rows="3" placeholder="What you like to build or play, how long you have been around, anything" bind:value={about}></textarea>
                        <p class="auth-input-message">{errors.about ?? ""}</p>

                        <p class="auth-legal">By applying you agree to our <a href="/info/tos" target="_blank">Terms</a> and <a href="/info/privacy" target="_blank">Privacy Policy</a></p>
                        <Turnstile bind:this={captcha} {siteKey} bind:token={turnstile} />
                        <button type="submit" class="auth-button" disabled={busy || (!!siteKey && !turnstile)}>Send Application</button>
                        {#if error}
                            <div class="auth-alert" role="alert" bind:this={warning}>{error}</div>
                        {/if}
                    </form>
                {/if}
                <p class="auth-note">Already have a key? <a href="/signup">Sign Up</a> &middot; Already applied? <a href="/apply">Check your status</a></p>
            </div>
        {/if}
    </div>
</AuthBackground>
