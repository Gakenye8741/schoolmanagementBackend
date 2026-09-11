import { Router } from "express";
import {
  createFeeItemController,
  getFeeItemByIdController,
  getFeeItemsBySchoolController,
  updateFeeItemController,
  deleteFeeItemController,
  createClassFeeStructureController,
  getClassFeeStructuresController,
  updateClassFeeStructureController,
  deleteClassFeeStructureController,
  recordFeeTransactionController,
  updateFeeTransactionController,
  deleteFeeTransactionController,
  getStudentFeeTransactionsController,
  getSchoolFeeTransactionsController,
  getStudentFeeStatementController,
  getSchoolTermCollectionSummaryController
} from "./finance.controller";
import { 
  adminAuth, 
  bursarAuth, 
  adminOrTeacherAuth, 
  anyAuthenticatedUser, 
  authMiddleware 
} from "../../middleware/bearAuth";

const financeRouter = Router();

/**
 * Fee Items Routes
 */
financeRouter.post("/items", authMiddleware(["super_admin", "school_admin", "bursar"]), createFeeItemController);
financeRouter.get("/items/school/:schoolId", authMiddleware(["super_admin", "school_admin", "bursar", "teacher"]), getFeeItemsBySchoolController);
financeRouter.get("/items/:id", authMiddleware(["super_admin", "school_admin", "bursar", "teacher"]), getFeeItemByIdController);
financeRouter.put("/items/:id", authMiddleware(["super_admin", "school_admin", "bursar"]), updateFeeItemController);
financeRouter.delete("/items/:id", adminAuth, deleteFeeItemController);

/**
 * Class Fee Structures Routes
 */
financeRouter.post("/structures", authMiddleware(["super_admin", "school_admin", "bursar"]), createClassFeeStructureController);
financeRouter.get("/structures", authMiddleware(["super_admin", "school_admin", "bursar", "teacher"]), getClassFeeStructuresController); // Requires ?termId=...&gradeLevel=...
financeRouter.put("/structures/:id", authMiddleware(["super_admin", "school_admin", "bursar"]), updateClassFeeStructureController);
financeRouter.delete("/structures/:id", adminAuth, deleteClassFeeStructureController);

/**
 * Fee Transactions & Reports Routes
 */
financeRouter.post("/transactions", bursarAuth, recordFeeTransactionController);
financeRouter.get("/transactions/school/:schoolId", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolFeeTransactionsController);
financeRouter.get("/transactions/student/:studentId", anyAuthenticatedUser, getStudentFeeTransactionsController);
financeRouter.put("/transactions/:id", bursarAuth, updateFeeTransactionController);
financeRouter.delete("/transactions/:id", adminAuth, deleteFeeTransactionController);

/**
 * Statements & Summaries Routes
 */
financeRouter.get("/statements/student/:studentId", anyAuthenticatedUser, getStudentFeeStatementController); // Requires ?termId=...&gradeLevel=...
financeRouter.get("/collections/school/:schoolId", authMiddleware(["super_admin", "school_admin", "bursar"]), getSchoolTermCollectionSummaryController); // Requires ?termId=...

export default financeRouter;