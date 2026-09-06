import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);
const tables = await sql`
  SELECT to_regclass('public.employees') AS employees_table
`;
const count = await sql`
  SELECT COUNT(*)::int AS total FROM employees
`.catch((e) => [{ total: null, error: e.message }]);

console.log("table:", tables[0]);
console.log("count:", count[0]);
