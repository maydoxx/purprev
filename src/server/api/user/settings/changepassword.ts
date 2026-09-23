import { Elysia, t } from "elysia";
import { stub } from "../../stub";

// TODO: actually check currentPassword, since the old site didn't...
//       okay i should probably shut it down
export const changepassword = new Elysia()
    .post("/changepassword", stub, {
        body: t.Object({
            currentPassword: t.String(),
            newPassword: t.String({ minLength: 8 }),
            confirmPassword: t.String()
        })
    })
