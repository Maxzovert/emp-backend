export function getDepartmentCounts(employees) {
  const counts = {};
  for (const employee of employees) {
    const key = employee.department || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function getWorkforceStats(employees) {
  const total = employees.length;
  const active = employees.filter(
    (e) => String(e.status).toLowerCase() === "active",
  ).length;
  const away = employees.filter(
    (e) => String(e.status).toLowerCase() === "away",
  ).length;
  const inactive = employees.filter((e) => {
    const status = String(e.status).toLowerCase();
    return status !== "active" && status !== "away";
  }).length;
  const departments = new Set(employees.map((e) => e.department)).size;

  return { total, active, away, inactive, departments };
}

export function getStatusCounts(employees) {
  const stats = getWorkforceStats(employees);
  return [
    { name: "Active", value: stats.active },
    { name: "Away", value: stats.away },
    { name: "Inactive", value: stats.inactive },
  ].filter((item) => item.value > 0);
}

export function getDepartmentOverview(employees) {
  const byDept = getDepartmentCounts(employees);
  return byDept.map((item) => {
    const members = employees.filter((e) => e.department === item.name);
    const active = members.filter(
      (e) => String(e.status).toLowerCase() === "active",
    ).length;
    return {
      department: item.name,
      total: item.value,
      active,
      share: employees.length ? item.value / employees.length : 0,
    };
  });
}

/** Navy-first chart palette. */
export const CHART_COLORS = [
  "#2B5797",
  "#22c55e",
  "#8BB4E8",
  "#f59e0b",
  "#ef4444",
  "#888888",
  "#cccccc",
  "#5a5a5a",
];
