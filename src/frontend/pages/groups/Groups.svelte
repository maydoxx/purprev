<script lang="ts">
    import { router } from "../../router.svelte";
    import Group from "./Group.svelte";
    import My from "./My.svelte";

    const groupId = $derived(Number(router.query.id) || 0);
</script>

{#if groupId > 0}
    <Group />
{:else}
    <My />
{/if}
