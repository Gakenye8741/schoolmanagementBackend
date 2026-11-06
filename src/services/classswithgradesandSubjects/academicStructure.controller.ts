import { Request, Response } from "express";
import {
  // Grade Levels
  createGradeLevelService,
  getGradeLevelByIdService,
  getGradeLevelWithClassesService,
  listGradeLevelsService,
  listGradeLevelsByStageService,
  updateGradeLevelService,
  deleteGradeLevelService,
  setNextGradeLevelService,
  markGradeLevelAsFinalService,
  getFinalGradeLevelService,
  getPromotionChainService,
  getPreviousGradeLevelService,
  countGradeLevelsService,
  bulkCreateGradeLevelsService,
  reorderGradeLevelsService,
  validatePromotionLadderService,
  getGradeLevelByNameService,
  searchGradeLevelsService,
  getRootGradeLevelService,
  getPromotionSummaryService,
  // Subjects
  createSubjectService,
  getSubjectByIdService,
  getSubjectByCodeService,
  listSubjectsService,
  listSubjectsByCategoryService,
  updateSubjectService,
  deleteSubjectService,
  countSubjectsService,
  bulkCreateSubjectsService,
  searchSubjectsService,
  listSubjectsForClassService,
  listSubjectsForTeacherService,
  duplicateSubjectService,
  countClassesUsingSubjectService,
  getSubjectUsageSummaryService,
  renameSubjectCodeService,
  assertSubjectExistsService,
  listCoreSubjectsService,
  // Classes
  createClassService,
  getClassByIdService,
  getClassWithRelationsService,
  listClassesService,
  listClassesByYearService,
  listClassesByGradeLevelService,
  listClassesForTeacherService,
  updateClassService,
  deleteClassService,
  assignClassTeacherService,
  addSubjectToClassService,
  removeSubjectFromClassService,
  assignTeacherToClassSubjectService,
  listClassStudentsService,
  countClassStudentsService,
  checkClassCapacityService,
  bulkCreateClassesService,
  rollClassesToYearService,
  transferStudentBetweenClassesService,
  getClassStatisticsService,
  searchClassesService,
  validateClassReadinessService,
  linkStudentToClassService,
} from "./academicStructure.service";
import {
  createGradeLevelSchema,
  updateGradeLevelSchema,
  setNextGradeLevelSchema,
  listGradeLevelsByStageSchema,
  getGradeLevelByNameSchema,
  searchGradeLevelsSchema,
  bulkCreateGradeLevelsSchema,
  reorderGradeLevelsSchema,
  createSubjectSchema,
  updateSubjectSchema,
  getSubjectByCodeSchema,
  listSubjectsByCategorySchema,
  searchSubjectsSchema,
  bulkCreateSubjectsSchema,
  duplicateSubjectSchema,
  renameSubjectCodeSchema,
  assertSubjectExistsSchema,
  createClassSchema,
  updateClassSchema,
  listClassesByYearSchema,

  searchClassesSchema,
  assignClassTeacherSchema,
  addSubjectToClassSchema,

  assignTeacherToClassSubjectSchema,
  bulkCreateClassesSchema,
  rollClassesToYearSchema,
  transferStudentBetweenClassesSchema,
  linkStudentToClassSchema,
} from "../../validators/academicStructure.validator";

/**
 * Helper: normalize a route param that might be a string or string[].
 */
const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

// ================================================================
// =================== GRADE LEVELS (20) ==========================
// ================================================================

/**
 * 1. Create Grade Level
 */
export const createGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createGradeLevelSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the grade level — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createGradeLevelService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level created successfully."
        : `We couldn't create the grade level — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the grade level. Please try again.",
    });
  }
};

/**
 * 2. Get Grade Level by ID
 */
export const getGradeLevelByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required — please provide a valid reference.",
      });
      return;
    }

    const result = await getGradeLevelByIdService(gradeLevelId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level retrieved successfully."
        : "We couldn't find a grade level with that ID — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the grade level. Please try again.",
    });
  }
};

/**
 * 3. Get Grade Level with Classes
 */
export const getGradeLevelWithClassesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to fetch its classes.",
      });
      return;
    }

    const result = await getGradeLevelWithClassesService(gradeLevelId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level and its classes retrieved successfully."
        : "We couldn't find that grade level — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the grade level with classes. Please try again.",
    });
  }
};

/**
 * 4. List Grade Levels for a School
 */
export const listGradeLevelsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list grade levels.",
      });
      return;
    }

    const result = await listGradeLevelsService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} grade level(s) for this school.`
        : `We couldn't list the school's grade levels — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing grade levels. Please try again.",
    });
  }
};

/**
 * 5. List Grade Levels by Education Stage
 */
export const listGradeLevelsByStageController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list grade levels by stage.",
      });
      return;
    }

    const validationResult = listGradeLevelsByStageSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid education stage to filter grade levels.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await listGradeLevelsByStageService(schoolId, validationResult.data.stage);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} grade level(s) for stage "${validationResult.data.stage}".`
        : `We couldn't list grade levels for stage "${validationResult.data.stage}" — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing grade levels by stage. Please try again.",
    });
  }
};

/**
 * 6. Update Grade Level
 */
export const updateGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to perform the update.",
      });
      return;
    }

    const validationResult = updateGradeLevelSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the grade level — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await updateGradeLevelService(gradeLevelId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level updated successfully."
        : `We couldn't update the grade level — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the grade level. Please try again.",
    });
  }
};

/**
 * 7. Delete Grade Level
 */
export const deleteGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to delete the grade level.",
      });
      return;
    }

    const result = await deleteGradeLevelService(gradeLevelId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level deleted successfully."
        : result.message.startsWith("Cannot delete")
        ? "This grade level can't be deleted because classes or curriculum strands depend on it."
        : "We couldn't find that grade level — it may have already been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the grade level. Please try again.",
    });
  }
};

/**
 * 8. Set Next Grade Level
 */
export const setNextGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to set the next grade level.",
      });
      return;
    }

    const validationResult = setNextGradeLevelSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid next grade level ID (or null to clear it).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await setNextGradeLevelService(gradeLevelId, validationResult.data.nextGradeLevelId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? validationResult.data.nextGradeLevelId
          ? "Next grade level linked successfully."
          : "Next grade level link cleared."
        : `We couldn't link the next grade level — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while setting the next grade level. Please try again.",
    });
  }
};

/**
 * 9. Mark Grade Level as Final
 */
export const markGradeLevelAsFinalController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to mark it as final.",
      });
      return;
    }

    const result = await markGradeLevelAsFinalService(gradeLevelId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level marked as final — learners here will graduate instead of promoting."
        : `We couldn't mark the grade level as final — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while marking the grade level as final. Please try again.",
    });
  }
};

/**
 * 10. Get Final Grade Level for a School
 */
export const getFinalGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch the final grade level.",
      });
      return;
    }

    const result = await getFinalGradeLevelService(schoolId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Final grade level retrieved successfully."
        : "No final grade level is configured for this school — mark one to enable graduation.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the final grade level. Please try again.",
    });
  }
};

/**
 * 11. Get Promotion Chain for a Grade Level
 */
export const getPromotionChainController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to fetch its promotion chain.",
      });
      return;
    }

    const result = await getPromotionChainService(gradeLevelId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Promotion chain has ${result.count ?? 0} step(s).`
        : result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the promotion chain. Please try again.",
    });
  }
};

/**
 * 12. Get Previous Grade Level
 */
export const getPreviousGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to fetch the previous grade level.",
      });
      return;
    }

    const result = await getPreviousGradeLevelService(gradeLevelId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.gradeLevel
          ? "Previous grade level retrieved successfully."
          : "This is the entry grade level — no previous grade exists."
        : `We couldn't resolve the previous grade level — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the previous grade level. Please try again.",
    });
  }
};

/**
 * 13. Count Grade Levels for a School
 */
export const countGradeLevelsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to count grade levels.",
      });
      return;
    }

    const result = await countGradeLevelsService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This school has ${result.count ?? 0} grade level(s).`
        : `We couldn't count the school's grade levels — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting grade levels. Please try again.",
    });
  }
};

/**
 * 14. Bulk Create Grade Levels
 */
export const bulkCreateGradeLevelsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = bulkCreateGradeLevelsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't bulk-create the grade levels — check the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await bulkCreateGradeLevelsService(
      validationResult.data.schoolId,
      validationResult.data.levels as any
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Created ${result.count ?? 0} grade level(s) successfully.`
        : `We couldn't bulk-create the grade levels — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during bulk grade level creation. Please try again.",
    });
  }
};

/**
 * 15. Reorder Grade Levels
 */
export const reorderGradeLevelsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = reorderGradeLevelsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't reorder the grade levels — provide the school ID and a unique list of grade level IDs.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await reorderGradeLevelsService(
      validationResult.data.schoolId,
      validationResult.data.orderedIds
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Reordered ${result.count ?? 0} grade level(s) successfully.`
        : `We couldn't reorder the grade levels — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while reordering grade levels. Please try again.",
    });
  }
};

/**
 * 16. Validate Promotion Ladder
 */
export const validatePromotionLadderController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to validate the promotion ladder.",
      });
      return;
    }

    const result = await validatePromotionLadderService(schoolId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Promotion ladder is valid."
        : result.issues && result.issues.length
        ? `The promotion ladder has ${result.issues.length} issue(s): ${result.issues.join(" ")}`
        : `We couldn't validate the promotion ladder — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while validating the promotion ladder. Please try again.",
    });
  }
};

/**
 * 17. Get Grade Level by Name
 */
export const getGradeLevelByNameController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to look up a grade level by name.",
      });
      return;
    }

    const validationResult = getGradeLevelByNameSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid grade level name to search for.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await getGradeLevelByNameService(schoolId, validationResult.data.name);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Grade level retrieved successfully."
        : `No grade level named "${validationResult.data.name}" was found for this school.`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the grade level. Please try again.",
    });
  }
};

/**
 * 18. Search Grade Levels
 */
export const searchGradeLevelsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to search grade levels.",
      });
      return;
    }

    const validationResult = searchGradeLevelsSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid search query for grade levels.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await searchGradeLevelsService(schoolId, validationResult.data.query);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} grade level(s) matching "${validationResult.data.query}".`
        : `We couldn't search grade levels — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while searching grade levels. Please try again.",
    });
  }
};

/**
 * 19. Get Root Grade Level(s)
 */
export const getRootGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch the entry grade level(s).",
      });
      return;
    }

    const result = await getRootGradeLevelService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} entry grade level(s).`
        : `We couldn't fetch the entry grade level(s) — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching root grade levels. Please try again.",
    });
  }
};

/**
 * 20. Get Promotion Summary
 */
export const getPromotionSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch the promotion summary.",
      });
      return;
    }

    const result = await getPromotionSummaryService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Promotion summary across ${result.count ?? 0} grade level(s).`
        : `We couldn't build the promotion summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the promotion summary. Please try again.",
    });
  }
};

// ================================================================
// ==================== SUBJECTS (18) =============================
// ================================================================

/**
 * 21. Create Subject
 */
export const createSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createSubjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the subject — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createSubjectService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject created successfully."
        : `We couldn't create the subject — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the subject. Please try again.",
    });
  }
};

/**
 * 22. Get Subject by ID
 */
export const getSubjectByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = firstParam(req.params.subjectId);

    if (!subjectId) {
      res.status(400).json({
        success: false,
        message: "Subject ID is required to fetch the subject.",
      });
      return;
    }

    const result = await getSubjectByIdService(subjectId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject retrieved successfully."
        : "We couldn't find a subject with that ID — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the subject. Please try again.",
    });
  }
};

/**
 * 23. Get Subject by Code
 */
export const getSubjectByCodeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to look up a subject by code.",
      });
      return;
    }

    const validationResult = getSubjectByCodeSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid subject code (2–20 alphanumeric characters).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await getSubjectByCodeService(schoolId, validationResult.data.code);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject retrieved successfully."
        : `No subject with code "${validationResult.data.code}" was found for this school.`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the subject. Please try again.",
    });
  }
};

/**
 * 24. List Subjects
 */
export const listSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list subjects.",
      });
      return;
    }

    const result = await listSubjectsService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} subject(s) for this school.`
        : `We couldn't list the school's subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing subjects. Please try again.",
    });
  }
};

/**
 * 25. List Subjects by Category
 */
export const listSubjectsByCategoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list subjects by category.",
      });
      return;
    }

    const validationResult = listSubjectsByCategorySchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Provide a valid subject category: "Core", "Optional", "Technical", or "Other".',
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await listSubjectsByCategoryService(schoolId, validationResult.data.category);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} subject(s) in category "${validationResult.data.category}".`
        : `We couldn't list subjects in category "${validationResult.data.category}" — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing subjects by category. Please try again.",
    });
  }
};

/**
 * 26. Update Subject
 */
export const updateSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = firstParam(req.params.subjectId);

    if (!subjectId) {
      res.status(400).json({
        success: false,
        message: "Subject ID is required to perform the update.",
      });
      return;
    }

    const validationResult = updateSubjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the subject — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await updateSubjectService(subjectId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject updated successfully."
        : `We couldn't update the subject — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the subject. Please try again.",
    });
  }
};

/**
 * 27. Delete Subject
 */
export const deleteSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = firstParam(req.params.subjectId);

    if (!subjectId) {
      res.status(400).json({
        success: false,
        message: "Subject ID is required to delete the subject.",
      });
      return;
    }

    const result = await deleteSubjectService(subjectId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject deleted successfully."
        : result.message.startsWith("Cannot delete")
        ? "This subject can't be deleted because exams, timetables, or curriculum strands depend on it."
        : "We couldn't find that subject — it may have already been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the subject. Please try again.",
    });
  }
};

/**
 * 28. Count Subjects
 */
export const countSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to count subjects.",
      });
      return;
    }

    const result = await countSubjectsService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This school has ${result.count ?? 0} subject(s).`
        : `We couldn't count the school's subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting subjects. Please try again.",
    });
  }
};

/**
 * 29. Bulk Create Subjects
 */
export const bulkCreateSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = bulkCreateSubjectsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't bulk-create the subjects — check the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await bulkCreateSubjectsService(
      validationResult.data.schoolId,
      validationResult.data.subjects as any
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Created ${result.count ?? 0} subject(s) successfully.`
        : `We couldn't bulk-create the subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during bulk subject creation. Please try again.",
    });
  }
};

/**
 * 30. Search Subjects
 */
export const searchSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to search subjects.",
      });
      return;
    }

    const validationResult = searchSubjectsSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid search query for subjects.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await searchSubjectsService(schoolId, validationResult.data.query);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} subject(s) matching "${validationResult.data.query}".`
        : `We couldn't search subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while searching subjects. Please try again.",
    });
  }
};

/**
 * 31. List Subjects for a Class
 */
export const listSubjectsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to list its subjects.",
      });
      return;
    }

    const result = await listSubjectsForClassService(classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} subject(s) assigned to this class.`
        : `We couldn't list the class subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing class subjects. Please try again.",
    });
  }
};

/**
 * 32. List Subjects for a Teacher
 */
export const listSubjectsForTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = firstParam(req.params.teacherId);

    if (!teacherId) {
      res.status(400).json({
        success: false,
        message: "Teacher ID is required to list their subjects.",
      });
      return;
    }

    const result = await listSubjectsForTeacherService(teacherId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} subject(s) this teacher is qualified for.`
        : `We couldn't list the teacher's subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing teacher subjects. Please try again.",
    });
  }
};

/**
 * 33. Duplicate Subject
 */
export const duplicateSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = firstParam(req.params.subjectId);

    if (!subjectId) {
      res.status(400).json({
        success: false,
        message: "Subject ID is required to duplicate the subject.",
      });
      return;
    }

    const validationResult = duplicateSubjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid new subject code (2–20 alphanumeric characters).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await duplicateSubjectService(subjectId, validationResult.data.newCode);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject duplicated successfully."
        : `We couldn't duplicate the subject — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while duplicating the subject. Please try again.",
    });
  }
};

/**
 * 34. Count Classes Using a Subject
 */
export const countClassesUsingSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = firstParam(req.params.subjectId);

    if (!subjectId) {
      res.status(400).json({
        success: false,
        message: "Subject ID is required to count classes using it.",
      });
      return;
    }

    const result = await countClassesUsingSubjectService(subjectId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This subject is assigned to ${result.count ?? 0} class(es).`
        : `We couldn't count classes using the subject — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting classes using the subject. Please try again.",
    });
  }
};

/**
 * 35. Get Subject Usage Summary
 */
export const getSubjectUsageSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch the subject usage summary.",
      });
      return;
    }

    const result = await getSubjectUsageSummaryService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Subject usage summary built from ${result.count ?? 0} subject(s).`
        : `We couldn't build the subject usage summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching subject usage. Please try again.",
    });
  }
};

/**
 * 36. Rename Subject Code
 */
export const renameSubjectCodeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = firstParam(req.params.subjectId);

    if (!subjectId) {
      res.status(400).json({
        success: false,
        message: "Subject ID is required to rename the subject code.",
      });
      return;
    }

    const validationResult = renameSubjectCodeSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid new subject code (2–20 alphanumeric characters).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await renameSubjectCodeService(subjectId, validationResult.data.newCode);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject code updated successfully."
        : `We couldn't rename the subject code — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while renaming the subject code. Please try again.",
    });
  }
};

/**
 * 37. Assert Subject Exists
 */
export const assertSubjectExistsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = assertSubjectExistsSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide valid school and subject IDs to verify the subject.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await assertSubjectExistsService(
      validationResult.data.schoolId,
      validationResult.data.subjectId
    );
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject verified for this school."
        : "That subject does not belong to the specified school.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while verifying the subject. Please try again.",
    });
  }
};

/**
 * 38. List Core Subjects
 */
export const listCoreSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list core subjects.",
      });
      return;
    }

    const result = await listCoreSubjectsService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} core subject(s).`
        : `We couldn't list core subjects — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing core subjects. Please try again.",
    });
  }
};

// ================================================================
// ===================== CLASSES (22) =============================
// ================================================================

/**
 * 39. Create Class
 */
export const createClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createClassSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the class — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createClassService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Class created successfully."
        : `We couldn't create the class — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the class. Please try again.",
    });
  }
};

/**
 * 40. Get Class by ID
 */
export const getClassByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to fetch the class.",
      });
      return;
    }

    const result = await getClassByIdService(classId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Class retrieved successfully."
        : "We couldn't find a class with that ID — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the class. Please try again.",
    });
  }
};

/**
 * 41. Get Class with Relations
 */
export const getClassWithRelationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to fetch the class with its relations.",
      });
      return;
    }

    const result = await getClassWithRelationsService(classId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Class with grade level, teacher, subjects and students retrieved successfully."
        : "We couldn't find that class — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the class with relations. Please try again.",
    });
  }
};

/**
 * 42. List Classes for a School
 */
export const listClassesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list classes.",
      });
      return;
    }

    const result = await listClassesService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} class(es) for this school.`
        : `We couldn't list the school's classes — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing classes. Please try again.",
    });
  }
};

/**
 * 43. List Classes by Year
 */
export const listClassesByYearController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list classes by academic year.",
      });
      return;
    }

    const validationResult = listClassesByYearSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid 4-digit academic year (e.g. 2026).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await listClassesByYearService(schoolId, validationResult.data.academicYear);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} class(es) for ${validationResult.data.academicYear}.`
        : `We couldn't list classes for ${validationResult.data.academicYear} — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing classes by year. Please try again.",
    });
  }
};

/**
 * 44. List Classes by Grade Level
 */
export const listClassesByGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gradeLevelId = firstParam(req.params.gradeLevelId);

    if (!gradeLevelId) {
      res.status(400).json({
        success: false,
        message: "Grade level ID is required to list its classes.",
      });
      return;
    }

    const result = await listClassesByGradeLevelService(gradeLevelId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} class(es) for this grade level.`
        : `We couldn't list classes for the grade level — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing classes by grade level. Please try again.",
    });
  }
};

/**
 * 45. List Classes for a Teacher
 */
export const listClassesForTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = firstParam(req.params.teacherId);

    if (!teacherId) {
      res.status(400).json({
        success: false,
        message: "Teacher ID is required to list their classes.",
      });
      return;
    }

    const result = await listClassesForTeacherService(teacherId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} class(es) for this teacher.`
        : `We couldn't list the teacher's classes — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing teacher classes. Please try again.",
    });
  }
};

/**
 * 46. Update Class
 */
export const updateClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to perform the update.",
      });
      return;
    }

    const validationResult = updateClassSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the class — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await updateClassService(classId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Class updated successfully."
        : `We couldn't update the class — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the class. Please try again.",
    });
  }
};

/**
 * 47. Delete Class
 */
export const deleteClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to delete the class.",
      });
      return;
    }

    const result = await deleteClassService(classId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Class deleted successfully."
        : result.message.startsWith("Cannot delete")
        ? "This class can't be deleted because enrolled students or downstream records depend on it."
        : "We couldn't find that class — it may have already been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the class. Please try again.",
    });
  }
};

/**
 * 48. Assign Class Teacher
 */
export const assignClassTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to assign a class teacher.",
      });
      return;
    }

    const validationResult = assignClassTeacherSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid teacher ID (or null to clear the assignment).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await assignClassTeacherService(classId, validationResult.data.teacherId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? validationResult.data.teacherId
          ? "Class teacher assigned successfully."
          : "Class teacher cleared."
        : `We couldn't assign the class teacher — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while assigning the class teacher. Please try again.",
    });
  }
};

/**
 * 49. Add Subject to Class
 */
export const addSubjectToClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = addSubjectToClassSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't add the subject to the class — check the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await addSubjectToClassService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject added to class successfully."
        : `We couldn't add the subject to the class — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while adding the subject to the class. Please try again.",
    });
  }
};

/**
 * 50. Remove Subject from Class
 */
export const removeSubjectFromClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);
    const subjectId = firstParam(req.params.subjectId);

    if (!classId || !subjectId) {
      res.status(400).json({
        success: false,
        message: "Both class ID and subject ID are required to remove the subject from the class.",
      });
      return;
    }

    const result = await removeSubjectFromClassService(classId, subjectId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Subject removed from class successfully."
        : "We couldn't find that class-subject link — it may have already been removed.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while removing the subject from the class. Please try again.",
    });
  }
};

/**
 * 51. Assign Teacher to Class Subject
 */
export const assignTeacherToClassSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classSubjectId = firstParam(req.params.classSubjectId);

    if (!classSubjectId) {
      res.status(400).json({
        success: false,
        message: "Class-subject link ID is required to assign a teacher.",
      });
      return;
    }

    const validationResult = assignTeacherToClassSubjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid teacher ID (or null to clear the assignment).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await assignTeacherToClassSubjectService(
      classSubjectId,
      validationResult.data.teacherId
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? validationResult.data.teacherId
          ? "Teacher assigned to class subject successfully."
          : "Teacher cleared from class subject."
        : `We couldn't assign the teacher — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while assigning the teacher. Please try again.",
    });
  }
};

/**
 * 52. List Class Students
 */
export const listClassStudentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to list its students.",
      });
      return;
    }

    const result = await listClassStudentsService(classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} student(s) in this class.`
        : `We couldn't list the class students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing class students. Please try again.",
    });
  }
};

/**
 * 53. Count Class Students
 */
export const countClassStudentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to count its students.",
      });
      return;
    }

    const result = await countClassStudentsService(classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This class has ${result.count ?? 0} enrolled student(s).`
        : `We couldn't count the class students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting class students. Please try again.",
    });
  }
};

/**
 * 54. Check Class Capacity
 */
export const checkClassCapacityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to check its capacity.",
      });
      return;
    }

    const result = await checkClassCapacityService(classId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `Capacity warning — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while checking class capacity. Please try again.",
    });
  }
};

/**
 * 55. Bulk Create Classes
 */
export const bulkCreateClassesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = bulkCreateClassesSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't bulk-create the classes — check the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await bulkCreateClassesService(
      validationResult.data.schoolId,
      validationResult.data.classes as any
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Created ${result.count ?? 0} class(es) successfully.`
        : `We couldn't bulk-create the classes — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during bulk class creation. Please try again.",
    });
  }
};

/**
 * 56. Roll Classes to New Year
 */
export const rollClassesToYearController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = rollClassesToYearSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't roll classes — provide a valid school ID and two different academic years.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await rollClassesToYearService(
      validationResult.data.schoolId,
      validationResult.data.fromYear,
      validationResult.data.toYear
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Rolled ${result.count ?? 0} class shell(s) to ${validationResult.data.toYear}.`
        : `We couldn't roll the classes — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while rolling classes to the new year. Please try again.",
    });
  }
};

/**
 * 57. Transfer Student Between Classes
 */
export const transferStudentBetweenClassesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = transferStudentBetweenClassesSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't transfer the student — provide a valid student ID and target class ID.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await transferStudentBetweenClassesService(
      validationResult.data.studentId,
      validationResult.data.toClassId
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Student transferred successfully."
        : `We couldn't transfer the student — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while transferring the student. Please try again.",
    });
  }
};

/**
 * 58. Get Class Statistics
 */
export const getClassStatisticsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to fetch its statistics.",
      });
      return;
    }

    const result = await getClassStatisticsService(classId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : "We couldn't build the class statistics — the class may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching class statistics. Please try again.",
    });
  }
};

/**
 * 59. Search Classes
 */
export const searchClassesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = firstParam(req.params.schoolId);

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to search classes.",
      });
      return;
    }

    const validationResult = searchClassesSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid search query for classes.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await searchClassesService(schoolId, validationResult.data.query);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} class(es) matching "${validationResult.data.query}".`
        : `We couldn't search classes — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while searching classes. Please try again.",
    });
  }
};

/**
 * 60. Validate Class Readiness
 */
export const validateClassReadinessController = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = firstParam(req.params.classId);

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required to validate its readiness.",
      });
      return;
    }

    const result = await validateClassReadinessService(classId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Class is ready for the term."
        : result.issues && result.issues.length
        ? `This class isn't ready — ${result.issues.length} issue(s) found: ${result.issues.join(" ")}`
        : `We couldn't validate the class — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while validating class readiness. Please try again.",
    });
  }
};

// ================================================================
// =================== STUDENT LINKING (61) =======================
// ================================================================

/**
 * 61. Link Student to Class (admission or transfer)
 */
export const linkStudentToClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = linkStudentToClassSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't link the student to the class — check the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await linkStudentToClassService(
      validationResult.data.studentId,
      validationResult.data.classId,
      {
        termId: validationResult.data.termId,
        requireUnplaced: validationResult.data.requireUnplaced,
      }
    );

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't link the student to the class — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while linking the student to the class. Please try again.",
    });
  }
};