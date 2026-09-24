<script lang="ts">
    import type { Snippet } from "svelte";
    import { session } from "../../session.svelte";
    import Nav from "./Nav.svelte";

    let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
    <title>{title} - NoneRev</title>
    <link rel="stylesheet" href="/css/admin.css">
</svelte:head>

{#if !session.me || session.me.admin < 1}
    <main class="admin-wrap">
        <div class="alert alert-danger">You are not allowed here.</div>
    </main>
{:else}
    <Nav />
    <main class="admin-wrap">
        {@render children()}
    </main>
{/if}
