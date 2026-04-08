import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const {PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT} = process.env;

export const sql = neon(
    `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=require`
);

// Create index for HOD queries
async function createHodIndex() {
    try {
        await sql`
            CREATE INDEX IF NOT EXISTS idx_student_dues_dept_cleared 
            ON student_dues (student_roll_number, is_cleared, is_payable)
        `;
        console.log('✅ HOD index created successfully');
    } catch (error) {
        console.error('❌ Error creating HOD index:', error);
    }
}

// Run index creation
createHodIndex();
