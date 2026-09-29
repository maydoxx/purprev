<script lang="ts">
    // same ids as roblox so the profile links work
    type Badge = [number, string, string, string];
    const categories: [string, Badge[]][] = [
        ["Membership Badges", [
            [18, "welcome-to-the-club", "Welcome To The Club", "This badge is awarded to players who belong to the illustrious Builders Club. These players are part of a long tradition of NoneRev greatness."],
            [11, "builders-club", "Builders Club", "Members of the illustrious Builders Club display this badge proudly. The Builders Club is a premium service paid for with NONEBUX. Members get ten places on their account instead of one, earn a daily income of 15 NONEBUX, can sell their creations to others in the NoneRev Catalog, and get the club only items."],
            [15, "turbo-builders-club", "Turbo Builders Club", "Members of the exclusive Turbo Builders Club are some of the most dedicated NoneRevians. Members receive the Builders Club benefits plus a few more: twenty-five places on their account instead of ten, a daily income of 35 NONEBUX, and the exclusive Turbo Builders Club items."],
            [16, "outrageous-builders-club", "Outrageous Builders Club", "Members of Outrageous Builders Club are VIP NoneRevians. They are the cream of the crop. Members receive 100 places, 100 groups, 60 NONEBUX per day, and many other benefits."]
        ]],
        ["Community Badges", [
            [1, "administrator", "Administrator", "This badge identifies an account as belonging to a NoneRev administrator. Only official NoneRev administrators will possess this badge. If someone claims to be an admin, but does not have this badge, they are potentially trying to mislead you. If this happens, please report abuse and we will delete the imposter's account."],
            [12, "veteran", "Veteran", "This badge recognizes members who have played NoneRev for one year or more. They are stalwart community members who have stuck with us over countless releases, and have helped shape NoneRev into the game that it is today. These medalists are the true steel, the core of the NoneRevian history ... and its future."],
            [2, "friendship", "Friendship", "This badge is given to players who have embraced the NoneRev community and have made at least 20 friends. People who have this badge are good people to know and can probably help you out if you are having trouble."],
            [14, "ambassador", "Ambassador", "This badge was awarded during the Ambassador Program, which ran from 2009 to 2012. It has been retired and is no longer attainable."],
            [8, "inviter", "Inviter", "This badge is awarded to players who brought a friend to NoneRev. Once someone signs up with one of your invite keys, the badge is yours."]
        ]],
        ["Developer Badges", [
            [6, "homestead", "Homestead", "The Homestead badge is earned by publishing your first place. Players who achieve this have shown they can build something and put it out there for other NoneRevians to visit. Get a jump-start on earning this reward by publishing from Studio."],
            [7, "bricksmith", "Bricksmith", "The Bricksmith badge is earned by being a prolific builder. Once you have five published places, you will receive this award. NoneRevians with Bricksmith badges are accomplished builders who no doubt know a thing or two about putting bricks together."],
            [17, "official-model-maker", "Official Model Maker", "This badge is awarded to players who published a model to the NoneRev toolbox. Owners of this badge probably have great scripting and building skills."]
        ]],
        ["Gamer Badges", [
            [3, "combat-initiation", "Combat Initiation", "This badge was granted when a player scored 10 victories in games that use classic combat scripts. It was retired Summer 2015 and is no longer attainable."],
            [4, "warrior", "Warrior", "This badge was granted when a player scored 100 or more victories in games that use classic combat scripts. It was retired Summer 2015 and is no longer attainable."],
            [5, "bloxxer", "Bloxxer", "This badge was granted when a player scored at least 250 victories, and fewer than 250 wipeouts, in games that use classic combat scripts. It was retired Summer 2015 and is no longer attainable."]
        ]]
    ];

    // router scrolls to top, jump after mount
    $effect(() => {
        const id = location.hash.slice(1);
        if (id) {
            document.getElementById(id)?.scrollIntoView();
        }
    });
</script>

<svelte:head>
    <title>Badges - NoneRev</title>
    <link rel="stylesheet" href="/css/badges.css">
</svelte:head>

<main class="rbx-content">
    <div id="BadgesContainer" class="text">
        <h1>Badges</h1>
        {#each categories as [title, badges]}
            <div class="BadgeCategory">
                <h2>{title}</h2>
                <ul>
                    {#each badges as [n, slug, name, text]}
                        <li id="Badge{n}" class="divider-bottom">
                            <div class="BadgePadding">&nbsp;</div>
                            <div class="BadgeContent">
                                <div class="BadgeImage">
                                    <img src="/img/badges/{slug}.png" alt={name} width="75" height="75">
                                </div>
                                <div class="BadgeDescription">
                                    <h3>{name} Badge</h3>
                                    <p>{text}</p>
                                </div>
                                <div style="clear:both"></div>
                            </div>
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>
</main>
