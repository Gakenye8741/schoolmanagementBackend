// controllers/students.controller.ts
import { Request, Response } from "express";
import {
  registerStudentService,
  getStudentByIdService,
  getStudentWithRelationsService,
  getStudentByAdmissionNumberService,
  getStudentByUserIdService,
  listStudentsBySchoolService,
  listStudentsByClassService,
  listStudentsByTermService,
  listStudentsByGradeLevelService,
  searchStudentsService,
  updateStudentService,
  softDeleteStudentService,
  restoreStudentService,
  enrollStudentInClassService,
  withdrawStudentService,
  reEnrollStudentService,
  promoteStudentService,
  graduateStudentService,
  repeatGradeService,
  transferStudentOutService,
  bulkPromoteStudentsService,
  addGuardianService,
  removeGuardianService,
  setPrimaryGuardianService,
  updateGuardianRelationshipService,
  listGuardiansService,
  listStudentsForGuardianService,
  countGuardiansForStudentService,
  listEnrollmentHistoryService,
  getCurrentEnrollmentService,
  getEnrollmentHistoryByTermService,
  getPromotionCandidatesService,
  getGraduationCandidatesService,
  addDocumentService,
  listDocumentsService,
  deleteDocumentService,
  toggleDocumentVisibilityService,
  addHealthRecordService,
  listHealthRecordsService,
  countStudentsBySchoolService,
  countStudentsByClassService,
  countStudentsByGenderService,
  validateStudentDataService,
  getStudentStatisticsService,
} from "./student.service";
import {
  registerStudentSchema,
  updateStudentSchema,
  searchStudentsSchema,
  listStudentsBySchoolSchema,
  listStudentsByClassSchema,
  getStudentByAdmissionSchema,
  enrollStudentInClassSchema,
  withdrawStudentSchema,
  promoteStudentSchema,
  graduateStudentSchema,
  repeatGradeSchema,
  transferStudentOutSchema,
  bulkPromoteStudentsSchema,
  addGuardianSchema,
  removeGuardianSchema,
  setPrimaryGuardianSchema,
  updateGuardianRelationshipSchema,
  addDocumentSchema,
  toggleDocumentVisibilitySchema,
  addHealthRecordSchema,
  studentIdParamSchema,
  classIdParamSchema,
  guardianUserIdParamSchema,
  documentIdParamSchema,
  userIdParamSchema,
  termIdParamSchema,
} from "../../validators/students.validators";

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

// ================================================================
// REGISTRATION
// ================================================================
export const registerStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = registerStudentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't register the student — please correct the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await registerStudentService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't register the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while registering the student. Please try again.",
    });
  }
};

// ================================================================
// READS
// ================================================================
export const getStudentByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid student ID — must be a valid UUID.",
        errors: p.error.format(),
      });
      return;
    }
    const result = await getStudentByIdService(p.data.studentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student retrieved successfully."
        : "We couldn't find a student with that ID — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the student. Please try again.",
    });
  }
};

export const getStudentWithRelationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false, message: "Invalid student ID.", errors: p.error.format(),
      });
      return;
    }
    const result = await getStudentWithRelationsService(p.data.studentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student with class, guardians, and history retrieved."
        : "We couldn't find that student — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while fetching the student.",
    });
  }
};

export const getStudentByAdmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);
    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID is required." });
      return;
    }
    const q = getStudentByAdmissionSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false, message: "Provide a valid admission number.", errors: q.error.format(),
      });
      return;
    }
    const result = await getStudentByAdmissionNumberService(schoolId, q.data.admissionNumber);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student retrieved successfully."
        : `No student with admission number "${q.data.admissionNumber}" was found.`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while fetching the student.",
    });
  }
};

export const getStudentByUserIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = userIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid user ID.", errors: p.error.format() });
      return;
    }
    const result = await getStudentByUserIdService(p.data.userId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student profile retrieved for this user."
        : "No student profile is linked to that user account.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while fetching the student.",
    });
  }
};

// ================================================================
// LISTS
// ================================================================
export const listStudentsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);
    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID is required." });
      return;
    }
    const q = listStudentsBySchoolSchema.safeParse(req.query);
    const result = await listStudentsBySchoolService(schoolId, {
      includeInactive: q.success ? q.data.includeInactive : false,
    });
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} student(s) for this school.`
        : `We couldn't list the school's students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing students.",
    });
  }
};

export const listStudentsByClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);
    if (!classId) {
      res.status(400).json({ success: false, message: "Class ID is required." });
      return;
    }
    const q = listStudentsByClassSchema.safeParse(req.query);
    const result = await listStudentsByClassService(classId, {
      includeInactive: q.success ? q.data.includeInactive : false,
    });
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} student(s) in this class.`
        : `We couldn't list the class students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing class students.",
    });
  }
};

export const listStudentsByTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = termIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid term ID.", errors: p.error.format() });
      return;
    }
    const result = await listStudentsByTermService(p.data.termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} student(s) for this term.`
        : `We couldn't list the term's students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing term students.",
    });
  }
};

export const listStudentsByGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);
    if (!gradeLevelId) {
      res.status(400).json({ success: false, message: "Grade level ID is required." });
      return;
    }
    const result = await listStudentsByGradeLevelService(gradeLevelId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} student(s) for this grade level.`
        : `We couldn't list the grade level students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing grade level students.",
    });
  }
};

export const searchStudentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);
    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID is required." });
      return;
    }
    const q = searchStudentsSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false, message: "Provide a valid search query.", errors: q.error.format(),
      });
      return;
    }
    const result = await searchStudentsService(schoolId, q.data.query);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} student(s) matching "${q.data.query}".`
        : `We couldn't search students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while searching students.",
    });
  }
};

// ================================================================
// UPDATE / DELETE
// ================================================================
export const updateStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = updateStudentSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the student — check the highlighted fields and try again.",
        errors: body.error.format(),
      });
      return;
    }
    const result = await updateStudentService(p.data.studentId, body.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student updated successfully."
        : `We couldn't update the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while updating the student.",
    });
  }
};

export const softDeleteStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await softDeleteStudentService(p.data.studentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student deleted (soft). They can be restored."
        : "We couldn't find that student — it may have already been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while deleting the student.",
    });
  }
};

export const restoreStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await restoreStudentService(p.data.studentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Student restored successfully." : "We couldn't find that student.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while restoring the student.",
    });
  }
};

// ================================================================
// LIFECYCLE
// ================================================================
export const enrollStudentInClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = enrollStudentInClassSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false, message: "Provide a valid classId and optional termId.", errors: body.error.format(),
      });
      return;
    }
    const result = await enrollStudentInClassService(p.data.studentId, body.data.classId, {
      termId: body.data.termId,
      requireUnplaced: body.data.requireUnplaced,
    });
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't enroll the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while enrolling the student.",
    });
  }
};

export const withdrawStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = withdrawStudentSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false, message: "A withdrawal reason is required.", errors: body.error.format(),
      });
      return;
    }
    const result = await withdrawStudentService(p.data.studentId, body.data.reason);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student withdrawn successfully."
        : `We couldn't withdraw the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while withdrawing the student.",
    });
  }
};

export const reEnrollStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await reEnrollStudentService(p.data.studentId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student re-enrolled successfully."
        : `We couldn't re-enroll the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while re-enrolling the student.",
    });
  }
};

export const promoteStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = promoteStudentSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false, message: "Invalid promotion payload.", errors: body.error.format(),
      });
      return;
    }
    const result = await promoteStudentService(p.data.studentId, body.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't promote the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while promoting the student.",
    });
  }
};

export const graduateStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = graduateStudentSchema.safeParse(req.body ?? {});
    const result = await graduateStudentService(p.data.studentId, body.success ? body.data : {});
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student graduated successfully."
        : `We couldn't graduate the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while graduating the student.",
    });
  }
};

export const repeatGradeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = repeatGradeSchema.safeParse(req.body ?? {});
    const result = await repeatGradeService(p.data.studentId, body.success ? body.data : {});
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student retained in the same grade."
        : `We couldn't repeat the grade — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while retaining the student.",
    });
  }
};

export const transferStudentOutController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = transferStudentOutSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false,
        message: "Provide the target school and a transfer reason.",
        errors: body.error.format(),
      });
      return;
    }
    const result = await transferStudentOutService(
      p.data.studentId,
      body.data.toSchool,
      body.data.reason
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Student transferred out to ${body.data.toSchool}.`
        : `We couldn't transfer the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while transferring the student.",
    });
  }
};

export const bulkPromoteStudentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = bulkPromoteStudentsSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false,
        message: "Provide valid schoolId, fromClassId, and toClassId (they must differ).",
        errors: body.error.format(),
      });
      return;
    }
    const result = await bulkPromoteStudentsService(
      body.data.schoolId,
      body.data.fromClassId,
      body.data.toClassId,
      { termId: body.data.termId }
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't bulk-promote the students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while bulk-promoting.",
    });
  }
};

// ================================================================
// GUARDIANS
// ================================================================
export const addGuardianController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = addGuardianSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false, message: "Provide a valid guardianUserId.", errors: body.error.format(),
      });
      return;
    }
    const result = await addGuardianService(p.data.studentId, body.data.guardianUserId, {
      relationship: body.data.relationship,
      isPrimary: body.data.isPrimary,
      isFeePayer: body.data.isFeePayer,
      canPickup: body.data.canPickup,
    });
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't link the guardian — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while linking the guardian.",
    });
  }
};

export const removeGuardianController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    const body = removeGuardianSchema.safeParse(req.body);
    if (!p.success || !body.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid student ID and guardianUserId.",
        errors: (!p.success ? p.error : (body as any).error).format(),
      });
      return;
    }
    const result = await removeGuardianService(p.data.studentId, body.data.guardianUserId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Guardian unlinked from the student."
        : "That guardian is not currently linked to the student.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while unlinking the guardian.",
    });
  }
};

export const setPrimaryGuardianController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    const body = setPrimaryGuardianSchema.safeParse(req.body);
    if (!p.success || !body.success) {
      res.status(400).json({
        success: false, message: "Provide a valid student ID and guardianUserId.",
        errors: (!p.success ? p.error : (body as any).error).format(),
      });
      return;
    }
    const result = await setPrimaryGuardianService(p.data.studentId, body.data.guardianUserId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Primary guardian updated."
        : `We couldn't set the primary guardian — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while setting the primary guardian.",
    });
  }
};

export const updateGuardianRelationshipController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    const g = guardianUserIdParamSchema.safeParse(req.params);
    const body = updateGuardianRelationshipSchema.safeParse(req.body);
    if (!p.success || !g.success || !body.success) {
      res.status(400).json({
        success: false, message: "Check the IDs and payload.",
      });
      return;
    }
    const result = await updateGuardianRelationshipService(
      p.data.studentId, g.data.guardianUserId, body.data
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Guardian details updated."
        : `We couldn't update the guardian — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while updating the guardian.",
    });
  }
};

export const listGuardiansController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await listGuardiansService(p.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.count === 0
          ? "This student has no guardians linked yet."
          : `Fetched ${result.count} guardian(s).`
        : `We couldn't list guardians — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing guardians.",
    });
  }
};

export const listStudentsForGuardianController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = guardianUserIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid guardian ID.", errors: p.error.format() });
      return;
    }
    const result = await listStudentsForGuardianService(p.data.guardianUserId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} student(s) for this guardian.`
        : `We couldn't list the guardian's students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing guardian students.",
    });
  }
};

export const countGuardiansForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await countGuardiansForStudentService(p.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This student has ${result.count ?? 0} guardian(s).`
        : `We couldn't count guardians — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while counting guardians.",
    });
  }
};

// ================================================================
// ENROLLMENT HISTORY
// ================================================================
export const listEnrollmentHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await listEnrollmentHistoryService(p.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} enrollment record(s).`
        : `We couldn't list enrollment history — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing enrollment history.",
    });
  }
};

export const getCurrentEnrollmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await getCurrentEnrollmentService(p.data.studentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Current enrollment fetched."
        : result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while fetching enrollment.",
    });
  }
};

export const getEnrollmentHistoryByTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!p.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid student or term ID." });
      return;
    }
    const result = await getEnrollmentHistoryByTermService(p.data.studentId, t.data.termId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Enrollment record fetched."
        : "No enrollment record for that term.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while fetching enrollment.",
    });
  }
};

export const getPromotionCandidatesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);
    if (!classId) {
      res.status(400).json({ success: false, message: "Class ID is required." });
      return;
    }
    const result = await getPromotionCandidatesService(classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't list promotion candidates — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing promotion candidates.",
    });
  }
};

export const getGraduationCandidatesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);
    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID is required." });
      return;
    }
    const result = await getGraduationCandidatesService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't list graduation candidates — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing graduation candidates.",
    });
  }
};

// ================================================================
// DOCUMENTS
// ================================================================
export const addDocumentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = addDocumentSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't add the document — check the highlighted fields and try again.",
        errors: body.error.format(),
      });
      return;
    }
    const result = await addDocumentService({ ...body.data, studentId: p.data.studentId });
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Document added successfully."
        : `We couldn't add the document — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while adding the document.",
    });
  }
};

export const listDocumentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await listDocumentsService(p.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} document(s).`
        : `We couldn't list documents — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing documents.",
    });
  }
};

export const deleteDocumentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = documentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid document ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteDocumentService(p.data.documentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Document deleted." : "Document not found.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while deleting the document.",
    });
  }
};

export const toggleDocumentVisibilityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = documentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid document ID.", errors: p.error.format() });
      return;
    }
    const body = toggleDocumentVisibilitySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false, message: "Provide isVisibleToParent as true or false.", errors: body.error.format(),
      });
      return;
    }
    const result = await toggleDocumentVisibilityService(
      p.data.documentId, body.data.isVisibleToParent
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't update document visibility — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while updating visibility.",
    });
  }
};

// ================================================================
// HEALTH RECORDS
// ================================================================
export const addHealthRecordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const body = addHealthRecordSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false, message: "Check the highlighted health record fields and try again.",
        errors: body.error.format(),
      });
      return;
    }
    const result = await addHealthRecordService({ ...body.data, studentId: p.data.studentId });
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Health record added."
        : `We couldn't add the health record — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while adding the health record.",
    });
  }
};

export const listHealthRecordsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await listHealthRecordsService(p.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} health record(s).`
        : `We couldn't list health records — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while listing health records.",
    });
  }
};

// ================================================================
// STATS & VALIDATION
// ================================================================
export const countStudentsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);
    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID is required." });
      return;
    }
    const result = await countStudentsBySchoolService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This school has ${result.count ?? 0} enrolled student(s).`
        : `We couldn't count students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while counting students.",
    });
  }
};

export const countStudentsByClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const result = await countStudentsByClassService(p.data.classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This class has ${result.count ?? 0} enrolled student(s).`
        : `We couldn't count class students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while counting class students.",
    });
  }
};

export const countStudentsByGenderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);
    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID is required." });
      return;
    }
    const result = await countStudentsByGenderService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't count by gender — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while counting by gender.",
    });
  }
};

export const validateStudentDataController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await validateStudentDataService(p.data.studentId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student data is complete."
        : result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while validating the student.",
    });
  }
};

export const getStudentStatisticsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await getStudentStatisticsService(p.data.studentId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student statistics computed."
        : `We couldn't compute statistics — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, message: error.message || "Something went wrong while computing statistics.",
    });
  }
};