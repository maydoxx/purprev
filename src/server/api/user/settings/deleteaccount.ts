import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql, now } from "../../../db";
import { strictAuthLimiter } from "../../../ratelimit";
import { recordSecurityAudit } from "../../../audit";
import { selfDeleteUser } from "../../../user-deletion";

export const deleteaccount = new Elysia()
    .use(session)
    .use(strictAuthLimiter)
    .post("/deleteaccount", async ({ body, user, request, status, server }) => {
        const [row] = await sql`SELECT password FROM users WHERE id = ${user.id}`;
        if (!(await Bun.password.verify(body.password, row.password))) {
            return status(401, {
                error: "Password is incorrect"
            });
        }

        if (body.confirm !== "DELETE MY ACCOUNT") {
            return status(400, {
                error: 'You must type "DELETE MY ACCOUNT" to confirm'
            });
        }

        const userId = user.id;
        const username = user.username;

        const result = await selfDeleteUser(userId);

        if (!result.success) {
            await recordSecurityAudit({
                userId,
                username,
                event: "account_deletion_failed",
                request,
                server,
                success: false,
                details: result.errors.join(", ")
            });
            return status(500, {
                error: "Account deletion failed",
                details: result.errors
            });
        }

        await recordSecurityAudit({
            userId,
            username,
            event: "account_deleted",
            request,
            server,
            success: true,
            details: `Deleted ${result.deletedCounts.users} user record and associated data`
        });

        return {
            ok: true,
            message: "Account permanently deleted",
            deleted: result.deletedCounts
        };
    }, {
        auth: true,
        body: t.Object({
            password: t.String(),
            confirm: t.String()
        })
    })