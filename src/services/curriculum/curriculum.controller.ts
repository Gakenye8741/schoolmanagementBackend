// src/services/curriculum/curriculum.controller.ts
import { Request, Response } from "express";
import {
  createStrandService,
  bulkCreateStrandsService,
  getStrandByIdService,
  getStrandWithSubStrandsService,
  listStrandsForSubjectAndGradeService,
  listStrandsForSchoolService,
  updateStrandService,
  deleteStrandService,
  reorderStrandsService,
  countStrandsService,
  getCurriculumTreeService,
  createSubStrandService,
  bulkCreateSubStrandsService,
  getSubStrandByIdService,
  listSubStrandsForStrandService,
  listSubStrandsForSchoolService,
  updateSubStrandService,
  deleteSubStrandService,
  reorderSubStrandsService,
  countSubStrandsService,
  searchSubStrandsService,
  getSubStrandsWithOutcomesService,
  copyCurriculumFromSchoolService,
  getCurriculumCoverageService,
  getCurriculumStatsService,
} from "./curriculum.service";
import {
  createStrandSchema,
  bulkCreateStrandsSchema,
  updateStrandSchema,
  reorderStrandsSchema,
  listStrandsQuerySchema,
  createSubStrandSchema,
  bulkCreateSubStrandsSchema,
  updateSubStrandSchema,
  reorderSubStrandsSchema,
  searchSubStrandsSchema,
  listSubStrandsQuerySchema,
  getCurriculumTreeQuerySchema,
  copyCurriculumSchema,
  getCurriculumCoverageQuerySchema,
  strandIdParamSchema,
  subStrandIdParamSchema,
  schoolIdParamSchema,
} from "../../validators/curriculum.validator";

const fail = (res: Response, status: number, message: string, issues?: any) =>
  res.status(status).json({ success: false, message, issues });
const ok = (res: Response, result: any, status = 200) => res.status(status).json(result);
const handleZod = (res: Response, err: any) => {
  const first = err?.errors?.[0];
  const field = first?.path?.join(".") ?? "input";
  return fail(res, 400, `${field}: ${first?.message ?? "invalid value"}`, err?.errors);
};
const isZod = (e: any) => e?.name === "ZodError" || Array.isArray(e?.errors);

// ================================================================
// STRANDS
// ================================================================

export const createStrandController = async (req: Request, res: Response) => {
  try {
    const body = createStrandSchema.parse(req.body);
    const result = await createStrandService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create strand.", e?.message);
  }
};

export const bulkCreateStrandsController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateStrandsSchema.parse(req.body);
    const result = await bulkCreateStrandsService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create strands.", e?.message);
  }
};

export const getStrandByIdController = async (req: Request, res: Response) => {
  try {
    const { strandId } = strandIdParamSchema.parse(req.params);
    const result = await getStrandByIdService(strandId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load strand.", e?.message);
  }
};

export const getStrandWithSubStrandsController = async (req: Request, res: Response) => {
  try {
    const { strandId } = strandIdParamSchema.parse(req.params);
    const result = await getStrandWithSubStrandsService(strandId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load strand.", e?.message);
  }
};

export const listStrandsForSubjectAndGradeController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { subjectId, gradeLevelId } = getCurriculumTreeQuerySchema.parse(req.query);
    const result = await listStrandsForSubjectAndGradeService(schoolId, subjectId, gradeLevelId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list strands.", e?.message);
  }
};

export const listStrandsForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listStrandsQuerySchema.parse(req.query);
    const result = await listStrandsForSchoolService(schoolId, q);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list strands.", e?.message);
  }
};

export const updateStrandController = async (req: Request, res: Response) => {
  try {
    const { strandId } = strandIdParamSchema.parse(req.params);
    const body = updateStrandSchema.parse(req.body);
    const result = await updateStrandService(strandId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update strand.", e?.message);
  }
};

export const deleteStrandController = async (req: Request, res: Response) => {
  try {
    const { strandId } = strandIdParamSchema.parse(req.params);
    const result = await deleteStrandService(strandId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete strand.", e?.message);
  }
};

export const reorderStrandsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { orderedIds } = reorderStrandsSchema.parse(req.body);
    const result = await reorderStrandsService(schoolId, orderedIds);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reorder strands.", e?.message);
  }
};

export const countStrandsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await countStrandsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not count strands.", e?.message);
  }
};

export const getCurriculumTreeController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { subjectId, gradeLevelId } = getCurriculumTreeQuerySchema.parse(req.query);
    const result = await getCurriculumTreeService(schoolId, subjectId, gradeLevelId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not build curriculum tree.", e?.message);
  }
};

// ================================================================
// SUB-STRANDS
// ================================================================

export const createSubStrandController = async (req: Request, res: Response) => {
  try {
    const body = createSubStrandSchema.parse(req.body);
    const result = await createSubStrandService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create sub-strand.", e?.message);
  }
};

export const bulkCreateSubStrandsController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateSubStrandsSchema.parse(req.body);
    const result = await bulkCreateSubStrandsService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create sub-strands.", e?.message);
  }
};

export const getSubStrandByIdController = async (req: Request, res: Response) => {
  try {
    const { subStrandId } = subStrandIdParamSchema.parse(req.params);
    const result = await getSubStrandByIdService(subStrandId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load sub-strand.", e?.message);
  }
};

export const listSubStrandsForStrandController = async (req: Request, res: Response) => {
  try {
    const { strandId } = strandIdParamSchema.parse(req.params);
    const q = listSubStrandsQuerySchema.parse(req.query);
    const result = await listSubStrandsForStrandService(strandId, {
      withOutcomesOnly: q.withOutcomesOnly === "true",
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list sub-strands.", e?.message);
  }
};

export const listSubStrandsForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listSubStrandsQuerySchema.parse(req.query);
    const result = await listSubStrandsForSchoolService(schoolId, {
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list sub-strands.", e?.message);
  }
};

export const updateSubStrandController = async (req: Request, res: Response) => {
  try {
    const { subStrandId } = subStrandIdParamSchema.parse(req.params);
    const body = updateSubStrandSchema.parse(req.body);
    const result = await updateSubStrandService(subStrandId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update sub-strand.", e?.message);
  }
};

export const deleteSubStrandController = async (req: Request, res: Response) => {
  try {
    const { subStrandId } = subStrandIdParamSchema.parse(req.params);
    const result = await deleteSubStrandService(subStrandId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete sub-strand.", e?.message);
  }
};

export const reorderSubStrandsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { orderedIds } = reorderSubStrandsSchema.parse(req.body);
    const result = await reorderSubStrandsService(schoolId, orderedIds);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reorder sub-strands.", e?.message);
  }
};

export const countSubStrandsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await countSubStrandsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not count sub-strands.", e?.message);
  }
};

export const searchSubStrandsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = searchSubStrandsSchema.parse(req.query);
    const result = await searchSubStrandsService(schoolId, q.q, {
      subjectId: q.subjectId,
      gradeLevelId: q.gradeLevelId,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not search sub-strands.", e?.message);
  }
};

export const getSubStrandsWithOutcomesController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getSubStrandsWithOutcomesService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch sub-strands.", e?.message);
  }
};

// ================================================================
// CROSS-CUTTING
// ================================================================

export const copyCurriculumFromSchoolController = async (req: Request, res: Response) => {
  try {
    const body = copyCurriculumSchema.parse(req.body);
    const result = await copyCurriculumFromSchoolService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not copy curriculum.", e?.message);
  }
};

export const getCurriculumCoverageController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = getCurriculumCoverageQuerySchema.parse(req.query);
    const result = await getCurriculumCoverageService(
      schoolId,
      q.subjectId,
      q.gradeLevelId,
      q.termId
    );
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute coverage.", e?.message);
  }
};

export const getCurriculumStatsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getCurriculumStatsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute stats.", e?.message);
  }
};