/**
 * Map a Neon row to the app employee shape.
 */
export function mapEmployeeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    position: row.position,
    email: row.email,
    avatar: row.avatar || null,
    status: row.status,
    joinedAt: row.joined_at
      ? new Date(row.joined_at).toISOString().slice(0, 10)
      : null,
  };
}

export function getDepartments(employees) {
  return [...new Set(employees.map((e) => e.department).filter(Boolean))].sort();
}
