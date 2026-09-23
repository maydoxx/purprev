import { Elysia, t } from "elysia";
import { stub } from "../stub";

const store = {
    placeId: t.Numeric(),
    type: t.Optional(t.String({ default: "standard" })),
    scope: t.Optional(t.String({ default: "global" }))
};

// TODO: put it in the db
// TODO: game servers only
export const persistence = new Elysia({ prefix: "/persistence" })
    // body is qkeys[0].scope= etc, parse it yourself
    .post("/getV2", stub, {
        parse: "text",
        query: t.Object(store)
    })

    // body is value= and maybe expectedValue=
    // expected doesnt match = {error: "Expected value mismatch", data: current}
    .post("/set", stub, {
        parse: "text",
        query: t.Object({
            ...store,
            key: t.String(),
            target: t.Optional(t.String()),
            valueLength: t.Optional(t.Numeric()),
            expectedValueLength: t.Optional(t.Numeric())
        })
    })

    .post("/increment", stub, {
        query: t.Object({
            ...store,
            key: t.String(),
            target: t.Optional(t.String()),
            value: t.Numeric()
        })
    })

    // exclusiveStartKey is target$value of the last entry
    .post("/getSortedValues", stub, {
        query: t.Object({
            ...store,
            key: t.String(),
            // clamp to 1-100
            pageSize: t.Optional(t.Numeric()),
            ascending: t.Optional(t.String()),
            inclusiveMinValue: t.Optional(t.Numeric()),
            inclusiveMaxValue: t.Optional(t.Numeric()),
            exclusiveStartKey: t.Optional(t.String())
        })
    })
