export function filterEmployees(employees, { query = "", department = "all" } = {}) {
  const q = query.trim().toLowerCase();

  return employees.filter((employee) => {
    const matchesDept =
      department === "all" || employee.department === department;
    if (!matchesDept) return false;
    if (!q) return true;

    const haystack = [
      employee.name,
      employee.email,
      employee.position,
      employee.department,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function getDepartmentsFromList(employees = []) {
  return [...new Set(employees.map((e) => e.department).filter(Boolean))].sort();
}
