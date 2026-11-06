// controllers/attendance.controller.ts
import { Request, Response } from "express";
import {
  markAttendanceService,
  bulkMarkAttendanceService,
  updateAttendanceService,
  deleteAttendanceService,
  markAbsentFromSheetService,
  getAttendanceByIdService,
  getStudentAttendanceForDateService,
  getStudentAttendanceHistoryService,
  getClassAttendanceForDateService,
  getClassAttendanceSummaryService,
  getSchoolAttendanceForDateService,
  getMonthlyAttendanceRegisterService,
  getStudentAttendanceStatsService,
  listAbsenteesForDateService,
  listLateArrivalsForDateService,
  listChronicAbsenteesService,
  listStudentsNotMarkedService,
  getAttendanceRateByClassService,
  countAttendanceByStatusService,
  getAttendanceTrendService,
  getAttendanceByGenderService,
  getSchoolAttendanceStatsService,
  getAttendanceComparisonService,
  bulkUpsertAttendanceService,
  copyAttendanceFromDateService,
  importAttendanceCsvService,
  validateAttendanceDateService,
  canMarkAttendanceService,
  getAttendanceAuditTrailService,
  getAttendanceSettingsService,
} from "./attendance.service";
import {
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  listAbsenteesSchema,
  attendanceHistoryQuerySchema,
  classMonthlyRegisterQuerySchema,
  chronicAbsenteesQuerySchema,
  attendanceTrendQuerySchema,
  attendanceStatsQuerySchema,
  countByStatusQuerySchema,
  bulkUpsertAttendanceSchema,
  copyAttendanceSchema,
  validateDateSchema,
  importAttendanceSchema,
  attendanceIdParamSchema,
  studentIdParamSchema,
  classIdParamSchema,
  schoolIdParamSchema,
  userIdParamSchema,
  studentDateParamSchema,
  classDateParamSchema,
} from "../../validators/attendance.validator";

// Get user ID from the authenticated request (populated by bearAuth middleware)
const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// MARKING
// ================================================================

/**
 * 1. Mark attendance for a single student on a single day
 */
export const markAttendanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to mark attendance." });
      return;
    }

    const validation = markAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't mark attendance — please correct the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }

    const result = await markAttendanceService(validation.data, userId);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't mark attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while marking attendance. Please try again.",
    });
  }
};

/**
 * 2. Bulk mark attendance for a whole class on a single day
 */
export const bulkMarkAttendanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to mark attendance." });
      return;
    }

    const validation = bulkMarkAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't mark attendance — check the roster entries and try again.",
        errors: validation.error.format(),
      });
      return;
    }

    const result = await bulkMarkAttendanceService(validation.data, userId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't bulk-mark attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while bulk-marking attendance. Please try again.",
    });
  }
};

/**
 * 3. Update a single attendance record
 */
export const updateAttendanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to update attendance." });
      return;
    }

    const p = attendanceIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid attendance ID.",
        errors: p.error.format(),
      });
      return;
    }

    const validation = updateAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Provide a status or remarks to update.",
        errors: validation.error.format(),
      });
      return;
    }

    const result = await updateAttendanceService(p.data.attendanceId, validation.data, userId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Attendance updated successfully."
        : `We couldn't update attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating attendance. Please try again.",
    });
  }
};

/**
 * 4. Delete an attendance record
 */
export const deleteAttendanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to delete attendance." });
      return;
    }

    const p = attendanceIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid attendance ID.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await deleteAttendanceService(p.data.attendanceId, userId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Attendance deleted successfully."
        : "We couldn't find that attendance record.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting attendance. Please try again.",
    });
  }
};

/**
 * 5. Auto-mark missing students as absent for a class on a day
 */
export const markAbsentFromSheetController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to mark attendance." });
      return;
    }

    const p = classDateParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid class ID and date.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await markAbsentFromSheetService(p.data.classId, p.data.date, userId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't auto-mark absentees — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while auto-marking absentees. Please try again.",
    });
  }
};

// ================================================================
// READS
// ================================================================

/**
 * 6. Get attendance by ID
 */
export const getAttendanceByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = attendanceIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid attendance ID.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getAttendanceByIdService(p.data.attendanceId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Attendance retrieved successfully."
        : "We couldn't find an attendance record with that ID.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching attendance. Please try again.",
    });
  }
};

/**
 * 7. Get one student's attendance for a date
 */
export const getStudentAttendanceForDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentDateParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid student ID and date.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getStudentAttendanceForDateService(p.data.studentId, p.data.date);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Attendance retrieved successfully."
        : result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching attendance. Please try again.",
    });
  }
};

/**
 * 8. Get a student's attendance history
 */
export const getStudentAttendanceHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid student ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = attendanceHistoryQuerySchema.safeParse(req.query);
    const opts = q.success
      ? { fromDate: q.data.fromDate, toDate: q.data.toDate, status: q.data.status }
      : undefined;

    const result = await getStudentAttendanceHistoryService(p.data.studentId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} attendance record(s) for this student.`
        : `We couldn't fetch attendance history — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching attendance history. Please try again.",
    });
  }
};

/**
 * 9. Get a class's attendance for a date (full register with students)
 */
export const getClassAttendanceForDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classDateParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid class ID and date.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getClassAttendanceForDateService(p.data.classId, p.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} attendance record(s) for this class on ${p.data.date}.`
        : `We couldn't fetch class attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching class attendance. Please try again.",
    });
  }
};

/**
 * 10. Get a class's attendance summary for a date
 */
export const getClassAttendanceSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classDateParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid class ID and date.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getClassAttendanceSummaryService(p.data.classId, p.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the summary. Please try again.",
    });
  }
};

/**
 * 11. Get school-wide attendance for a date
 */
export const getSchoolAttendanceForDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = listAbsenteesSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid date.",
        errors: q.error.format(),
      });
      return;
    }

    const result = await getSchoolAttendanceForDateService(p.data.schoolId, q.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the school-wide summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing school attendance. Please try again.",
    });
  }
};

/**
 * 12. Monthly attendance register for a class
 */
export const getMonthlyAttendanceRegisterController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid class ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = classMonthlyRegisterQuerySchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid year (2000–2100) and month (1–12).",
        errors: q.error.format(),
      });
      return;
    }

    const result = await getMonthlyAttendanceRegisterService(
      p.data.classId,
      q.data.year,
      q.data.month
    );
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't build the monthly register — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the register. Please try again.",
    });
  }
};

/**
 * 13. Get attendance stats for a student
 */
export const getStudentAttendanceStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid student ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = attendanceStatsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;

    const result = await getStudentAttendanceStatsService(p.data.studentId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute student stats — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing student stats. Please try again.",
    });
  }
};

// ================================================================
// ABSENTEES & ATTENTION LISTS
// ================================================================

/**
 * 14. List absentees for a school on a date
 */
export const listAbsenteesForDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = listAbsenteesSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid date.",
        errors: q.error.format(),
      });
      return;
    }

    const result = await listAbsenteesForDateService(p.data.schoolId, q.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't list absentees — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing absentees. Please try again.",
    });
  }
};

/**
 * 15. List late arrivals for a school on a date
 */
export const listLateArrivalsForDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = listAbsenteesSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid date.",
        errors: q.error.format(),
      });
      return;
    }

    const result = await listLateArrivalsForDateService(p.data.schoolId, q.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't list late arrivals — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing late arrivals. Please try again.",
    });
  }
};

/**
 * 16. List chronic absentees for a school
 */
export const listChronicAbsenteesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = chronicAbsenteesQuerySchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid threshold (0–100) and optional date range.",
        errors: q.error.format(),
      });
      return;
    }

    const result = await listChronicAbsenteesService(p.data.schoolId, {
      threshold: q.data.threshold,
      fromDate: q.data.fromDate,
      toDate: q.data.toDate,
    });
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't list chronic absentees — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing chronic absentees. Please try again.",
    });
  }
};

/**
 * 17. List students not yet marked for a class on a date
 */
export const listStudentsNotMarkedController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classDateParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid class ID and date.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await listStudentsNotMarkedService(p.data.classId, p.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't list unmarked students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing unmarked students. Please try again.",
    });
  }
};

// ================================================================
// ANALYTICS
// ================================================================

/**
 * 18. Attendance rate for a class
 */
export const getAttendanceRateByClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid class ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = attendanceStatsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;

    const result = await getAttendanceRateByClassService(p.data.classId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute class attendance rate — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the rate. Please try again.",
    });
  }
};

/**
 * 19. Count attendance by status for a school
 */
export const countAttendanceByStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = countByStatusQuerySchema.safeParse(req.query);
    const opts = q.success
      ? { date: q.data.date, fromDate: q.data.fromDate, toDate: q.data.toDate }
      : undefined;

    const result = await countAttendanceByStatusService(p.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't count attendance by status — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting attendance. Please try again.",
    });
  }
};

/**
 * 20. Attendance trend for a class over N days
 */
export const getAttendanceTrendController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid class ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = attendanceTrendQuerySchema.safeParse(req.query);
    const days = q.success ? q.data.days : 30;

    const result = await getAttendanceTrendService(p.data.classId, days);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't build the trend — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the trend. Please try again.",
    });
  }
};

/**
 * 21. Attendance by gender for a school
 */
export const getAttendanceByGenderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = countByStatusQuerySchema.safeParse(req.query);
    const opts = q.success
      ? { date: q.data.date, fromDate: q.data.fromDate, toDate: q.data.toDate }
      : undefined;

    const result = await getAttendanceByGenderService(p.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute gender breakdown — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing gender breakdown. Please try again.",
    });
  }
};

/**
 * 22. School-wide attendance stats
 */
export const getSchoolAttendanceStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = attendanceStatsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;

    const result = await getSchoolAttendanceStatsService(p.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute school stats — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing school stats. Please try again.",
    });
  }
};

/**
 * 23. Compare this month vs last month
 */
export const getAttendanceComparisonController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getAttendanceComparisonService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the comparison — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while comparing months. Please try again.",
    });
  }
};

// ================================================================
// BULK & IMPORT
// ================================================================

/**
 * 24. Bulk upsert — idempotent
 */
export const bulkUpsertAttendanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to mark attendance." });
      return;
    }

    const validation = bulkUpsertAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't upsert attendance — check the roster entries and try again.",
        errors: validation.error.format(),
      });
      return;
    }

    const result = await bulkUpsertAttendanceService(validation.data, userId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't upsert attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while upserting attendance. Please try again.",
    });
  }
};

/**
 * 25. Copy attendance from one date to another
 */
export const copyAttendanceFromDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to copy attendance." });
      return;
    }

    const validation = copyAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid class and two different dates.",
        errors: validation.error.format(),
      });
      return;
    }

    const result = await copyAttendanceFromDateService(validation.data, userId);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't copy attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while copying attendance. Please try again.",
    });
  }
};

/**
 * 26. Import attendance from CSV rows
 */
export const importAttendanceCsvController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to import attendance." });
      return;
    }

    const validation = importAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't import attendance — check the CSV rows and try again.",
        errors: validation.error.format(),
      });
      return;
    }

    const result = await importAttendanceCsvService(validation.data, userId);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't import attendance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while importing attendance. Please try again.",
    });
  }
};

// ================================================================
// HELPERS
// ================================================================

/**
 * 27. Validate whether a date is markable
 */
export const validateAttendanceDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const q = validateDateSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid date (YYYY-MM-DD).",
        errors: q.error.format(),
      });
      return;
    }

    const result = await validateAttendanceDateService(p.data.schoolId, q.data.date);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while validating the date. Please try again.",
    });
  }
};

/**
 * 28. Check if a user can mark attendance for a class
 */
export const canMarkAttendanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const u = userIdParamSchema.safeParse(req.params);
    const c = classIdParamSchema.safeParse(req.params);
    if (!u.success || !c.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid user ID and class ID.",
      });
      return;
    }

    const result = await canMarkAttendanceService(u.data.userId, c.data.classId);
    const statusCode = result.success ? 200 : 403;
    res.status(statusCode).json({
      ...result,
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while checking permissions. Please try again.",
    });
  }
};

/**
 * 29. Audit trail — who marked what, when
 */
export const getAttendanceAuditTrailController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classDateParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid class ID and date.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getAttendanceAuditTrailService(p.data.classId, p.data.date);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't build the audit trail — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the audit trail. Please try again.",
    });
  }
};

/**
 * 30. Get attendance settings for a school
 */
export const getAttendanceSettingsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid school ID.",
        errors: p.error.format(),
      });
      return;
    }

    const result = await getAttendanceSettingsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't fetch attendance settings — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching settings. Please try again.",
    });
  }
};