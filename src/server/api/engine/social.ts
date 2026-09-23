import { Elysia, t } from "elysia";
import { stub } from "../stub";

const pair = t.Object({
    firstUserId: t.Numeric(),
    secondUserId: t.Numeric()
});

const friend = new Elysia({ prefix: "/Friend" })
    // ?userId=1&otherUserIds=2&otherUserIds=3 -> ",2,"
    // skips the first char and reads "id," so yeah dont remove the comma
    // TODO: handle multiple otherUserIds
    .get("/AreFriends", () => ",")

    // TODO: game servers only
    .post("/CreateFriendRequest", () => "ok", {
        query: pair
    })

    .post("/DeleteFriendRequest", () => "ok", {
        query: pair
    })

    .post("/CreateFriend", () => "ok", {
        query: pair
    })

    .post("/BreakFriend", () => "ok", {
        query: pair
    })

// the client asks these without /api
const user = new Elysia({ prefix: "/user" })
    // we dont have following so friends is following right now
    // TODO: implement followers
    .get("/following-exists", () => ({
        success: true,
        message: "Success",
        isFollowing: false
    }), {
        query: t.Object({
            UserID: t.Optional(t.Numeric()),
            userId: t.Optional(t.Numeric())
        })
    })

    // logged in user if no userId
    .get("/get-friendship-count", () => ({
        success: true,
        message: "Success",
        count: 0
    }), {
        query: t.Object({
            userId: t.Optional(t.Numeric())
        })
    })

export const social = new Elysia()
    .use(friend)
    .use(user)

    // corescripts get friend pic here
    .get("/thumbs/avatar.ashx", stub, {
        query: t.Object({
            userId: t.Numeric(),
            x: t.Optional(t.Numeric()),
            y: t.Optional(t.Numeric())
        })
    })

    // game server post every message here

    // white under 13
    // black above 13

    // TODO: word list is in php webtty (webtty/config/chatfilter-words.txt)
    .post("/moderation/filtertext", ({ body }) => ({
        data: {
            white: body.text,
            black: body.text
        }
    }), {
        body: t.Object({
            text: t.String(),
            userId: t.Optional(t.Numeric())
        })
    })
