import { Elysia } from "elysia";
import { stub } from "../stub";

// one key per 12 hours
export const invites = new Elysia({ prefix: "/invites" })
    .post("/generate", stub)
