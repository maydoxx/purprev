import { Elysia } from "elysia";

export const settings = new Elysia({ prefix: "/Setting/QuietGet" })
    // TODO: bring the flags over from webtty/Setting/QuietGet/ClientAppSettings/index.php
    .get("/ClientAppSettings", () => ({}))

    // TODO: same, webtty/Setting/QuietGet/ClientSharedSettings/index.php
    .get("/ClientSharedSettings", () => ({}))

    // keep the first two false or the app looks for an api. subdomain
    .get("/AndroidAppSettings", () => ({
        EnableLoginLogoutSignupWithApi: false,
        EnableXBOXSignupRules: false,
        EnableSessionLogin: false,
        EnableSignupCaptcha: false,
        EnableLoginCaptcha: false,
        EnableAdColony: false,
        EnableFlurry: false,
        EnableGoogleAnalytics: false,
        EnableCrashlytics: false,
        EnableInAppPurchase: false,
        EnableUpgradeCheck: false
    }))
