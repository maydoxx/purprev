import { Elysia } from "elysia";
import { stub } from "../stub";

// TODO: kill the token and cookies
export const logout = new Elysia()
    .post("/logout", stub)
