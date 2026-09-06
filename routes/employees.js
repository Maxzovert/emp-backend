import { Router } from "express";
import { createEmployee, listEmployees } from "../db/employees.js";
import { getDepartments } from "../db/mappers.js";
import { deleteEmployee, updateEmployeeStatus } from "../db/employees.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const department = String(req.query.department || "all");

    if (query.length > 120) {
      return res
        .status(400)
        .json({ success: false, error: "Search query is too long." });
    }

    const [{ employees, source }, all] = await Promise.all([
      listEmployees({ query, department }),
      listEmployees(),
    ]);

    res.json({
      success: true,
      employees,
      departments: getDepartments(all.employees),
      source,
      count: employees.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Unable to load employees.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const result = await createEmployee(req.body || {});
    const status = result.success ? 201 : result.errors ? 400 : 500;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Unable to create employee.",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const result = await updateEmployeeStatus(req.params.id, req.body?.status);
    const status = result.success
      ? 200
      : result.error?.includes("not found")
        ? 404
        : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Unable to update employee.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteEmployee(req.params.id);
    const status = result.success
      ? 200
      : result.error?.includes("not found")
        ? 404
        : 400;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Unable to delete employee.",
    });
  }
});

export default router;
