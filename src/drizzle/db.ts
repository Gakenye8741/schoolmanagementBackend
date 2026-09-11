import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as relations from "./relations"; // 1. Import your relations file

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// 2. Combine both tables and relations into the schema object
const db = drizzle(pool, { 
  schema: {
    ...schema,
    ...relations,
  }, 
  logger: true 
});

export default db;