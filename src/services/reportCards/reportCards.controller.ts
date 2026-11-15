// controllers/reportCards.controller.ts
import { Request, Response } from "express";
import {
  generateReportCardService,
  generateReportCardsForClassService,
  generateReportCardsForSchoolService,
  previewReportCardService,
  regenerateReportCardService,
  getReportCardByIdService,
  getReportCardByStudentTermService,
  listReportCardsForStudentService,
  listReportCardsForClassService,
  listReportCardsForTermService,
  updateRemarksService,
  overrideReportCardFieldsService,
  publishReportCardService,
  publishReportCardsForClassService,
  unpublishReportCardService,
  deleteReportCardService,
  deleteReportCardsForTermService,
  getReportCardDataService,
} from "./reportCards.service";
import {
  generateReportCardSchema,
  generateReportCardsForClassSchema,
  generateReportCardsForSchoolSchema,
  previewReportCardSchema,
  updateRemarksSchema,
  overrideReportCardFieldsSchema,
  publishReportCardsForClassSchema,
  listReportCardsForStudentSchema,
  listReportCardsForClassSchema,
  listReportCardsForTermSchema,
  reportCardIdParamSchema,
  studentTermParamSchema,
  studentIdParamSchema,
  termIdParamSchema,
  classIdParamSchema,
  schoolIdParamSchema,
} from "../../validators/reportCards.validator";

// GENERATE
export const generateReportCardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = generateReportCardSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await generateReportCardService(v.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't generate the report card — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const generateReportCardsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = generateReportCardsForClassSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await generateReportCardsForClassService(v.data.schoolId, v.data.classId, v.data.termId);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `Bulk generation failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const generateReportCardsForSchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = generateReportCardsForSchoolSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await generateReportCardsForSchoolService(v.data.schoolId, v.data.termId);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `School-wide generation failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const previewReportCardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = previewReportCardSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await previewReportCardService(v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Preview ready." : `Preview failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const regenerateReportCardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid report card ID.", errors: p.error.format() });
      return;
    }
    const result = await regenerateReportCardService(p.data.reportCardId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Report card regenerated." : `Regenerate failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// READS
export const getReportCardByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid report card ID.", errors: p.error.format() });
      return;
    }
    const result = await getReportCardByIdService(p.data.reportCardId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Report card retrieved." : "We couldn't find that report card.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getReportCardByStudentTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentTermParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student or term ID.", errors: p.error.format() });
      return;
    }
    const result = await getReportCardByStudentTermService(p.data.studentId, p.data.termId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Report card retrieved." : "No report card for this student and term.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listReportCardsForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const st = studentIdParamSchema.safeParse(req.params);
    if (!s.success || !st.success) {
      res.status(400).json({ success: false, message: "Invalid school or student ID." });
      return;
    }
    const result = await listReportCardsForStudentService(s.data.schoolId, st.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} report card(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listReportCardsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const c = classIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !c.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school, class, or term ID." });
      return;
    }
    const result = await listReportCardsForClassService(s.data.schoolId, c.data.classId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} report card(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listReportCardsForTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const q = listReportCardsForTermSchema.safeParse(req.query);
    const classId = q.success ? q.data.classId : undefined;

    const result = await listReportCardsForTermService(s.data.schoolId, t.data.termId, classId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} report card(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const updateRemarksController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid report card ID.",
        errors: p.error.format(),
      });
      return;
    }

    const v = updateRemarksSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the remarks fields and try again.",
        errors: v.error.format(),
      });
      return;
    }

    const result = await updateRemarksService(p.data.reportCardId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Remarks updated." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

export const overrideReportCardFieldsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid report card ID.",
        errors: p.error.format(),
      });
      return;
    }

    const v = overrideReportCardFieldsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the override fields and try again.",
        errors: v.error.format(),
      });
      return;
    }

    const result = await overrideReportCardFieldsService(p.data.reportCardId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Fields overridden." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// PUBLISHING
export const publishReportCardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid report card ID.", errors: p.error.format() });
      return;
    }
    const result = await publishReportCardService(p.data.reportCardId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Report card published." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const publishReportCardsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = publishReportCardsForClassSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await publishReportCardsForClassService(v.data.schoolId, v.data.classId, v.data.termId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Publish failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const unpublishReportCardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid report card ID.", errors: p.error.format() });
      return;
    }
    const result = await unpublishReportCardService(p.data.reportCardId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Report card unpublished." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// DELETE
export const deleteReportCardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid report card ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteReportCardService(p.data.reportCardId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Report card deleted." : "We couldn't find that report card.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const deleteReportCardsForTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const q = listReportCardsForTermSchema.safeParse(req.query);
    const classId = q.success ? q.data.classId : undefined;

    const result = await deleteReportCardsForTermService(s.data.schoolId, t.data.termId, classId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// RENDER DATA
export const getReportCardDataController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = reportCardIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid report card ID.", errors: p.error.format() });
      return;
    }
    const result = await getReportCardDataService(p.data.reportCardId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Report card data ready." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};