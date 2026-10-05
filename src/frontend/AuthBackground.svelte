<script lang="ts">
    import { onMount, type Snippet } from "svelte";
    import { api } from "./api";
    import { session } from "./session.svelte";
    import { router } from "./router.svelte";
    import { failed } from "./pages/Login.svelte";

    let { children, tall = false }: { children: Snippet; tall?: boolean } = $props();

    const links: HTMLAnchorElement[] = [];

    let y = $state(0);
    let open = $state(false);
    let line = $state({
        left: 0,
        width: 0
    });
    let username = $state("");
    let password = $state("");
    let tried = $state(false);
    let busy = $state(false);

    const shade = $derived(open || y > 75 ? .85 : .35 + y / 150);

    const track = () => {
        const tab = ["about", "platforms"].filter(id => {
            const el = document.getElementById(id);
            return el && el.getBoundingClientRect().top <= 66;
        }).length;
        const a = links[tab];
        if (a) {
            line = {
                left: a.offsetLeft,
                width: a.offsetWidth
            };
        }
    };

    onMount(() => {
        track();
        document.fonts.ready.then(track);
    });

    const jump = (e: MouseEvent, id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        window.scrollTo({
            top: el.getBoundingClientRect().top + window.scrollY,
            behavior: "smooth"
        });
    };

    const login = async (e: Event) => {
        e.preventDefault();
        tried = true;
        if (!username || !password) return;
        busy = true;
        try {
            const res = await api("/auth/login", {
                username,
                password
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            failed.username = username;
            failed.error = err.message;
            router.go("/login");
        } finally {
            busy = false;
        }
    };
</script>

<svelte:window bind:scrollY={y} onscroll={track} onresize={track} />

<div class="landing-navbar" style:background-color="rgba(0, 0, 0, {shade})">
    <div class="landing-navbar-inner">
        <div class="landing-navbar-left">
            <a class="landing-brand" href="/" title="NoneRev"><img src="/img/noneRevSmall.png" alt="NoneRev"></a>
            <ul class="landing-nav">
                <li><a href="/#play" bind:this={links[0]} onclick={e => jump(e, "play")}>Play</a></li>
                <li><a href="/#about" bind:this={links[1]} onclick={e => jump(e, "about")}>About</a></li>
                <li><a href="/#platforms" bind:this={links[2]} onclick={e => jump(e, "platforms")}>Platforms</a></li>
                <li class="landing-nav-line" style:left="{line.left}px" style:width="{line.width}px"></li>
            </ul>
            <button type="button" class="landing-toggle" aria-expanded={open} onclick={() => open = !open}>Log In</button>
        </div>
        <form class="landing-login" class:open onsubmit={login} novalidate>
            <input class="landing-login-input" class:landing-login-missing={tried && !username} type="text" placeholder="Username" aria-label="Username" autocomplete="username" maxlength="20" bind:value={username} onkeyup={() => tried = true} onpaste={() => tried = true}>
            <input class="landing-login-input" class:landing-login-missing={tried && !password} type="password" placeholder="Password" aria-label="Password" autocomplete="current-password" bind:value={password} onkeyup={() => tried = true} onpaste={() => tried = true}>
            <button type="submit" class="landing-login-button" disabled={busy}>Log In</button>
            <a class="landing-forgot" href="/discord" target="_blank" rel="noreferrer">Forgot Username/Password?</a>
        </form>
    </div>
</div>

<section class="landing-hero" class:landing-hero-tall={tall} id="play">
    <img class="landing-hero-image" src="/img/hello.png" alt="" aria-hidden="true">
    <div class="landing-hero-row">
        <div class="landing-hero-half">
            <div class="landing-logo">
                <div class="landing-logo-box">
                    <img src="/img/nonelogo.png" width="2739" height="793" alt="None.">
                    <h1>A Revival that goes for the win.</h1>
                </div>
            </div>
        </div>
        <div class="landing-hero-half">
            {@render children()}
        </div>
    </div>
</section>
