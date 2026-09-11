import { Router } from "express";
import {
  createSchoolExpenseController,
  getSchoolExpenseByIdController,
  getSchoolExpensesBySchoolController,
  updateSchoolExpenseController,
  deleteSchoolExpenseController,
  getSchoolExpensesByCategoryController,
  getSchoolExpensesByDateRangeController,
  getSchoolExpenseCategorySummaryController
} from "./expenses.controller";
import { 
  adminAuth, 
  authMiddleware 
} from "../../middleware/bearAuth";

const expensesRouter = Router();

/**
 * School Expenses Routes
 */
expensesRouter.post("/", authMiddleware(["super_admin", "school_admin", "bursar"]), createSchoolExpenseController);
expensesRouter.get("/school/:schoolId", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolExpensesBySchoolController);
expensesRouter.get("/school/:schoolId/category", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolExpensesByCategoryController); // Requires ?category=...
expensesRouter.get("/school/:schoolId/date-range", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolExpensesByDateRangeController); // Requires ?startDate=...&endDate=...
expensesRouter.get("/school/:schoolId/summary", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolExpenseCategorySummaryController); // Optional ?startDate=...&endDate=...
expensesRouter.get("/:id", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolExpenseByIdController);
expensesRouter.put("/:id", authMiddleware(["super_admin", "school_admin", "bursar"]), updateSchoolExpenseController);
expensesRouter.delete("/:id", adminAuth, deleteSchoolExpenseController);

export default expensesRouter;