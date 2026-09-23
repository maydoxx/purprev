import { Elysia, t } from "elysia";
import { stub } from "../stub";

const id = t.Object({
    id: t.Numeric()
});
const member = t.Object({
    id: t.Numeric(),
    userId: t.Numeric()
});
const role = t.Object({
    id: t.Numeric(),
    roleId: t.Numeric()
});

const permissions = {
    can_post_wall: t.Optional(t.Boolean()),
    can_shout: t.Optional(t.Boolean()),
    can_delete_wall: t.Optional(t.Boolean()),
    can_manage_members: t.Optional(t.Boolean())
};

export const groups = new Elysia({ prefix: "/api/groups" })
    .get("/", stub, {
        query: t.Object({
            q: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    // the groups the logged in user is in
    .get("/my", stub)

    .post("/", stub, {
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .get("/:id", stub, {
        params: id
    })

    // owner only
    .delete("/:id", stub, {
        params: id
    })

    .patch("/:id/settings", stub, {
        params: id,
        body: t.Object({
            description: t.Optional(t.String()),
            approval_required: t.Optional(t.Boolean()),
            wall_enabled: t.Optional(t.Boolean()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    // goes to the join requests instead if the group needs approval
    .post("/:id/join", stub, {
        params: id
    })

    .post("/:id/leave", stub, {
        params: id
    })

    .post("/:id/shout", stub, {
        params: id,
        body: t.Object({
            shout: t.String()
        })
    })

    // wall
    .get("/:id/wall", stub, {
        params: id,
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/:id/wall", stub, {
        params: id,
        body: t.Object({
            body: t.String()
        })
    })

    .delete("/:id/wall/:postId", stub, {
        params: t.Object({
            id: t.Numeric(),
            postId: t.Numeric()
        })
    })

    // members
    .get("/:id/members", stub, {
        params: id,
        query: t.Object({
            role: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .patch("/:id/members/:userId", stub, {
        params: member,
        body: t.Object({
            role_id: t.Numeric()
        })
    })

    // exile
    .delete("/:id/members/:userId", stub, {
        params: member
    })

    .get("/:id/requests", stub, {
        params: id
    })

    .post("/:id/requests/:userId/approve", stub, {
        params: member
    })

    .post("/:id/requests/:userId/deny", stub, {
        params: member
    })

    // roles
    .get("/:id/roles", stub, {
        params: id
    })

    .post("/:id/roles", stub, {
        params: id,
        body: t.Object({
            role_name: t.String({ maxLength: 32 }),
            rank: t.Numeric({
                minimum: 2,
                maximum: 254
            }),
            ...permissions
        })
    })

    // the rank of a role cant change after its made
    .patch("/:id/roles/:roleId", stub, {
        params: role,
        body: t.Object({
            role_name: t.String({ maxLength: 32 }),
            ...permissions
        })
    })

    .delete("/:id/roles/:roleId", stub, {
        params: role
    })
