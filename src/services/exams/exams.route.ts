import { Router } from "express";
import {
  createTermExamController,
  getTermExamByIdController,
  getTermExamsByTermController,
  updateTermExamController,
  deleteTermExamController,
  createCbcAssessmentController,
  bulkCreateCbcAssessmentsController,
  getCbcAssessmentByIdController,
  getStudentCbcAssessmentsController,
  getExamSubjectPerformanceController,
  getStudentTermReportCardController,
  getExamSummaryAnalyticsController,
  deleteCbcAssessmentController,
} from "./exams.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  superAdminAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth";

const examsRouter = Router();

// Term Exams Management (Admin Level)
examsRouter.post("/term-exams", adminAuth, createTermExamController);
examsRouter.put("/term-exams/:id", adminAuth, updateTermExamController);
examsRouter.delete("/term-exams/:id", superAdminAuth, deleteTermExamController);

// Term Exams Retrieval (Open to authenticated users)
examsRouter.get("/term-exams/term/:termId", anyAuthenticatedUser, getTermExamsByTermController);
examsRouter.get("/term-exams/:id", anyAuthenticatedUser, getTermExamByIdController);

// CBC Assessments Management (Admin or Teacher Level)
examsRouter.post("/assessments", adminOrTeacherAuth, createCbcAssessmentController);
examsRouter.post("/assessments/bulk", adminOrTeacherAuth, bulkCreateCbcAssessmentsController);
examsRouter.delete("/assessments/:id", adminAuth, deleteCbcAssessmentController);

// CBC Assessments & Analytics Retrieval (Open to authenticated users)
examsRouter.get("/assessments/student/:studentId", anyAuthenticatedUser, getStudentCbcAssessmentsController);
examsRouter.get("/assessments/analytics/exam/:examId/subject/:subjectId", anyAuthenticatedUser, getExamSubjectPerformanceController);
examsRouter.get("/assessments/report-card/student/:studentId/term/:termId/exam/:examId", anyAuthenticatedUser, getStudentTermReportCardController);
examsRouter.get("/assessments/analytics/exam/:examId/summary", anyAuthenticatedUser, getExamSummaryAnalyticsController);
examsRouter.get("/assessments/:id", anyAuthenticatedUser, getCbcAssessmentByIdController);

export default examsRouter;