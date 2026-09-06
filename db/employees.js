import { getDb } from "./client.js";
import { DEMO_EMPLOYEES } from "../data/employees.js";
import {
  addDemoEmployee,
  findDemoEmployeeByEmail,
  getDemoEmployees,
  removeDemoEmployee,
  updateDemoEmployeeStatus,
} from "../data/demoEmployeeStore.js";
import { mapEmployeeRow } from "./mappers.js";
import { filterEmployees } from "../utils/employeeUtils.js";

const STATUSES = new Set(["active", "away", "inactive"]);

function demoResult({ query = "", department = "all" } = {}) {
  return {
    employees: filterEmployees(getDemoEmployees(), { query, department }),
    source: "demo",
  };
}

function isMissingTableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes('relation "employees"') ||
    message.includes("undefined_table")
  );
}

function normalizeEmployeeInput(input = {}) {
  const name = String(input.name || "").trim();
  const department = String(input.department || "").trim();
  const position = String(input.position || "").trim();
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const status = String(input.status || "active")
    .trim()
    .toLowerCase();

  const errors = {};
  if (!name) errors.name = "Name is required.";
  if (!department) errors.department = "Department is required.";
  if (!position) errors.position = "Position is required.";
  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email.";
  }
  if (!STATUSES.has(status)) {
    errors.status = "Status must be active, away, or inactive.";
  }

  return {
    errors,
    employee: {
      name,
      department,
      position,
      email,
      status,
      avatar: input.avatar ? String(input.avatar).trim() : null,
    },
  };
}

async function ensureEmployeesSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      position TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function queryEmployees(sql, { query = "", department = "all" } = {}) {
  if (department !== "all" && query.trim()) {
    const pattern = `%${query.trim()}%`;
    return sql`
      SELECT id, name, department, position, email, avatar, status, joined_at
      FROM employees
      WHERE department = ${department}
        AND (
          name ILIKE ${pattern}
          OR email ILIKE ${pattern}
          OR position ILIKE ${pattern}
          OR department ILIKE ${pattern}
        )
      ORDER BY name ASC
    `;
  }

  if (department !== "all") {
    return sql`
      SELECT id, name, department, position, email, avatar, status, joined_at
      FROM employees
      WHERE department = ${department}
      ORDER BY name ASC
    `;
  }

  if (query.trim()) {
    const pattern = `%${query.trim()}%`;
    return sql`
      SELECT id, name, department, position, email, avatar, status, joined_at
      FROM employees
      WHERE
        name ILIKE ${pattern}
        OR email ILIKE ${pattern}
        OR position ILIKE ${pattern}
        OR department ILIKE ${pattern}
      ORDER BY name ASC
    `;
  }

  return sql`
    SELECT id, name, department, position, email, avatar, status, joined_at
    FROM employees
    ORDER BY name ASC
  `;
}

async function seedIfEmpty(sql) {
  const rows = await sql`SELECT COUNT(*)::int AS total FROM employees`;
  const total = rows[0]?.total ?? 0;
  if (total > 0) return;

  for (const employee of DEMO_EMPLOYEES) {
    await sql`
      INSERT INTO employees (id, name, department, position, email, avatar, status, joined_at)
      VALUES (
        ${employee.id},
        ${employee.name},
        ${employee.department},
        ${employee.position},
        ${employee.email},
        ${employee.avatar || null},
        ${employee.status},
        ${employee.joinedAt}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

/**
 * List employees from Neon when DATABASE_URL is set.
 * Auto-creates/seeds the employees table if missing/empty.
 * Falls back to demo data only if the database is unreachable.
 */
export async function listEmployees(options = {}) {
  const sql = getDb();

  if (!sql) {
    return demoResult(options);
  }

  try {
    await ensureEmployeesSchema(sql);
    await seedIfEmpty(sql);
    const rows = await queryEmployees(sql, options);
    return {
      employees: rows.map(mapEmployeeRow),
      source: "neon",
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        await ensureEmployeesSchema(sql);
        await seedIfEmpty(sql);
        const rows = await queryEmployees(sql, options);
        return {
          employees: rows.map(mapEmployeeRow),
          source: "neon",
        };
      } catch (retryError) {
        console.warn(
          "[listEmployees] Could not prepare Neon table, using demo data:",
          retryError?.message || retryError,
        );
        return demoResult(options);
      }
    }

    console.warn(
      "[listEmployees] Database unavailable, using demo data:",
      error?.message || error,
    );
    return demoResult(options);
  }
}

export async function countEmployees() {
  const { employees, source } = await listEmployees();
  return { total: employees.length, source };
}

export async function createEmployee(input = {}) {
  const { errors, employee } = normalizeEmployeeInput(input);
  if (Object.keys(errors).length) {
    return { success: false, error: "Please fix the form errors.", errors };
  }

  const id = `e-${crypto.randomUUID()}`;
  const joinedAt = new Date().toISOString().slice(0, 10);
  const record = {
    id,
    ...employee,
    joinedAt,
  };

  const sql = getDb();
  if (!sql) {
    if (findDemoEmployeeByEmail(employee.email)) {
      return {
        success: false,
        error: "An employee with this email already exists.",
        errors: { email: "Email already in use." },
      };
    }
    return {
      success: true,
      employee: addDemoEmployee(record),
      source: "demo",
    };
  }

  try {
    await ensureEmployeesSchema(sql);
    await seedIfEmpty(sql);
    await sql`
      INSERT INTO employees (id, name, department, position, email, avatar, status, joined_at)
      VALUES (
        ${record.id},
        ${record.name},
        ${record.department},
        ${record.position},
        ${record.email},
        ${record.avatar},
        ${record.status},
        ${record.joinedAt}
      )
    `;
    return { success: true, employee: record, source: "neon" };
  } catch (error) {
    const message = String(error?.message || error || "").toLowerCase();
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        success: false,
        error: "An employee with this email already exists.",
        errors: { email: "Email already in use." },
      };
    }
    console.warn("[createEmployee]", error?.message || error);
    return {
      success: false,
      error: error.message || "Unable to create employee.",
    };
  }
}

export async function updateEmployeeStatus(id, nextStatus) {
  const employeeId = String(id || "").trim();
  const status = String(nextStatus || "")
    .trim()
    .toLowerCase();

  if (!employeeId) {
    return { success: false, error: "Employee id is required." };
  }
  if (!STATUSES.has(status)) {
    return {
      success: false,
      error: "Status must be active, away, or inactive.",
      errors: { status: "Status must be active, away, or inactive." },
    };
  }

  const sql = getDb();
  if (!sql) {
    const employee = updateDemoEmployeeStatus(employeeId, status);
    if (!employee) {
      return { success: false, error: "Employee not found." };
    }
    return { success: true, employee, source: "demo" };
  }

  try {
    await ensureEmployeesSchema(sql);
    const rows = await sql`
      UPDATE employees
      SET status = ${status}
      WHERE id = ${employeeId}
      RETURNING id, name, department, position, email, avatar, status, joined_at
    `;
    if (!rows.length) {
      return { success: false, error: "Employee not found." };
    }
    return {
      success: true,
      employee: mapEmployeeRow(rows[0]),
      source: "neon",
    };
  } catch (error) {
    console.warn("[updateEmployeeStatus]", error?.message || error);
    return {
      success: false,
      error: error.message || "Unable to update status.",
    };
  }
}

export async function deleteEmployee(id) {
  const employeeId = String(id || "").trim();
  if (!employeeId) {
    return { success: false, error: "Employee id is required." };
  }

  const sql = getDb();
  if (!sql) {
    const removed = removeDemoEmployee(employeeId);
    if (!removed) {
      return { success: false, error: "Employee not found." };
    }
    return { success: true, source: "demo" };
  }

  try {
    await ensureEmployeesSchema(sql);
    const rows = await sql`
      DELETE FROM employees
      WHERE id = ${employeeId}
      RETURNING id
    `;
    if (!rows.length) {
      return { success: false, error: "Employee not found." };
    }
    return { success: true, source: "neon" };
  } catch (error) {
    console.warn("[deleteEmployee]", error?.message || error);
    return {
      success: false,
      error: error.message || "Unable to delete employee.",
    };
  }
}
