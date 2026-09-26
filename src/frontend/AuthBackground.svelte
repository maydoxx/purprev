<script lang="ts">
    let { landing = false } = $props<{ landing?: boolean }>();
</script>

<video class="none-auth-video" autoplay muted loop playsinline aria-hidden="true" poster="/img/DefaultThumb.png">
    <source src="https://cdn.mrrpmeowfurry.dev/uploads/2026-09-07%2022-07-03.mp4" type="video/mp4">
</video>
<div class="none-auth-overlay" class:landing-overlay={landing}></div>
