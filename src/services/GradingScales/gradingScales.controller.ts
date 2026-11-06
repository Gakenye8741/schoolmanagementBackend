// controllers/gradingScales.controller.ts
import { Request, Response } from "express";
import {
  createGradingScaleService,
  getGradingScaleByIdService,
  listGradingScalesService,
  getDefaultGradingScaleService,
  setDefaultGradingScaleService,
  updateGradingScaleService,
  deleteGradingScaleService,
  searchGradingScalesService,
  copyGradingScaleService,
  seedDefaultGradingScaleService,
  createGradingBandService,
  bulkCreateGradingBandsService,
  listGradingBandsService,
  updateGradingBandService,
  deleteGradingBandService,
  deleteAllBandsForScaleService,
  resolveGradeForMarkService,
  validateGradingScaleService,
} from "./gradingScales.service";
import {
  createGradingScaleSchema,
  updateGradingScaleSchema,
  setDefaultScaleSchema,
  copyGradingScaleSchema,
  seedDefaultScaleSchema,
  createGradingBandSchema,
  updateGradingBandSchema,
  bulkCreateBandsSchema,
  resolveGradeSchema,
  searchScalesSchema,
  scaleIdParamSchema,
  bandIdParamSchema,
  schoolIdParamSchema,
} from "../../validators/gradingScales.validator";

// ================================================================
// SCALES
// ================================================================

export const createGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createGradingScaleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the grading scale — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await createGradingScaleService(validation.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? "Grading scale created successfully."
        : `We couldn't create the grading scale — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the scale. Please try again.",
    });
  }
};

export const getGradingScaleByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const result = await getGradingScaleByIdService(p.data.scaleId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Grading scale retrieved." : "We couldn't find that scale.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the scale. Please try again.",
    });
  }
};

export const listGradingScalesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await listGradingScalesService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} scale(s).`
        : `We couldn't list scales — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing scales. Please try again.",
    });
  }
};

export const getDefaultGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await getDefaultGradingScaleService(p.data.schoolId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Default scale retrieved." : result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the default scale. Please try again.",
    });
  }
};

export const setDefaultGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const b = setDefaultScaleSchema.safeParse(req.body);
    if (!s.success || !b.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or scale ID." });
      return;
    }
    const result = await setDefaultGradingScaleService(s.data.schoolId, b.data.scaleId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Default scale updated." : `We couldn't set the default scale — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while setting the default scale. Please try again.",
    });
  }
};

export const updateGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    const validation = updateGradingScaleSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Check the scale ID and highlighted fields." });
      return;
    }
    const result = await updateGradingScaleService(p.data.scaleId, validation.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Grading scale updated."
        : `We couldn't update the scale — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the scale. Please try again.",
    });
  }
};

export const deleteGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteGradingScaleService(p.data.scaleId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Grading scale deleted."
        : result.message.startsWith("Cannot delete")
        ? "This scale can't be deleted because it's used by existing exams."
        : "We couldn't find that scale.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the scale. Please try again.",
    });
  }
};

export const searchGradingScalesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = searchScalesSchema.safeParse(req.query);
    if (!s.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or search query." });
      return;
    }
    const result = await searchGradingScalesService(s.data.schoolId, q.data.query);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} scale(s).`
        : `We couldn't search scales — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while searching scales. Please try again.",
    });
  }
};

export const copyGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = copyGradingScaleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid source scale and new name.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await copyGradingScaleService(
      validation.data.schoolId, validation.data.sourceScaleId, validation.data.newName
    );
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't copy the scale — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while copying the scale. Please try again.",
    });
  }
};

export const seedDefaultGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = seedDefaultScaleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Choose a template: KCSE, CBC, PERCENTAGE_A_E, or IGCSE_1_9.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await seedDefaultGradingScaleService(validation.data.schoolId, validation.data.template);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't seed the scale — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while seeding the scale. Please try again.",
    });
  }
};

// ================================================================
// BANDS
// ================================================================

export const createGradingBandController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const validation = createGradingBandSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the band — check the highlighted fields.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await createGradingBandService({
      ...validation.data,
      scaleId: p.data.scaleId,   // ← injected from URL
    });
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? "Grading band created." : `We couldn't create the band — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the band. Please try again.",
    });
  }
};

export const bulkCreateGradingBandsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const validation = bulkCreateBandsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the bands — check the highlighted fields.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await bulkCreateGradingBandsService({
      ...validation.data,
      scaleId: p.data.scaleId,   // ← injected from URL
    });
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? `Created ${result.count ?? 0} band(s).`
        : `We couldn't create the bands — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the bands. Please try again.",
    });
  }
};

export const listGradingBandsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const result = await listGradingBandsService(p.data.scaleId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} band(s).` : `We couldn't list bands — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing bands. Please try again.",
    });
  }
};

export const updateGradingBandController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = bandIdParamSchema.safeParse(req.params);
    const validation = updateGradingBandSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Check the band ID and highlighted fields." });
      return;
    }
    const result = await updateGradingBandService(p.data.bandId, validation.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Band updated." : `We couldn't update the band — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the band. Please try again.",
    });
  }
};

export const deleteGradingBandController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = bandIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid band ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteGradingBandService(p.data.bandId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Band deleted." : "We couldn't find that band.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the band. Please try again.",
    });
  }
};

export const deleteAllBandsForScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteAllBandsForScaleService(p.data.scaleId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? `Deleted ${result.count ?? 0} band(s).` : `We couldn't delete bands — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting bands. Please try again.",
    });
  }
};

// ================================================================
// RESOLVE & VALIDATE
// ================================================================

export const resolveGradeForMarkController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = resolveGradeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid scaleId and mark (0–100).",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await resolveGradeForMarkService(validation.data.scaleId, validation.data.mark);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't resolve mark — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while resolving the mark. Please try again.",
    });
  }
};

export const validateGradingScaleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scaleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid scale ID.", errors: p.error.format() });
      return;
    }
    const result = await validateGradingScaleService(p.data.scaleId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't validate scale — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while validating the scale. Please try again.",
    });
  }
};