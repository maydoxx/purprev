import { Elysia, t } from "elysia";
import { stub } from "../stub";

// TODO: make it re-rendered the avatar when saving
export const avatar = new Elysia({ prefix: "/avatar" })
    // body colors + worn items for the avatar editor
    .get("/", stub)

    // brickcolor numbers
    .post("/colors", stub, {
        body: t.Object({
            head_color: t.Optional(t.Numeric()),
            torso_color: t.Optional(t.Numeric()),
            left_arm_color: t.Optional(t.Numeric()),
            right_arm_color: t.Optional(t.Numeric()),
            left_leg_color: t.Optional(t.Numeric()),
            right_leg_color: t.Optional(t.Numeric())
        })
    })

    // wear or remove an item
    .post("/wear", stub, {
        body: t.Object({
            itemId: t.Numeric(),
            wear: t.Boolean()
        })
    })
