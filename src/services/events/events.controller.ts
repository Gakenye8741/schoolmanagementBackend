import { Request, Response } from "express";
import {
  insertSchoolEventSchema,
  updateSchoolEventSchema,
  insertCoCurricularActivitySchema,
  updateCoCurricularActivitySchema,
  insertStudentActivityMembershipSchema,
  updateStudentActivityMembershipSchema,
  bulkEnrollStudentsSchema,
} from "../../validators/events.validator"; // Adjust path as needed
import {
  createSchoolEventService,
  getSchoolEventByIdService,
  getSchoolEventsBySchoolService,
  getUpcomingSchoolEventsService,
  getSchoolEventsByCategoryService,
  updateSchoolEventService,
  deleteSchoolEventService,
  createCoCurricularActivityService,
  getCoCurricularActivityByIdService,
  getCoCurricularActivitiesBySchoolService,
  updateCoCurricularActivityService,
  deleteCoCurricularActivityService,
  enrollStudentInActivityService,
  bulkEnrollStudentsService,
  getMembershipsByActivityService,
  getMembershipsByStudentService,
  updateMembershipService,
  removeStudentMembershipService,
} from "./events.service"; // Adjust path as needed

// ==========================================
// SCHOOL EVENTS CONTROLLERS
// ==========================================

export const createSchoolEventController = async (req: Request, res: Response) => {
  const validation = insertSchoolEventSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const result = await createSchoolEventService(validation.data);
  const status = result.success ? 201 : 400;
  return res.status(status).json(result);
};

export const getSchoolEventByIdController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getSchoolEventByIdService(id);
  const status = result.success ? 200 : 404;
  return res.status(status).json(result);
};

export const getSchoolEventsBySchoolController = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  const result = await getSchoolEventsBySchoolService(schoolId);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const getUpcomingSchoolEventsController = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  const result = await getUpcomingSchoolEventsService(schoolId);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const getSchoolEventsByCategoryController = async (req: Request, res: Response) => {
  const { schoolId, category } = req.params;
  const result = await getSchoolEventsByCategoryService(schoolId, category);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const updateSchoolEventController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = updateSchoolEventSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const result = await updateSchoolEventService(id, validation.data);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const deleteSchoolEventController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await deleteSchoolEventService(id);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};


// ==========================================
// CO-CURRICULAR ACTIVITIES CONTROLLERS
// ==========================================

export const createCoCurricularActivityController = async (req: Request, res: Response) => {
  const validation = insertCoCurricularActivitySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const result = await createCoCurricularActivityService(validation.data);
  const status = result.success ? 201 : 400;
  return res.status(status).json(result);
};

export const getCoCurricularActivityByIdController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getCoCurricularActivityByIdService(id);
  const status = result.success ? 200 : 404;
  return res.status(status).json(result);
};

export const getCoCurricularActivitiesBySchoolController = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  const result = await getCoCurricularActivitiesBySchoolService(schoolId);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const updateCoCurricularActivityController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = updateCoCurricularActivitySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const result = await updateCoCurricularActivityService(id, validation.data);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const deleteCoCurricularActivityController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await deleteCoCurricularActivityService(id);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};


// ==========================================
// STUDENT ACTIVITY MEMBERSHIPS CONTROLLERS
// ==========================================

export const enrollStudentInActivityController = async (req: Request, res: Response) => {
  const validation = insertStudentActivityMembershipSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const result = await enrollStudentInActivityService(validation.data);
  const status = result.success ? 201 : 400;
  return res.status(status).json(result);
};

export const bulkEnrollStudentsController = async (req: Request, res: Response) => {
  const validation = bulkEnrollStudentsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const { activityId, termId, studentIds } = validation.data;
  const result = await bulkEnrollStudentsService(activityId, termId, studentIds);
  const status = result.success ? 201 : 400;
  return res.status(status).json(result);
};

export const getMembershipsByActivityController = async (req: Request, res: Response) => {
  const { activityId } = req.params;
  const result = await getMembershipsByActivityService(activityId);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const getMembershipsByStudentController = async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const result = await getMembershipsByStudentService(studentId);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const updateMembershipController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = updateStudentActivityMembershipSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.format(),
    });
  }

  const result = await updateMembershipService(id, validation.data);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};

export const removeStudentMembershipController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await removeStudentMembershipService(id);
  const status = result.success ? 200 : 400;
  return res.status(status).json(result);
};