import { Elysia, t } from "elysia";
import { session, getUser, claimDailyLoginRewards } from "../../session";
import { sql } from "../../db";
import { clientIp } from "../../invites";
import { authLimiter } from "../../ratelimit";
import { recordSecurityAudit } from "../../audit";
import { verifyAndMaybeRehash, updateUserPasswordHash } from "../../password-hash";

export const login = new Elysia()
    .use(session)
    .use(authLimiter)
    .post("/login", async ({ body, login, request, server, status }) => {
        const username = body.username.trim();

        const [row] = await sql`SELECT id, password FROM users WHERE username = ${username}`;

        // Constant-time response to prevent user enumeration
        if (!row || !(await verifyAndMaybeRehash(row.id, body.password, row.password)).verified) {
            // Still do the hash verification to maintain constant time
            if (!row) {
                await verifyAndMaybeRehash(0, body.password, "$2b$10$dummyhashdummyhashdummyhashdummyhashdummy");
            }
            await recordSecurityAudit({
                userId: row?.id ?? 0,
                username: row?.username ?? username,
                event: "failed_login",
                request,
                server,
                success: false,
                details: "Invalid credentials"
            });
            return status(401, {
                error: "Invalid username or password"
            });
        }

        // Check if password needs rehashing
        const rehashResult = await verifyAndMaybeRehash(row.id, body.password, row.password);
        if (rehashResult.newHash) {
            await updateUserPasswordHash(row.id, rehashResult.newHash);
        }

        const id = row.id;
        await login(id);
        await claimDailyLoginRewards(id);

        await recordSecurityAudit({
            userId: id,
            username: username,
            event: "login",
            request,
            server,
            success: true
        });

        return {
            ok: true,
            user: await getUser(id)
        };
    }, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        })
    })