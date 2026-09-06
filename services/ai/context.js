import { listEmployees } from "../../db/employees.js";
import { getDepartmentCounts, getWorkforceStats } from "../../utils/analyticsUtils.js";

const MAX_ROWS = 12;

const ROLE_ALIASES = {
  pm: "product manager",
  "product manager": "product manager",
  engineer: "engineer",
  eng: "engineering",
  engineering: "engineering",
  designer: "design",
  design: "design",
  marketing: "marketing",
  people: "people",
  hr: "people",
  ops: "operations",
  operations: "operations",
  analytics: "analytics",
  data: "analytics",
  leadership: "leadership",
};

function normalizeMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ");
}

function expandTerms(message) {
  const normalized = normalizeMessage(message);
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);
  const terms = new Set(words);

  for (const [alias, canonical] of Object.entries(ROLE_ALIASES)) {
    if (normalized.includes(alias)) {
      terms.add(canonical);
      canonical.split(/\s+/).forEach((part) => terms.add(part));
    }
  }

  return [...terms];
}

function formatEmployeeLine(employee) {
  return `- ${employee.name} | ${employee.department} | ${employee.position} | status: ${employee.status}`;
}

function scoreEmployee(employee, terms) {
  const hay =
    `${employee.name} ${employee.department} ${employee.position} ${employee.status}`.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (hay.includes(term)) score += term.length > 4 ? 2 : 1;
  }
  return score;
}

function wantsStats(message) {
  return /stat|count|how many|headcount|overview|summary|department/i.test(
    message,
  );
}

/**
 * Build grounded employee context for AI prompts.
 * Includes a short workforce summary when useful; caps people rows; omits email.
 */
export async function buildEmployeeContext({ message = "" } = {}) {
  const { employees, source } = await listEmployees();

  if (!employees.length) {
    return { text: "", rowCount: 0, source };
  }

  const stats = getWorkforceStats(employees);
  const departments = getDepartmentCounts(employees);
  const terms = expandTerms(message);

  const ranked = [...employees]
    .map((employee) => ({
      employee,
      score: scoreEmployee(employee, terms),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.employee.name.localeCompare(b.employee.name),
    );

  const relevant = ranked
    .filter((item) => item.score > 0)
    .map((item) => item.employee);

  const selected =
    relevant.length > 0
      ? relevant.slice(0, MAX_ROWS)
      : ranked.slice(0, Math.min(12, MAX_ROWS)).map((item) => item.employee);

  const summaryLines = [
    `Workforce summary: ${stats.total} total, ${stats.active} active, ${stats.away} away, ${stats.inactive} inactive, ${stats.departments} departments.`,
    `Departments: ${departments.map((d) => `${d.name} (${d.value})`).join(", ")}.`,
  ];

  const peopleBlock = selected.map(formatEmployeeLine).join("\n");
  const includeSummary = wantsStats(message) || relevant.length === 0;

  const text = [
    includeSummary ? summaryLines.join("\n") : null,
    "People records:",
    peopleBlock,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    text,
    rowCount: selected.length,
    source,
    matched: relevant.length,
  };
}
