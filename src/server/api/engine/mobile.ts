import { Elysia, t } from "elysia";
import { session, getUser } from "../../session";
import { sql, now } from "../../db";
import { mediaUrl } from "../../paths";
import { SITE_URL } from "../../site";
import { rcc } from "../../rcc";

// 1x1 gif
const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

// every field has to be there or the app logs itself back out
const userInfo = async (id: number) => {
    const user = await getUser(id);
    if (!user) {
        return null;
    }
    const headshot = await mediaUrl("headshots", id);
    return {
        UserID: user.id,
        UserName: user.username,
        RobuxBalance: user.currency,
        TicketsBalance: 0,
        ThumbnailUrl: headshot ? (headshot.startsWith("/") ? SITE_URL + headshot : headshot) : SITE_URL + "/img/pending.png",
        IsAnyBuildersClubMember: false,
        IsPremium: false
    };
};

// android client, everything has to be json
const mobileapi = new Elysia({ prefix: "/mobileapi" })
    .use(session)

    // Status: OK / MissingRequiredField / InvalidUsername / InvalidPassword
    .post("/login", async ({ body, login }) => {
        const username = body.username.trim();
        if (username === "" || body.password === "") {
            return {
                Status: "MissingRequiredField"
            };
        }
        const [row] = await sql`SELECT id, password FROM users WHERE username = ${username}`;
        if (!row) {
            return {
                Status: "InvalidUsername"
            };
        }
        if (!(await Bun.password.verify(body.password, row.password))) {
            return {
                Status: "InvalidPassword"
            };
        }
        await login(row.id);
        return {
            Status: "OK",
            UserInfo: await userInfo(row.id)
        };
    }, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        })
    })

    // Status strings are in signup/SignUpResult.java
    // TODO: add invite key to client, until then the app cant sign up
    .post("/securesignup", async ({ body, login }) => {
        const username = body.userName.trim();
        if (username === "" || body.password === "") {
            return {
                Status: "MissingRequiredField"
            };
        }
        if (username.includes(" ")) {
            return {
                Status: "UsernameCannotContainSpaces"
            };
        }
        if (!USERNAME.test(username)) {
            return {
                Status: "UsernameContainsInvalidCharacters"
            };
        }
        const [taken] = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (taken) {
            return {
                Status: "UsernameTaken"
            };
        }
        if (body.password.length < 6) {
            return {
                Status: "PasswordInvalid"
            };
        }
        const deleted = await sql`DELETE FROM invites WHERE inviteKey = ${body.inviteKey ?? ""}`;
        if (!deleted.affectedRows) {
            return {
                Status: "StatusServerError",
                error: "invite key needed"
            };
        }

        const hash = await Bun.password.hash(body.password, "bcrypt");
        const created = await sql`INSERT INTO users (username, password, created_at) VALUES (${username}, ${hash}, ${now()})`;
        const id = Number(created.lastInsertRowid);
        rcc.render.avatar(id);
        await login(id);
        return {
            Status: "OK",
            UserInfo: await userInfo(id)
        };
    }, {
        body: t.Object({
            userName: t.String(),
            password: t.String(),
            gender: t.Optional(t.String()),
            dateOfBirth: t.Optional(t.String()),
            email: t.Optional(t.String()),
            inviteKey: t.Optional(t.String())
        })
    })

    .get("/userinfo", async ({ user, status }) => {
        if (!user) {
            return status(401, {
                Status: "NotLoggedIn"
            });
        }
        return await userInfo(user.id);
    })

    .all("/logout", async ({ logout }) => {
        await logout();
        return {
            Status: "OK"
        };
    })

    .all("/check-app-version", () => ({
        UpgradeAction: 0,
        message: ""
    }))

// signup form checks these as you type
const usercheck = new Elysia({ prefix: "/UserCheck" })
    // data 0 = ok
    .get("/checkifinvalidusernameforsignup", async ({ query }) => {
        const username = query.username.trim();
        let invalid = !USERNAME.test(username);
        if (!invalid) {
            const [taken] = await sql`SELECT id FROM users WHERE username = ${username}`;
            invalid = !!taken;
        }
        return {
            data: invalid ? 1 : 0
        };
    }, {
        query: t.Object({
            username: t.String()
        })
    })

    .post("/validatepasswordforsignup", ({ body }) => {
        if (body.password.length < 6) {
            return {
                success: false,
                error: "Password must be at least 6 characters"
            };
        }
        if (body.username && body.password.toLowerCase() === body.username.toLowerCase()) {
            return {
                success: false,
                error: "Password cannot be your username"
            };
        }
        return {
            success: true
        };
    }, {
        body: t.Object({
            password: t.String(),
            username: t.Optional(t.String())
        })
    })

export const mobile = new Elysia()
    .use(session)
    .use(mobileapi)
    .use(usercheck)

    // AgeBracket 1 = under 13, 2 = 13+
    .get("/my/account/json", ({ user }) => ({
        AgeBracket: 2,
        UserEmail: user?.email ?? "",
        UserEmailVerified: false
    }))

    .all("/api/signupmobile/is-username-valid", () => ({
        IsValid: "true",
        ErrorCode: "",
        ErrorMessage: ""
    }))

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
