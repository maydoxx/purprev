declare module "virtual:site-themes" {
    const meta: Record<string, import("../../opsec/scripts/site-themes.ts").ThemeMeta>;
    export default meta;
}
