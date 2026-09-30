import { sql } from ".";
import { seedStarterItems } from "../starter";

await seedStarterItems();
console.log("done");
await sql.close();
