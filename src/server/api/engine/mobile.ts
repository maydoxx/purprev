import { Elysia, t } from "elysia";
import { stub } from "../stub";

// 1x1 gif
const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// android client, everything has to be json
const mobileapi = new Elysia({ prefix: "/mobileapi" })
    // Status: OK / MissingRequiredField / InvalidUsername / InvalidPassword
    .post("/login", stub, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        })
    })

    // Status strings are in signup/SignUpResult.java
    // TODO: add invite key to client
    .post("/securesignup", stub, {
        body: t.Object({
            userName: t.String(),
            password: t.String(),
            gender: t.Optional(t.String()),
            dateOfBirth: t.Optional(t.String()),
            email: t.Optional(t.String())
        })
    })

    .get("/userinfo", stub)

    .all("/logout", () => ({
        Status: "OK"
    }))

    .all("/check-app-version", () => ({
        UpgradeAction: 0,
        message: ""
    }))

// signup form checks these as you type
const usercheck = new Elysia({ prefix: "/UserCheck" })
    // data 0 = ok
    .get("/checkifinvalidusernameforsignup", stub, {
        query: t.Object({
            username: t.String()
        })
    })

    // min 6 chars and not the username
    .post("/validatepasswordforsignup", stub, {
        body: t.Object({
            password: t.String(),
            username: t.Optional(t.String())
        })
    })

export const mobile = new Elysia()
    .use(mobileapi)
    .use(usercheck)

    // AgeBracket 1 = under 13, 2 = 13+
    // TODO: real email
    .get("/my/account/json", () => ({
        AgeBracket: 2,
        UserEmail: "",
        UserEmailVerified: false
    }))

    .all("/api/signupmobile/is-username-valid", stub)

    // app spams these on launch, 404 makes it slow so just answer
    .all("/device/initialize", () => ({
        success: true,
        deviceId: ""
    }))

    .all("/notifications/account", () => ({
        success: true,
        notifications: []
    }))

    .all("/sponsoredpage/list-json", () => [])

    .all("/v1.1/Counters/Increment", () => ({
        success: true
    }))

    .get("/pe.png", () => new Response(pixel, {
        headers: {
            "Content-Type": "image/gif"
        }
    }))
