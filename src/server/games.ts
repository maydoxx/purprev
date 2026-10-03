import type { User } from "./session";

export const GENRES = [
    "All",
    "Town and City",
    "Medieval",
    "Sci-Fi",
    "Fighting",
    "Horror",
    "Naval",
    "Adventure",
    "Sports",
    "Comedy",
    "Western",
    "Military",
    "Building",
    "FPS",
    "RPG"
];

export const GEAR = [
    ["MeleeWeapon", "Melee Weapons"],
    ["RangedWeapon", "Ranged Weapons"],
    ["Explosive", "Explosives"],
    ["PowerUp", "Power Ups"],
    ["NavigationEnhancer", "Navigation Enhancers"],
    ["MusicalInstrument", "Musical Instruments"],
    ["SocialItem", "Social Items"],
    ["BuildingTool", "Building Tools"],
    ["PersonalTransport", "Personal Transport"]
] as const;

export const GEAR_KEYS: string[] = GEAR.map(([key]) => key);

export const MAX_PLAYERS = 30;
export const MAX_PLAYERS_BC = 100;

export const PLACE_MAX = 50 * 1024 * 1024;
export const PLACE_MAX_BC = 100 * 1024 * 1024;

export const placeLimit = (user: User) => user.admin || user.membership !== "None" ? PLACE_MAX_BC : PLACE_MAX;

export const placeLimitLabel = (user: User) => `${placeLimit(user) / 1024 / 1024} MB`;

export const ACCESS = ["everyone", "friends", "private"] as const;

export const gearList = (csv: string | null | undefined) => (csv ?? "").split(",").map(s => s.trim()).filter(key => GEAR_KEYS.includes(key));

export const gearCsv = (keys: string[]) => GEAR_KEYS.filter(key => keys.includes(key)).join(",");

export const isGenre = (genre: unknown): genre is string => typeof genre === "string" && GENRES.includes(genre);

export const gameSettings = (game: any) => ({
    description: game.description ?? "",
    genre: isGenre(game.genre) ? game.genre : "All",
    max_players: Number(game.max_players) || 10,
    allowed_gear: gearList(game.allowed_gear),
    copylocked: Number(game.copylocked ?? 1) === 1,
    access: game.access ?? "everyone",
    featured: Number(game.featured ?? 0) === 1
});
