import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import {
  createSchoolService,
  getSchoolByIdService,
  getSchoolBySlugService,
  listSchoolsService,
  updateSchoolService,
  toggleSchoolStatusService,
  updateSchoolBrandingService,
  updateSchoolSubscriptionService,
  updateSchoolSettingsService,
  updateSchoolContactService,
} from "./school.service";
import {
  createSchoolSchema,
  updateSchoolSchema,
  updateSchoolBrandingSchema,
  updateSchoolSubscriptionSchema,
  updateSchoolSettingsSchema,
  updateSchoolContactSchema,
  toggleSchoolStatusSchema,
} from "../../validators/school.validator";

export const createSchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createSchoolSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const schoolData = validationResult.data;
    const formattedData = {
      ...schoolData,
      subscriptionExpiresAt: schoolData.subscriptionExpiresAt ? new Date(schoolData.subscriptionExpiresAt) : null,
    };

    const result = await createSchoolService(formattedData as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during school creation.",
    });
  }
};

export const getSchoolByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await getSchoolByIdService(schoolId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching the school.",
    });
  }
};

export const getSchoolBySlugController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSlug = req.params.slug;
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    if (!slug) {
      res.status(400).json({ success: false, message: "School slug parameter is required." });
      return;
    }

    const result = await getSchoolBySlugService(slug);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching the school by slug.",
    });
  }
};

export const listSchoolsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await listSchoolsService();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred listing schools.",
    });
  }
};

export const updateSchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateSchoolSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const updates = validationResult.data;
    const formattedUpdates = {
      ...updates,
      ...(updates.subscriptionExpiresAt !== undefined && {
        subscriptionExpiresAt: updates.subscriptionExpiresAt ? new Date(updates.subscriptionExpiresAt) : null,
      }),
    };

    const result = await updateSchoolService(schoolId, formattedUpdates as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating the school.",
    });
  }
};

export const toggleSchoolStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = toggleSchoolStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const { isActive } = validationResult.data;
    const result = await toggleSchoolStatusService(schoolId, isActive);

    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred toggling school status.",
    });
  }
};

export const updateSchoolBrandingController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateSchoolBrandingSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await updateSchoolBrandingService(schoolId, validationResult.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating school branding.",
    });
  }
};

export const updateSchoolSubscriptionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateSchoolSubscriptionSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const data = validationResult.data;
    const formattedData = {
      ...data,
      ...(data.subscriptionExpiresAt !== undefined && {
        subscriptionExpiresAt: data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null,
      }),
    };

    const result = await updateSchoolSubscriptionService(schoolId, formattedData as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating school subscription.",
    });
  }
};

export const updateSchoolSettingsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateSchoolSettingsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await updateSchoolSettingsService(schoolId, validationResult.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating school settings.",
    });
  }
};

export const updateSchoolContactController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateSchoolContactSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await updateSchoolContactService(schoolId, validationResult.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating school contact info.",
    });
  }
};