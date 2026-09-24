export type ForumCategory = {
    id: number;
    name: string;
    description: string;
};

export const FORUM_GROUPS: Record<string, ForumCategory[]> = {
    "None": [
        { id: 1, name: "All Things None", description: "The area for discussions purely about None, the features, the games, and project news." },
        { id: 2, name: "Help (Technical Support and Account Issues)", description: "Seeking account or technical help? Post your questions here." },
        { id: 3, name: "Suggestions & Ideas", description: "Do you have a suggestion or idea for None? Share your feedback here." },
        { id: 4, name: "Game Nights & None Events", description: "Check here to see the events happening around None. Discuss game nights, contests, updates, and community events here." }
    ],
    "Club Houses": [
        { id: 5, name: "None Talk", description: "A popular hangout where None users talk about various topics." },
        { id: 6, name: "Off Topic", description: "When no other forum makes sense for your post, Off Topic will help it make even less sense." },
        { id: 7, name: "Clans & Guilds", description: "Talk about what's going on in your Clans, Groups, Companies, and Guilds, and about the Groups feature in general." },
        { id: 8, name: "Let's Make a Deal", description: "A fast paced community dedicated to mastering the Limited Trades and Sales market and the currency exchange." }
    ],
    "Game Creation and Development": [
        { id: 9, name: "Game Marketing", description: "Show off your creations, talk about advertising, and share your marketing and sales tactics." },
        { id: 10, name: "Game Design", description: "Talk about game mechanics, level design, balance, and what makes a game fun." },
        { id: 11, name: "Scripting Helpers", description: "Get help with Lua scripting and game code." },
        { id: 12, name: "Building Helpers", description: "Get help with Studio, building, modeling, and creation tools." }
    ],
    "Entertainment": [
        { id: 13, name: "Movies / TV / Books", description: "Discuss movies, television, books, comics, and other media." },
        { id: 14, name: "Sports", description: "Talk about sports, teams, players, and competitions." },
        { id: 15, name: "Music", description: "Discuss music, artists, songs, instruments, and production." },
        { id: 16, name: "Role-Playing", description: "Create and join forum role-plays, stories, and character discussions." }
    ]
};

export const forumCategory = (id: number) => {
    for (const [section, forums] of Object.entries(FORUM_GROUPS)) {
        const forum = forums.find(f => f.id === id);
        if (forum) {
            return {
                ...forum,
                section
            };
        }
    }
    return null;
};
