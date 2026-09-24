<script lang="ts">
    let { game }: { game: any } = $props();

    const icon = $derived(game.icon || "/img/DefaultPlaceIcon.jpg");
    const playing = $derived(Number(game.playing) || 0);
    const ratio = $derived(Math.max(0, Math.min(100, Number(game.like_ratio) || 0)));
</script>

<li class="game-card">
    <div class="game-card-inner">
        <a href="/game?id={game.id}" class="game-card-link">
            <div class="game-card-thumb">
                <img alt={game.title} src={icon}>
            </div>
            <div class="game-card-name" title={game.title}>{game.title}</div>
            <div class="game-card-playing">{playing.toLocaleString()} Playing</div>
            <div class="game-card-votes">
                <div class="vote-bar">
                    <div class="vote-thumb up"><i class="bi bi-hand-thumbs-up"></i></div>
                    <div class="vote-track">
                        <div class="vote-background"></div>
                        <div class="vote-fill" style="width: {ratio}%;"></div>
                        <div class="vote-mark" style="left: 18%;"></div>
                        <div class="vote-mark" style="left: 38%;"></div>
                        <div class="vote-mark" style="left: 58%;"></div>
                        <div class="vote-mark" style="left: 78%;"></div>
                    </div>
                    <div class="vote-thumb down"><i class="bi bi-hand-thumbs-down"></i></div>
                </div>
            </div>
        </a>
    </div>
</li>
