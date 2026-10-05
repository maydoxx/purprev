<script module lang="ts">
    export const failed = $state({
        username: "",
        error: ""
    });
</script>

<script lang="ts">
    import Header from "../Header.svelte";
    import Banners from "../Banners.svelte";
    import Footer from "../Footer.svelte";
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let username = $state(failed.username);
    let password = $state("");
    let error = $state(failed.error);
    let busy = $state(false);

    failed.username = "";
    failed.error = "";

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        busy = true;
        try {
            const res = await api("/auth/login", {
                username,
                password
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            error = err.message;
        } finally {
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>Log In - None.</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<div class="login-page">
    <Header />
    <Banners />
    <div class="login-body">
        <h1>Login to NoneRev</h1>
        <form class="login-area" onsubmit={submit}>
            <div class="login-left">
                <div class="login-panel">
                    {#if error}
                        <div class="login-error" role="alert">{error}</div>
                    {/if}
                    <table class="login-table">
                        <tbody>
                            <tr>
                                <td><label for="username">Username:</label></td>
                                <td><input id="username" name="username" type="text" required autocomplete="username" maxlength="20" bind:value={username}></td>
                            </tr>
                            <tr>
                                <td><label for="password">Password:</label></td>
                                <td><input id="password" name="password" type="password" required autocomplete="current-password" bind:value={password}></td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="login-actions">
                        <div class="login-forgot">
                            <a href="/discord" target="_blank" rel="noreferrer">Forgot your password?</a>
                        </div>
                        <button type="submit" class="login-button" disabled={busy}>Sign In</button>
                    </div>
                </div>
            </div>
            <div class="login-right">
                <div class="login-signup">
                    <p>Not a member?</p>
                    <h2>Sign Up to Build &amp; Make Friends</h2>
                    <a class="login-button login-button-green" href="/signup">Sign Up</a>
                </div>
            </div>
        </form>
        <div class="login-guest">
            <h2>No invite key? Apply to join NoneRev</h2>
            <br>
            <p>Tell us a bit about you, and once we say yes the account is yours. <a class="login-button login-button-small" href="/apply">Apply</a></p>
        </div>
    </div>
    <Footer />
</div>
