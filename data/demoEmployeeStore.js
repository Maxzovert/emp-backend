import { DEMO_EMPLOYEES } from "./employees.js";

/**
 * Process-local mutable copy used when DATABASE_URL is unset.
 * Survives within the Node process (dev / single instance).
 */
let demoEmployees = DEMO_EMPLOYEES.map((employee) => ({ ...employee }));

export function getDemoEmployees() {
  return demoEmployees.map((employee) => ({ ...employee }));
}

export function addDemoEmployee(employee) {
  demoEmployees = [employee, ...demoEmployees];
  return { ...employee };
}

export function removeDemoEmployee(id) {
  const before = demoEmployees.length;
  demoEmployees = demoEmployees.filter((employee) => employee.id !== id);
  return demoEmployees.length < before;
}

export function findDemoEmployeeByEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  return demoEmployees.find(
    (employee) => employee.email.toLowerCase() === normalized,
  );
}

export function updateDemoEmployeeStatus(id, status) {
  const employeeId = String(id || "").trim();
  let updated = null;
  demoEmployees = demoEmployees.map((employee) => {
    if (employee.id !== employeeId) return employee;
    updated = { ...employee, status };
    return updated;
  });
  return updated;
}
