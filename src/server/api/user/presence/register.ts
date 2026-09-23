import { Elysia } from "elysia";
import { stub } from "../../stub";

// the site pings this to stay online (sets lastOnlineSite)
// TODO: find a way to make it do this silently.
export const register = new Elysia()
    .post("/register", stub)
