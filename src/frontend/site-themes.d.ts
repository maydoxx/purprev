declare module "virtual:site-themes" {
    const meta: Record<string, import("../../scripts/site-themes.ts").ThemeMeta>;
    export default meta;
}
