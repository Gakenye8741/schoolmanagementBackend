// src/services/discipline/discipline.controller.ts
import { Request, Response } from "express";
import {
  recordIncidentService,
  bulkRecordIncidentsService,
  updateIncidentService,
  markParentNotifiedService,
  deleteIncidentService,
  getIncidentByIdService,
  listIncidentsForStudentService,
  listIncidentsForClassService,
  listIncidentsForSchoolService,
  listIncidentsByTypeService,
  listIncidentsByDateRangeService,
  getStudentDisciplineSummaryService,
  getClassDisciplineSummaryService,
  getSchoolDisciplineStatsService,
  getDisciplineTrendService,
  getMeritStudentsService,
} from "./discipline.service";
import {
  recordIncidentSchema,
  bulkRecordIncidentsSchema,
  updateIncidentSchema,
  listIncidentsForStudentSchema,
  listIncidentsForClassSchema,
  listIncidentsForSchoolSchema,
  listIncidentsByDateRangeSchema,
  disciplineTrendQuerySchema,
  incidentIdParamSchema,
  studentIdParamSchema,
  classIdParamSchema,
  schoolIdParamSchema,
} from "../../validators/discipline.validator";

const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// RECORDING
// ================================================================

/** 1. Record a single incident. */
export const recordIncidentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to record an incident." });
      return;
    }
    const v = recordIncidentSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't record the incident — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await recordIncidentService({ ...v.data, recordedBy: userId } as any);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't record the incident — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while recording the incident.",
    });
  }
};

/** 2. Bulk record multiple incidents. */
export const bulkRecordIncidentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to record incidents." });
      return;
    }
    const v = bulkRecordIncidentsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't record the incidents — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await bulkRecordIncidentsService({ ...v.data, recordedBy: userId } as any);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't record the incidents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while recording incidents.",
    });
  }
};

// ================================================================
// UPDATE / DELETE
// ================================================================

/** 3. Update an incident. */
export const updateIncidentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = incidentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid incident ID.", errors: p.error.format() });
      return;
    }
    const v = updateIncidentSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await updateIncidentService(p.data.incidentId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Incident updated."
        : `We couldn't update the incident — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the incident.",
    });
  }
};

/** 4. Mark parent notified (explicit). */
export const markParentNotifiedController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = incidentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid incident ID.", errors: p.error.format() });
      return;
    }
    const result = await markParentNotifiedService(p.data.incidentId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Marked as parent-notified."
        : `We couldn't mark as notified — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while marking parent notified.",
    });
  }
};

/** 5. Delete an incident. */
export const deleteIncidentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = incidentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid incident ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteIncidentService(p.data.incidentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Incident deleted." : "We couldn't find that incident.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the incident.",
    });
  }
};

// ================================================================
// READS
// ================================================================

/** 6. Get incident by ID. */
export const getIncidentByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = incidentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid incident ID.", errors: p.error.format() });
      return;
    }
    const result = await getIncidentByIdService(p.data.incidentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Incident retrieved." : "We couldn't find that incident.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the incident.",
    });
  }
};

/** 7. List incidents for a student. */
export const listIncidentsForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const q = listIncidentsForStudentSchema.safeParse(req.query);
    const opts = q.success ? q.data : undefined;
    const result = await listIncidentsForStudentService(p.data.studentId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} incident(s) for this student.`
        : `We couldn't list incidents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing student incidents.",
    });
  }
};

/** 8. List incidents for a class. */
export const listIncidentsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const q = listIncidentsForClassSchema.safeParse(req.query);
    const opts = q.success ? q.data : undefined;
    const result = await listIncidentsForClassService(p.data.classId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} incident(s) for this class.`
        : `We couldn't list incidents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing class incidents.",
    });
  }
};

/** 9. List incidents for a school (with filters). */
export const listIncidentsForSchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = listIncidentsForSchoolSchema.safeParse(req.query);
    const opts = q.success ? q.data : undefined;
    const result = await listIncidentsForSchoolService(p.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} incident(s).`
        : `We couldn't list incidents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing incidents.",
    });
  }
};

/** 10. List incidents by type. */
export const listIncidentsByTypeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const rawType = req.query.type;
    const typeStr = typeof rawType === "string" ? rawType : undefined;
    const allowed = ["Merit", "Warning", "Late-coming", "Detention", "Suspension"];
    if (!typeStr || !allowed.includes(typeStr)) {
      res.status(400).json({
        success: false,
        message: 'Provide a valid incident type: "Merit", "Warning", "Late-coming", "Detention", or "Suspension".',
      });
      return;
    }
    const result = await listIncidentsByTypeService(p.data.schoolId, typeStr as any);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} "${typeStr}" incident(s).`
        : `We couldn't list incidents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing incidents by type.",
    });
  }
};

/** 11. List incidents by date range. */
export const listIncidentsByDateRangeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = listIncidentsByDateRangeSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid fromDate and toDate.",
        errors: q.error.format(),
      });
      return;
    }
    const result = await listIncidentsByDateRangeService(
      p.data.schoolId,
      q.data.fromDate,
      q.data.toDate
    );
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} incident(s) in the date range.`
        : `We couldn't list incidents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing incidents by date range.",
    });
  }
};

// ================================================================
// SUMMARY & ANALYTICS
// ================================================================

/** 12. Get student discipline summary. */
export const getStudentDisciplineSummaryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await getStudentDisciplineSummaryService(p.data.studentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the summary.",
    });
  }
};

/** 13. Get class discipline summary. */
export const getClassDisciplineSummaryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const result = await getClassDisciplineSummaryService(p.data.classId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the class summary.",
    });
  }
};

/** 14. Get school discipline stats. */
export const getSchoolDisciplineStatsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = listIncidentsForStudentSchema.safeParse(req.query);
    const opts = q.success
      ? { fromDate: q.data.fromDate, toDate: q.data.toDate }
      : undefined;
    const result = await getSchoolDisciplineStatsService(p.data.schoolId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute the stats — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the stats.",
    });
  }
};

/** 15. Get discipline trend over N days. */
export const getDisciplineTrendController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = disciplineTrendQuerySchema.safeParse(req.query);
    const days = q.success ? q.data.days : 30;
    const result = await getDisciplineTrendService(p.data.schoolId, days);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the trend — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the trend.",
    });
  }
};

/** 16. Get merit students. */
export const getMeritStudentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await getMeritStudentsService(p.data.schoolId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't fetch merit students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching merit students.",
    });
  }
};