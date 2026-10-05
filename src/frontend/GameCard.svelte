<script lang="ts" module>
    // wires the two arrows of a .game-sort-row, a card with its gap is 166px
    export const sortRow = (row: HTMLElement) => {
        const scroller = row.querySelector<HTMLElement>(".game-sort-scroller")!;
        const [prev, next] = row.querySelectorAll<HTMLElement>(".game-sort-arrow");
        const update = () => {
            prev.hidden = scroller.scrollLeft <= 0;
            next.hidden = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 5;
        };
        const move = (direction: number) => {
            const cards = Math.max(1, Math.floor(scroller.clientWidth / 166));
            scroller.scrollBy({
                left: direction * cards * 166,
                behavior: "smooth"
            });
        };
        const sizes = new ResizeObserver(update);
        sizes.observe(scroller);
        sizes.observe(scroller.firstElementChild!);
        scroller.addEventListener("scroll", update);
        prev.addEventListener("click", () => move(-1));
        next.addEventListener("click", () => move(1));
        return {
            destroy() {
                sizes.disconnect();
            }
        };
    };
</script>

<script lang="ts">
    let { game }: { game: any } = $props();

    const icon = $derived(game.icon || "/img/DefaultPlaceIcon.jpg");
    const playing = $derived(Number(game.playing) || 0);
    const up = $derived(Number(game.up_votes) || 0);
    const down = $derived(Number(game.down_votes) || 0);
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
            <div class="game-card-votes" class:voted={up + down > 0}>
                <span class="vote-thumb up"></span>
                <div class="vote-track">
                    <div class="vote-background"></div>
                    <div class="vote-fill" style="width: {ratio}%;"></div>
                    <div class="vote-mask">
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
                <span class="vote-thumb down"></span>
            </div>
            {#if game.up_votes !== undefined}
                <div class="game-card-counts">
                    <span class="vote-count-up">{up.toLocaleString()}</span>
                    <span class="vote-count-down">{down.toLocaleString()}</span>
                </div>
            {/if}
        </a>
        {#if game.creator_name}
            <div class="game-card-footer">
                <span class="game-card-creator">
                    <span class="game-card-by">By</span>
                    <a href="/user?id={game.creator_id}">{game.creator_name}</a>
                </span>
            </div>
        {/if}
    </div>
</li>
