import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the project root (two levels up from config/)
dotenv.config({ path: join(__dirname, '../../.env') });

const {PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT} = process.env;

// Create connection using env variables
export const sql = neon(
    `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=require`
)
