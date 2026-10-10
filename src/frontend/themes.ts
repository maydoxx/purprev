export const themes = ["auto", "classic", "dark", "halloween", "sakura"] as const;

export type Theme = typeof themes[number];

export const isTheme = (name: unknown): name is Theme => themes.includes(name as Theme);

export const seasonal = (date: Date) => {
    const month = date.getMonth();
    if (month === 9) {
        return "halloween";
    }
    if (month === 2 || month === 3) {
        return "sakura";
    }
    return "classic";
};

export const resolve = (theme: Theme, date: Date) => theme === "auto" ? seasonal(date) : theme;
