import { Request, Response } from "express";
import {
  createAcademicTermService,
  getAcademicTermByIdService,
  getAcademicTermWithWindowsService,
  listAcademicTermsBySchoolService,
  listAcademicTermsByYearService,
  listAcademicYearsService,
  getCurrentAcademicTermService,
  getCurrentTermWithWindowsService,
  listTermsByStatusService,
  updateAcademicTermService,
  setCurrentAcademicTermService,
  clearCurrentAcademicTermService,
  changeTermStatusService,
  archiveAcademicTermService,
  deleteAcademicTermService,
  countTermsBySchoolService,
  getTermByYearAndNameService,
  createTermWindowService,
  getTermWindowByIdService,
  listTermWindowsByTermService,
  listTermWindowsByTypeService,
  getActiveWindowsOnDateService,
  updateTermWindowService,
  deleteTermWindowService,
  deleteAllWindowsForTermService,
  countWindowsForTermService,
  copyTermWindowsService,
  getUpcomingWindowsService,
  bulkCreateTermWindowsService,
  validateTermReadinessService,
} from "./terms.service";
import {
  createAcademicTermSchema,
  updateAcademicTermSchema,
  setCurrentAcademicTermSchema,
  changeTermStatusSchema,
  getTermByYearAndNameSchema,
  listTermsByStatusSchema,
  listTermsByYearSchema,
  createTermWindowSchema,
  updateTermWindowSchema,
  listTermWindowsByTypeSchema,
  activeWindowsOnDateSchema,
  copyTermWindowsSchema,
  upcomingWindowsSchema,
  bulkCreateTermWindowsSchema,
} from "../../validators/academicTerms.validator";

/**
 * 1. Create Academic Term Controller
 */
export const createAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createAcademicTermSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the academic term — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createAcademicTermService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term created successfully."
        : `We couldn't create the academic term — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the academic term. Please try again.",
    });
  }
};

/**
 * 2. Get Academic Term by ID Controller
 */
export const getAcademicTermByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required — please provide a valid term reference.",
      });
      return;
    }

    const result = await getAcademicTermByIdService(termId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term retrieved successfully."
        : "We couldn't find an academic term with that ID — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the academic term. Please try again.",
    });
  }
};

/**
 * 3. Get Academic Term with Windows Controller
 */
export const getAcademicTermWithWindowsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required — please provide a valid term reference.",
      });
      return;
    }

    const result = await getAcademicTermWithWindowsService(termId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term and its windows retrieved successfully."
        : "We couldn't find that academic term — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the term with windows. Please try again.",
    });
  }
};

/**
 * 4. List Academic Terms by School Controller
 */
export const listAcademicTermsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list academic terms.",
      });
      return;
    }

    const result = await listAcademicTermsBySchoolService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} academic term(s) for this school.`
        : `We couldn't list the school's academic terms — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing academic terms. Please try again.",
    });
  }
};

/**
 * 5. List Academic Terms by Year Controller
 */
export const listAcademicTermsByYearController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list academic terms by year.",
      });
      return;
    }

    const validationResult = listTermsByYearSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid 4-digit academic year (e.g. 2026).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await listAcademicTermsByYearService(schoolId, validationResult.data.academicYear);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} term(s) for academic year ${validationResult.data.academicYear}.`
        : `We couldn't fetch terms for ${validationResult.data.academicYear} — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing terms by year. Please try again.",
    });
  }
};

/**
 * 6. List Distinct Academic Years Controller
 */
export const listAcademicYearsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list academic years.",
      });
      return;
    }

    const result = await listAcademicYearsService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} academic year(s) for this school.`
        : `We couldn't fetch academic years — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing academic years. Please try again.",
    });
  }
};

/**
 * 7. Get Current Active Academic Term Controller
 */
export const getCurrentAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch the current academic term.",
      });
      return;
    }

    const result = await getCurrentAcademicTermService(schoolId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Current academic term retrieved successfully."
        : "No current academic term is set for this school — activate one to get started.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the current term. Please try again.",
    });
  }
};

/**
 * 8. Get Current Term with Windows Controller
 */
export const getCurrentTermWithWindowsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch the current term with windows.",
      });
      return;
    }

    const result = await getCurrentTermWithWindowsService(schoolId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Current term and its windows retrieved successfully."
        : "No current term is set for this school — activate a term first.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the current term's windows. Please try again.",
    });
  }
};

/**
 * 9. List Terms by Status Controller
 */
export const listTermsByStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to list terms by status.",
      });
      return;
    }

    const validationResult = listTermsByStatusSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid status: "upcoming", "active", "completed", or "archived".',
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await listTermsByStatusService(schoolId, validationResult.data.status);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} term(s) with status "${validationResult.data.status}".`
        : `We couldn't list terms with status "${validationResult.data.status}" — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing terms by status. Please try again.",
    });
  }
};

/**
 * 10. Update Academic Term Controller
 */
export const updateAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateAcademicTermSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the term — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to perform the update.",
      });
      return;
    }

    const result = await updateAcademicTermService(termId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term updated successfully."
        : `We couldn't update the academic term — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the academic term. Please try again.",
    });
  }
};

/**
 * 11. Set Current Academic Term Controller
 */
export const setCurrentAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to activate a current term.",
      });
      return;
    }

    const validationResult = setCurrentAcademicTermSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid academic term ID to activate.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await setCurrentAcademicTermService(schoolId, validationResult.data.termId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Term activated — this is now the current term for the school."
        : `We couldn't activate the term — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while activating the term. Please try again.",
    });
  }
};

/**
 * 12. Clear Current Academic Term Controller
 */
export const clearCurrentAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to clear the current term.",
      });
      return;
    }

    const result = await clearCurrentAcademicTermService(schoolId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Current term cleared — the school now has no active term."
        : "There is no current term to clear for this school.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while clearing the current term. Please try again.",
    });
  }
};

/**
 * 13. Change Term Status Controller
 */
export const changeTermStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to change the status.",
      });
      return;
    }

    const validationResult = changeTermStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid status: "upcoming", "active", "completed", or "archived".',
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await changeTermStatusService(termId, validationResult.data.status);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Term status changed to "${validationResult.data.status}" successfully.`
        : `We couldn't change the term status — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while changing the term status. Please try again.",
    });
  }
};

/**
 * 14. Archive Academic Term Controller
 */
export const archiveAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to archive the term.",
      });
      return;
    }

    const result = await archiveAcademicTermService(termId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term archived successfully."
        : `We couldn't archive the academic term — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while archiving the term. Please try again.",
    });
  }
};

/**
 * 15. Delete Academic Term Controller
 */
export const deleteAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to delete the term.",
      });
      return;
    }

    const result = await deleteAcademicTermService(termId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term deleted permanently."
        : result.message.startsWith("Cannot delete")
        ? "This term can't be deleted because other records depend on it — archive it instead."
        : "We couldn't find that academic term — it may have already been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the term. Please try again.",
    });
  }
};

/**
 * 16. Count Terms by School Controller
 */
export const countTermsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to count academic terms.",
      });
      return;
    }

    const result = await countTermsBySchoolService(schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This school has ${result.count ?? 0} academic term(s) recorded.`
        : `We couldn't count the school's terms — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting terms. Please try again.",
    });
  }
};

/**
 * 17. Get Term by Year and Name Controller
 */
export const getTermByYearAndNameController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to look up a term by year and name.",
      });
      return;
    }

    const validationResult = getTermByYearAndNameSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide both a valid 4-digit academic year and a term name.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await getTermByYearAndNameService(
      schoolId,
      validationResult.data.academicYear,
      validationResult.data.termName
    );
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Academic term retrieved successfully."
        : `No term found for ${validationResult.data.academicYear} — "${validationResult.data.termName}".`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the term. Please try again.",
    });
  }
};

/**
 * 18. Create Term Window Controller
 */
export const createTermWindowController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createTermWindowSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the term window — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createTermWindowService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Term window created successfully."
        : `We couldn't create the term window — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the term window. Please try again.",
    });
  }
};

/**
 * 19. Get Term Window by ID Controller
 */
export const getTermWindowByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawWindowId = req.params.windowId;
    const windowId = Array.isArray(rawWindowId) ? rawWindowId[0] : rawWindowId;

    if (!windowId) {
      res.status(400).json({
        success: false,
        message: "Term window ID is required to fetch the window.",
      });
      return;
    }

    const result = await getTermWindowByIdService(windowId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Term window retrieved successfully."
        : "We couldn't find a term window with that ID — it may have been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the term window. Please try again.",
    });
  }
};

/**
 * 20. List Term Windows by Term Controller
 */
export const listTermWindowsByTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to list the term's windows.",
      });
      return;
    }

    const result = await listTermWindowsByTermService(termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} window(s) for this term.`
        : `We couldn't list the term's windows — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing term windows. Please try again.",
    });
  }
};

/**
 * 21. List Term Windows by Type Controller
 */
export const listTermWindowsByTypeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to list windows by type.",
      });
      return;
    }

    const validationResult = listTermWindowsByTypeSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message:
          'Please provide a valid window type: "mid_term_break", "cat_week", "exam_week", or "registration_deadline".',
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await listTermWindowsByTypeService(termId, validationResult.data.windowType);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} window(s) of type "${validationResult.data.windowType}".`
        : `We couldn't list windows of type "${validationResult.data.windowType}" — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing windows by type. Please try again.",
    });
  }
};

/**
 * 22. Get Active Windows on a Date Controller
 */
export const getActiveWindowsOnDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to check active windows for a date.",
      });
      return;
    }

    const validationResult = activeWindowsOnDateSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid date in YYYY-MM-DD format to check active windows.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await getActiveWindowsOnDateService(schoolId, validationResult.data.onDate);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.count === 0
          ? `No term windows are active on ${validationResult.data.onDate}.`
          : `${result.count} window(s) are active on ${validationResult.data.onDate}.`
        : `We couldn't check active windows for ${validationResult.data.onDate} — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching active windows. Please try again.",
    });
  }
};

/**
 * 23. Update Term Window Controller
 */
export const updateTermWindowController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawWindowId = req.params.windowId;
    const windowId = Array.isArray(rawWindowId) ? rawWindowId[0] : rawWindowId;

    if (!windowId) {
      res.status(400).json({
        success: false,
        message: "Term window ID is required to perform the update.",
      });
      return;
    }

    const validationResult = updateTermWindowSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the term window — please correct the highlighted fields and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await updateTermWindowService(windowId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Term window updated successfully."
        : `We couldn't update the term window — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the term window. Please try again.",
    });
  }
};

/**
 * 24. Delete Term Window Controller
 */
export const deleteTermWindowController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawWindowId = req.params.windowId;
    const windowId = Array.isArray(rawWindowId) ? rawWindowId[0] : rawWindowId;

    if (!windowId) {
      res.status(400).json({
        success: false,
        message: "Term window ID is required to delete the window.",
      });
      return;
    }

    const result = await deleteTermWindowService(windowId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Term window deleted successfully."
        : "We couldn't find that term window — it may have already been deleted.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the term window. Please try again.",
    });
  }
};

/**
 * 25. Delete All Windows for a Term Controller
 */
export const deleteAllWindowsForTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to remove all of its windows.",
      });
      return;
    }

    const result = await deleteAllWindowsForTermService(termId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Removed all ${result.count ?? 0} window(s) from this term.`
        : `We couldn't clear the term's windows — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting all term windows. Please try again.",
    });
  }
};

/**
 * 26. Count Windows for a Term Controller
 */
export const countWindowsForTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to count its windows.",
      });
      return;
    }

    const result = await countWindowsForTermService(termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This term has ${result.count ?? 0} window(s).`
        : `We couldn't count the term's windows — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting term windows. Please try again.",
    });
  }
};

/**
 * 27. Copy Term Windows Controller
 */
export const copyTermWindowsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = copyTermWindowsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message:
          "We couldn't copy the windows — provide valid source and target term IDs (they must be different).",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await copyTermWindowsService(
      validationResult.data.sourceTermId,
      validationResult.data.targetTermId
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Copied ${result.count ?? 0} window(s) from the source term.`
        : `We couldn't copy the term windows — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while copying term windows. Please try again.",
    });
  }
};

/**
 * 28. Get Upcoming Windows Controller
 */
export const getUpcomingWindowsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "School ID is required to fetch upcoming windows.",
      });
      return;
    }

    const validationResult = upcomingWindowsSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "daysAhead must be a whole number between 1 and 365.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await getUpcomingWindowsService(schoolId, validationResult.data.daysAhead);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.count === 0
          ? `No windows are scheduled in the next ${validationResult.data.daysAhead} day(s).`
          : `${result.count} window(s) are scheduled in the next ${validationResult.data.daysAhead} day(s).`
        : `We couldn't fetch upcoming windows — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching upcoming windows. Please try again.",
    });
  }
};

/**
 * 29. Bulk Create Term Windows Controller
 */
export const bulkCreateTermWindowsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = bulkCreateTermWindowsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message:
          "We couldn't bulk-create the windows — provide a valid term ID and between 1 and 50 valid windows.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await bulkCreateTermWindowsService(
      validationResult.data.termId,
      validationResult.data.windows as any
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message // service already returns "N of M window(s) created."
        : `We couldn't bulk-create the windows — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during bulk term window creation. Please try again.",
    });
  }
};

/**
 * 30. Validate Term Readiness Controller
 */
export const validateTermReadinessController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({
        success: false,
        message: "Academic term ID is required to validate its readiness.",
      });
      return;
    }

    const result = await validateTermReadinessService(termId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Term is ready to activate — no issues found."
        : result.issues && result.issues.length
        ? `This term isn't ready to activate — ${result.issues.length} issue(s) found: ${result.issues.join(" ")}`
        : `We couldn't validate the term — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while validating term readiness. Please try again.",
    });
  }
};