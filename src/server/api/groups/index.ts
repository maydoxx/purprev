import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { saveImage, UploadError, withThumbnail, mediaUrl } from "../../paths";

const PER_PAGE = 20;
const MEMBERS_PER_PAGE = 9;
const OWNER_RANK = 255;
const MEMBER_RANK = 1;

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
    can_post_wall: t.Optional(t.BooleanString()),
    can_shout: t.Optional(t.BooleanString()),
    can_delete_wall: t.Optional(t.BooleanString()),
    can_manage_members: t.Optional(t.BooleanString())
};

type Permission = "can_post_wall" | "can_shout" | "can_delete_wall" | "can_manage_members";

class GroupError extends Error {}

const handle = (err: unknown, status: any) => {
    if (err instanceof GroupError || err instanceof UploadError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

const getGroup = async (groupId: number) => {
    const [group] = await sql`
        SELECT g.*, u.username AS owner_username,
            (SELECT COUNT(*) FROM group_members x WHERE x.group_id = g.id) AS member_count
        FROM site_groups g LEFT JOIN users u ON u.id = g.owner_id
        WHERE g.id = ${groupId}
    `;
    if (!group) {
        throw new GroupError("That group does not exist.");
    }
    group.member_count = Number(group.member_count);
    return group;
};

const rankOf = async (groupId: number, userId: number) => {
    const [row] = await sql`SELECT rank FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;
    return row ? Number(row.rank) : 0;
};

const can = async (groupId: number, userId: number, permission: Permission) => {
    const rank = await rankOf(groupId, userId);
    if (rank <= 0) {
        return false;
    }
    if (rank === OWNER_RANK) {
        return true;
    }
    const [row] = await sql`SELECT ${sql(permission)} AS ok FROM group_roles WHERE group_id = ${groupId} AND rank = ${rank}`;
    return !!row?.ok;
};

const requireOwner = async (groupId: number, userId: number) => {
    const group = await getGroup(groupId);
    if (Number(group.owner_id) !== userId) {
        throw new GroupError("Only the group owner can do that.");
    }
    return group;
};

const requireManager = async (groupId: number, userId: number) => {
    const group = await getGroup(groupId);
    if (Number(group.owner_id) !== userId && !(await can(groupId, userId, "can_manage_members"))) {
        throw new GroupError("You do not have permission to manage members.");
    }
    return group;
};

const checkDescription = (description: string) => {
    if (description.length > 2000) {
        throw new GroupError("Description cannot be longer than 2000 characters.");
    }
};

const checkRoleName = (name: string) => {
    if (name === "" || name.length > 32) {
        throw new GroupError("Role names must be 1-32 characters long.");
    }
};

const listGroups = (where = sql``) => sql`
    SELECT g.*, u.username AS owner_username,
        (SELECT COUNT(*) FROM group_members x WHERE x.group_id = g.id) AS member_count
    FROM site_groups g LEFT JOIN users u ON u.id = g.owner_id
    ${where}
`;

export const groups = new Elysia({ prefix: "/api/groups" })
    .use(session)

    .get("/", async ({ query }) => {
        const like = "%" + (query.q ?? "").trim() + "%";
        const [count] = await sql`SELECT COUNT(*) AS n FROM site_groups WHERE name LIKE ${like}`;
        const pages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), pages);

        return {
            page,
            pages,
            list: await listGroups(sql`WHERE g.name LIKE ${like} ORDER BY g.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`)
        };
    }, {
        query: t.Object({
            q: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/my", async ({ user }) => await sql`
        SELECT g.*, gm.role, gm.rank,
            (SELECT COUNT(*) FROM group_members x WHERE x.group_id = g.id) AS member_count
        FROM group_members gm JOIN site_groups g ON g.id = gm.group_id
        WHERE gm.user_id = ${user.id} ORDER BY gm.rank DESC, gm.joined_at DESC
    `, {
        auth: true
    })

    .post("/", async ({ body, user, status }) => {
        try {
            const name = body.name.trim();
            const description = (body.description ?? "").trim();
            if (name.length < 3) {
                throw new GroupError("Group name must be at least 3 characters long.");
            }
            if (name.length > 60) {
                throw new GroupError("Group name cannot be longer than 60 characters.");
            }
            checkDescription(description);

            const groupId = await sql.begin(async tx => {
                const created = await tx`INSERT INTO site_groups (name, owner_id, description, created_at, updated_at) VALUES (${name}, ${user.id}, ${description}, ${now()}, ${now()})`;
                const groupId = Number(created.lastInsertRowid);
                await tx`INSERT INTO group_members (group_id, user_id, role, rank, joined_at) VALUES (${groupId}, ${user.id}, 'Owner', ${OWNER_RANK}, ${now()})`;
                await tx`INSERT INTO group_roles (group_id, name, rank, can_post_wall, can_shout, can_delete_wall, can_manage_members) VALUES (${groupId}, 'Owner', ${OWNER_RANK}, 1, 1, 1, 1)`;
                await tx`INSERT INTO group_roles (group_id, name, rank, can_post_wall, can_shout, can_delete_wall, can_manage_members) VALUES (${groupId}, 'Member', ${MEMBER_RANK}, 1, 0, 0, 0)`;
                return groupId;
            });

            if (body.icon && body.icon.size > 0) {
                const icon = await saveImage("groups", groupId, body.icon);
                await sql`UPDATE site_groups SET icon = ${icon} WHERE id = ${groupId}`;
            }

            return {
                ok: true,
                id: groupId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .get("/:id", async ({ params, user, status }) => {
        try {
            const group = await getGroup(params.id);
            const rank = user ? await rankOf(params.id, user.id) : 0;
            const [membership] = user ? await sql`SELECT role FROM group_members WHERE group_id = ${params.id} AND user_id = ${user.id}` : [null];
            const [pending] = user ? await sql`SELECT 1 FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${user.id}` : [null];

            return {
                ...group,
                is_member: rank > 0,
                join_pending: !!pending,
                viewer_role: membership?.role ?? "Guest",
                viewer_rank: rank,
                can_post_wall: user ? await can(params.id, user.id, "can_post_wall") : false,
                can_shout: user ? await can(params.id, user.id, "can_shout") : false,
                can_delete_wall: user ? await can(params.id, user.id, "can_delete_wall") : false,
                can_manage_members: user ? await can(params.id, user.id, "can_manage_members") : false
            };
        } catch (err) {
            if (err instanceof GroupError) {
                return status(404, {
                    error: err.message
                });
            }
            throw err;
        }
    }, {
        params: id
    })

    .delete("/:id", async ({ params, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            await sql.begin(async tx => {
                await tx`DELETE FROM group_join_requests WHERE group_id = ${params.id}`;
                await tx`DELETE FROM group_roles WHERE group_id = ${params.id}`;
                await tx`DELETE FROM group_wall_posts WHERE group_id = ${params.id}`;
                await tx`DELETE FROM group_store_items WHERE group_id = ${params.id}`;
                await tx`DELETE FROM group_games WHERE group_id = ${params.id}`;
                await tx`DELETE FROM group_affiliates WHERE group_id = ${params.id} OR other_group_id = ${params.id}`;
                await tx`DELETE FROM group_members WHERE group_id = ${params.id}`;
                await tx`DELETE FROM site_groups WHERE id = ${params.id}`;
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .patch("/:id/settings", async ({ params, body, user, status }) => {
        try {
            const group = await requireOwner(params.id, user.id);
            const description = (body.description ?? group.description).trim();
            checkDescription(description);
            const approval = body.approval_required ?? !!group.approval_required;
            const wall = body.wall_enabled ?? !!group.wall_enabled;

            await sql`UPDATE site_groups SET description = ${description}, approval_required = ${approval}, wall_enabled = ${wall}, updated_at = ${now()} WHERE id = ${params.id}`;
            if (body.icon && body.icon.size > 0) {
                const icon = await saveImage("groups", params.id, body.icon);
                await sql`UPDATE site_groups SET icon = ${icon} WHERE id = ${params.id}`;
            }
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            description: t.Optional(t.String()),
            approval_required: t.Optional(t.BooleanString()),
            wall_enabled: t.Optional(t.BooleanString()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .post("/:id/join", async ({ params, user, status }) => {
        try {
            const group = await getGroup(params.id);
            if (await rankOf(params.id, user.id) > 0) {
                return {
                    ok: true,
                    status: "joined"
                };
            }
            if (group.approval_required) {
                await sql`INSERT IGNORE INTO group_join_requests (group_id, user_id, created_at) VALUES (${params.id}, ${user.id}, ${now()})`;
                return {
                    ok: true,
                    status: "requested"
                };
            }
            await sql`INSERT IGNORE INTO group_members (group_id, user_id, role, rank, joined_at) VALUES (${params.id}, ${user.id}, 'Member', ${MEMBER_RANK}, ${now()})`;
            await sql`DELETE FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${user.id}`;
            return {
                ok: true,
                status: "joined"
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .post("/:id/leave", async ({ params, user, status }) => {
        try {
            const group = await getGroup(params.id);
            if (Number(group.owner_id) === user.id) {
                throw new GroupError("The group owner cannot leave the group.");
            }
            await sql`DELETE FROM group_members WHERE group_id = ${params.id} AND user_id = ${user.id}`;
            await sql`DELETE FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${user.id}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .post("/:id/shout", async ({ params, body, user, status }) => {
        try {
            await getGroup(params.id);
            if (!(await can(params.id, user.id, "can_shout"))) {
                throw new GroupError("Your group role cannot post a shout.");
            }
            const shout = body.shout.trim();
            if (shout.length > 255) {
                throw new GroupError("Shout cannot be longer than 255 characters.");
            }
            await sql`UPDATE site_groups SET shout = ${shout}, updated_at = ${now()} WHERE id = ${params.id}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            shout: t.String()
        })
    })

    .get("/:id/wall", async ({ params, query }) => {
        const [count] = await sql`SELECT COUNT(*) AS n FROM group_wall_posts WHERE group_id = ${params.id}`;
        const pages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), pages);
        return {
            page,
            pages,
            list: await sql`
                SELECT p.*, u.username FROM group_wall_posts p JOIN users u ON u.id = p.user_id
                WHERE p.group_id = ${params.id} ORDER BY p.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
            `
        };
    }, {
        params: id,
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/:id/wall", async ({ params, body, user, status }) => {
        try {
            const group = await getGroup(params.id);
            if (!group.wall_enabled) {
                throw new GroupError("The group wall is disabled.");
            }
            if (!(await can(params.id, user.id, "can_post_wall"))) {
                throw new GroupError("Your group role cannot post on the wall.");
            }
            const text = body.body.trim();
            if (text === "") {
                throw new GroupError("Wall post cannot be empty.");
            }
            if (text.length > 500) {
                throw new GroupError("Wall posts cannot be longer than 500 characters.");
            }
            const created = await sql`INSERT INTO group_wall_posts (group_id, user_id, body, created_at) VALUES (${params.id}, ${user.id}, ${text}, ${now()})`;
            return {
                ok: true,
                id: Number(created.lastInsertRowid)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            body: t.String()
        })
    })

    .delete("/:id/wall/:postId", async ({ params, user, status }) => {
        try {
            const [post] = await sql`SELECT user_id FROM group_wall_posts WHERE id = ${params.postId} AND group_id = ${params.id}`;
            if (post && Number(post.user_id) !== user.id && !(await can(params.id, user.id, "can_delete_wall"))) {
                throw new GroupError("You cannot delete that wall post.");
            }
            await sql`DELETE FROM group_wall_posts WHERE id = ${params.postId} AND group_id = ${params.id}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            postId: t.Numeric()
        })
    })

    .get("/:id/members", async ({ params, query }) => {
        const role = (query.role ?? "").trim();
        const where = sql`WHERE gm.group_id = ${params.id} ${role !== "" ? sql`AND gm.role = ${role}` : sql``}`;
        const [count] = await sql`SELECT COUNT(*) AS n FROM group_members gm ${where}`;
        const pages = Math.max(1, Math.ceil(Number(count.n) / MEMBERS_PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), pages);

        return {
            page,
            pages,
            list: await sql`
                SELECT u.id, u.username, gm.role, gm.rank, gm.joined_at, r.id AS role_id
                FROM group_members gm JOIN users u ON u.id = gm.user_id
                LEFT JOIN group_roles r ON r.group_id = gm.group_id AND r.rank = gm.rank
                ${where} ORDER BY gm.rank DESC, gm.joined_at ASC, u.id ASC
                LIMIT ${MEMBERS_PER_PAGE} OFFSET ${(page - 1) * MEMBERS_PER_PAGE}
            `
        };
    }, {
        params: id,
        query: t.Object({
            role: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .patch("/:id/members/:userId", async ({ params, body, user, status }) => {
        try {
            const group = await requireManager(params.id, user.id);
            const isOwner = Number(group.owner_id) === user.id;
            if (params.userId === Number(group.owner_id)) {
                throw new GroupError("The owner role cannot be reassigned.");
            }
            const actorRank = await rankOf(params.id, user.id);
            const targetRank = await rankOf(params.id, params.userId);
            if (targetRank <= 0) {
                throw new GroupError("That user is not a member of this group.");
            }
            if (!isOwner && targetRank >= actorRank) {
                throw new GroupError("You cannot change a member with an equal or higher rank.");
            }
            const [role] = await sql`SELECT * FROM group_roles WHERE id = ${body.role_id} AND group_id = ${params.id}`;
            if (!role || Number(role.rank) === OWNER_RANK) {
                throw new GroupError("Invalid role.");
            }
            if (!isOwner && Number(role.rank) >= actorRank) {
                throw new GroupError("You cannot assign a rank equal to or above your own.");
            }
            await sql`UPDATE group_members SET role = ${role.name}, rank = ${role.rank} WHERE group_id = ${params.id} AND user_id = ${params.userId}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: member,
        body: t.Object({
            role_id: t.Numeric()
        })
    })

    .delete("/:id/members/:userId", async ({ params, user, status }) => {
        try {
            const group = await requireManager(params.id, user.id);
            if (params.userId === Number(group.owner_id)) {
                throw new GroupError("The group owner cannot be exiled.");
            }
            const actorRank = await rankOf(params.id, user.id);
            const targetRank = await rankOf(params.id, params.userId);
            if (targetRank <= 0) {
                throw new GroupError("That user is not a member of this group.");
            }
            if (Number(group.owner_id) !== user.id && targetRank >= actorRank) {
                throw new GroupError("You cannot exile a member with an equal or higher rank.");
            }
            await sql.begin(async tx => {
                await tx`DELETE FROM group_wall_posts WHERE group_id = ${params.id} AND user_id = ${params.userId}`;
                await tx`DELETE FROM group_members WHERE group_id = ${params.id} AND user_id = ${params.userId}`;
                await tx`DELETE FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${params.userId}`;
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: member
    })

    .get("/:id/requests", async ({ params, user, status }) => {
        try {
            await requireManager(params.id, user.id);
            return await sql`
                SELECT r.user_id, r.created_at, u.username FROM group_join_requests r
                JOIN users u ON u.id = r.user_id
                WHERE r.group_id = ${params.id} ORDER BY r.created_at ASC
            `;
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .post("/:id/requests/:userId/approve", async ({ params, user, status }) => {
        try {
            await requireManager(params.id, user.id);
            await sql.begin(async tx => {
                const [request] = await tx`SELECT 1 FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${params.userId} FOR UPDATE`;
                if (!request) {
                    throw new GroupError("That join request no longer exists.");
                }
                await tx`INSERT IGNORE INTO group_members (group_id, user_id, role, rank, joined_at) VALUES (${params.id}, ${params.userId}, 'Member', ${MEMBER_RANK}, ${now()})`;
                await tx`DELETE FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${params.userId}`;
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: member
    })

    .post("/:id/requests/:userId/deny", async ({ params, user, status }) => {
        try {
            await requireManager(params.id, user.id);
            await sql`DELETE FROM group_join_requests WHERE group_id = ${params.id} AND user_id = ${params.userId}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: member
    })

    .get("/:id/roles", async ({ params }) => await sql`SELECT * FROM group_roles WHERE group_id = ${params.id} ORDER BY rank DESC, id ASC`, {
        params: id
    })

    .post("/:id/roles", async ({ params, body, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            const name = body.role_name.trim();
            checkRoleName(name);
            if (body.rank < 2 || body.rank > 254) {
                throw new GroupError("Custom role rank must be between 2 and 254.");
            }
            const [taken] = await sql`SELECT 1 FROM group_roles WHERE group_id = ${params.id} AND rank = ${body.rank}`;
            if (taken) {
                throw new GroupError("That rank number is already in use.");
            }
            const created = await sql`
                INSERT INTO group_roles (group_id, name, rank, can_post_wall, can_shout, can_delete_wall, can_manage_members)
                VALUES (${params.id}, ${name}, ${body.rank}, ${!!body.can_post_wall}, ${!!body.can_shout}, ${!!body.can_delete_wall}, ${!!body.can_manage_members})
            `;
            return {
                ok: true,
                id: Number(created.lastInsertRowid)
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            role_name: t.String(),
            rank: t.Numeric(),
            ...permissions
        })
    })

    .patch("/:id/roles/:roleId", async ({ params, body, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            const [role] = await sql`SELECT * FROM group_roles WHERE id = ${params.roleId} AND group_id = ${params.id}`;
            if (!role) {
                throw new GroupError("Role not found.");
            }
            if (Number(role.rank) === OWNER_RANK) {
                throw new GroupError("The Owner role cannot be changed.");
            }
            const name = body.role_name.trim();
            checkRoleName(name);

            await sql.begin(async tx => {
                await tx`
                    UPDATE group_roles SET name = ${name}, can_post_wall = ${!!body.can_post_wall}, can_shout = ${!!body.can_shout},
                        can_delete_wall = ${!!body.can_delete_wall}, can_manage_members = ${!!body.can_manage_members}
                    WHERE id = ${params.roleId} AND group_id = ${params.id}
                `;
                await tx`UPDATE group_members SET role = ${name} WHERE group_id = ${params.id} AND rank = ${role.rank}`;
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: role,
        body: t.Object({
            role_name: t.String(),
            ...permissions
        })
    })

    .delete("/:id/roles/:roleId", async ({ params, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            const [role] = await sql`SELECT * FROM group_roles WHERE id = ${params.roleId} AND group_id = ${params.id}`;
            if (role) {
                if (Number(role.rank) === MEMBER_RANK || Number(role.rank) === OWNER_RANK) {
                    throw new GroupError("The Member and Owner roles cannot be deleted.");
                }
                await sql.begin(async tx => {
                    await tx`UPDATE group_members SET role = 'Member', rank = ${MEMBER_RANK} WHERE group_id = ${params.id} AND rank = ${role.rank}`;
                    await tx`DELETE FROM group_roles WHERE id = ${params.roleId} AND group_id = ${params.id}`;
                });
            }
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: role
    })

    .get("/:id/store", async ({ params }) => {
        const rows = await sql`
            SELECT c.*, u.username AS creator_name FROM group_store_items g
            JOIN catalog_items c ON c.id = g.item_id
            LEFT JOIN users u ON u.id = c.creator_id
            WHERE g.group_id = ${params.id}
            ORDER BY g.added_at DESC
        `;
        return await Promise.all(rows.map(withThumbnail));
    }, {
        params: id
    })

    .post("/:id/store", async ({ params, body, user, status }) => {
        try {
            const group = await requireOwner(params.id, user.id);
            const [item] = await sql`SELECT id FROM catalog_items WHERE id = ${body.targetId} AND creator_id = ${group.owner_id}`;
            if (!item) {
                throw new GroupError("Choose a catalog item you created.");
            }
            await sql`INSERT IGNORE INTO group_store_items (group_id, item_id, added_at) VALUES (${params.id}, ${body.targetId}, ${now()})`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            targetId: t.Numeric()
        })
    })

    .delete("/:id/store/:targetId", async ({ params, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            await sql`DELETE FROM group_store_items WHERE group_id = ${params.id} AND item_id = ${params.targetId}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            targetId: t.Numeric()
        })
    })

    .get("/:id/games", async ({ params }) => {
        const rows = await sql`
            SELECT g.id, g.title, g.creator_id, u.username AS creator_name FROM group_games x
            JOIN games g ON g.id = x.game_id
            LEFT JOIN users u ON u.id = g.creator_id
            WHERE x.group_id = ${params.id}
            ORDER BY x.added_at DESC
        `;
        return await Promise.all(rows.map(async (g: any) => ({
            ...g,
            icon: await mediaUrl("icons", g.id),
            thumbnail: await mediaUrl("thumbnails", g.id)
        })));
    }, {
        params: id
    })

    .post("/:id/games", async ({ params, body, user, status }) => {
        try {
            const group = await requireOwner(params.id, user.id);
            const [game] = await sql`SELECT id FROM games WHERE id = ${body.targetId} AND creator_id = ${group.owner_id}`;
            if (!game) {
                throw new GroupError("Choose a game you created.");
            }
            await sql`INSERT IGNORE INTO group_games (group_id, game_id, added_at) VALUES (${params.id}, ${body.targetId}, ${now()})`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            targetId: t.Numeric()
        })
    })

    .delete("/:id/games/:targetId", async ({ params, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            await sql`DELETE FROM group_games WHERE group_id = ${params.id} AND game_id = ${params.targetId}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            targetId: t.Numeric()
        })
    })

    .get("/:id/affiliates", async ({ params, user }) => {
        const groupId = params.id;
        const [group] = await sql`SELECT owner_id FROM site_groups WHERE id = ${groupId}`;
        if (!group) {
            return {
                accepted: [],
                incoming: [],
                outgoing: []
            };
        }
        const rows = await sql`
            SELECT a.group_id, a.other_group_id, a.status, g.id, g.name, g.icon FROM group_affiliates a
            JOIN site_groups g ON g.id = IF(a.group_id = ${groupId}, a.other_group_id, a.group_id)
            WHERE a.group_id = ${groupId} OR a.other_group_id = ${groupId}
            ORDER BY a.requested_at DESC
        `;
        const item = (r: any) => ({
            id: Number(r.id),
            name: r.name,
            icon: r.icon
        });
        return {
            accepted: rows.filter((r: any) => r.status === "accepted").map(item),
            incoming: Number(group.owner_id) === user?.id
                ? rows.filter((r: any) => r.status === "pending" && Number(r.other_group_id) === groupId).map(item)
                : [],
            outgoing: Number(group.owner_id) === user?.id
                ? rows.filter((r: any) => r.status === "pending" && Number(r.group_id) === groupId).map(item)
                : []
        };
    }, {
        params: id
    })

    .post("/:id/affiliates", async ({ params, body, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            if (params.id === body.targetId) {
                throw new GroupError("A group cannot affiliate with itself.");
            }
            await getGroup(body.targetId);
            const [existing] = await sql`
                SELECT status FROM group_affiliates
                WHERE (group_id = ${params.id} AND other_group_id = ${body.targetId}) OR (group_id = ${body.targetId} AND other_group_id = ${params.id})
            `;
            if (existing) {
                throw new GroupError("There is already an affiliate request between these groups.");
            }
            await sql`INSERT INTO group_affiliates (group_id, other_group_id, status, requested_at) VALUES (${params.id}, ${body.targetId}, 'pending', ${now()})`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            targetId: t.Numeric()
        })
    })

    .post("/:id/affiliates/:targetId/accept", async ({ params, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            const changed = await sql`
                UPDATE group_affiliates SET status = 'accepted'
                WHERE group_id = ${params.targetId} AND other_group_id = ${params.id} AND status = 'pending'
            `;
            if (!changed.affectedRows) {
                throw new GroupError("Affiliate request not found.");
            }
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            targetId: t.Numeric()
        })
    })

    .delete("/:id/affiliates/:targetId", async ({ params, user, status }) => {
        try {
            await requireOwner(params.id, user.id);
            await sql`
                DELETE FROM group_affiliates
                WHERE (group_id = ${params.id} AND other_group_id = ${params.targetId}) OR (group_id = ${params.targetId} AND other_group_id = ${params.id})
            `;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            targetId: t.Numeric()
        })
    })
