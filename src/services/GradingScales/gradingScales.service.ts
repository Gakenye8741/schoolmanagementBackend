// services/gradingScales.service.ts
import {
  eq, and, ne, asc, desc, count, sql, ilike, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  gradingScales,
  gradingBands,
  termExams,
  TSelectGradingScale,
  TSelectGradingBand,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
export interface CreateGradingScaleInput {
  schoolId: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
}

export interface UpdateGradingScaleInput {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
}

export interface CreateGradingBandInput {
  scaleId: string;
  minScore: string;
  maxScore: string;
  grade: string;
  points?: number | null;
  descriptor?: string | null;
  remark?: string | null;
}

export interface BulkCreateBandsInput {
  scaleId: string;
  bands: Array<{
    minScore: string;
    maxScore: string;
    grade: string;
    points?: number | null;
    descriptor?: string | null;
    remark?: string | null;
  }>;
}

export type BandTemplate = "KCSE" | "CBC" | "PERCENTAGE_A_E" | "IGCSE_1_9";

// ================================================================
// Response envelope
// ================================================================
export interface GradingScaleResponse {
  success: boolean;
  message: string;
  scale?: TSelectGradingScale & { bands?: TSelectGradingBand[] };
  scales?: (TSelectGradingScale & { bands?: TSelectGradingBand[] })[];
  band?: TSelectGradingBand;
  bands?: TSelectGradingBand[];
  resolved?: {
    scaleId: string;
    scaleName: string;
    mark: string;
    grade: string;
    points: number | null;
    descriptor: string | null;
    remark: string | null;
  };
  validation?: {
    valid: boolean;
    overlapIssues: string[];
    coverageGaps: string[];
    bandCount: number;
    coverageMin: string;
    coverageMax: string;
  };
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const fmt = (n: number) => n.toFixed(2);

const getScaleOrFail = async (scaleId: string) => {
  return await db.query.gradingScales.findFirst({
    where: eq(gradingScales.id, scaleId),
  });
};

const getBandsForScale = async (scaleId: string) => {
  return await db.query.gradingBands.findMany({
    where: eq(gradingBands.scaleId, scaleId),
    orderBy: [desc(gradingBands.minScore)],
  });
};

const detectOverlaps = (bands: Array<{ minScore: string; maxScore: string; grade: string }>) => {
  const sorted = [...bands].sort((a, b) => Number(a.minScore) - Number(b.minScore));
  const issues: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (Number(sorted[i].maxScore) >= Number(sorted[i + 1].minScore)) {
      issues.push(
        `Band "${sorted[i].grade}" (${sorted[i].minScore}–${sorted[i].maxScore}) overlaps with "${sorted[i + 1].grade}" (${sorted[i + 1].minScore}–${sorted[i + 1].maxScore}).`
      );
    }
  }
  return issues;
};

const detectGaps = (bands: Array<{ minScore: string; maxScore: string; grade: string }>) => {
  const sorted = [...bands].sort((a, b) => Number(a.minScore) - Number(b.minScore));
  const gaps: string[] = [];
  if (sorted.length === 0) return ["No bands defined."];
  if (Number(sorted[0].minScore) > 0) {
    gaps.push(`Gap below lowest band: 0 → ${Number(sorted[0].minScore) - 0.01}`);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const prevMax = Number(sorted[i].maxScore);
    const nextMin = Number(sorted[i + 1].minScore);
    if (prevMax + 0.01 < nextMin) {
      gaps.push(`Gap between "${sorted[i].grade}" and "${sorted[i + 1].grade}": ${prevMax} → ${nextMin}`);
    }
  }
  if (Number(sorted[sorted.length - 1].maxScore) < 100) {
    gaps.push(`Gap above highest band: ${Number(sorted[sorted.length - 1].maxScore)} → 100`);
  }
  return gaps;
};

const assertNoOverlap = async (
  scaleId: string,
  minScore: string,
  maxScore: string,
  excludeBandId?: string
) => {
  const filters: any[] = [
    eq(gradingBands.scaleId, scaleId),
    // Overlap rule: existing.min <= new.max AND existing.max >= new.min
    sql`${gradingBands.minScore} <= ${maxScore}`,
    sql`${gradingBands.maxScore} >= ${minScore}`,
  ];
  if (excludeBandId) filters.push(ne(gradingBands.id, excludeBandId));

  const conflicts = await db.query.gradingBands.findMany({ where: and(...filters) });
  return conflicts;
};

// ================================================================
// 1. Create grading scale
// ================================================================
export const createGradingScaleService = async (
  data: CreateGradingScaleInput
): Promise<GradingScaleResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.name) return { success: false, message: "Scale name is required." };

    const row = await db.transaction(async (tx) => {
      if (data.isDefault) {
        await tx
          .update(gradingScales)
          .set({ isDefault: false })
          .where(eq(gradingScales.schoolId, data.schoolId));
      }
      const [s] = await tx
        .insert(gradingScales)
        .values({
          schoolId: data.schoolId,
          name: data.name.trim(),
          description: data.description ?? null,
          isDefault: data.isDefault ?? false,
        })
        .returning();
      return s;
    });

    return { success: true, message: "Grading scale created.", scale: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A grading scale with that name already exists in this school." };
    return { success: false, message: e?.message || "Failed to create grading scale." };
  }
};

// ================================================================
// 2. Get scale by ID (with bands)
// ================================================================
export const getGradingScaleByIdService = async (
  id: string
): Promise<GradingScaleResponse> => {
  try {
    const scale = await db.query.gradingScales.findFirst({
      where: eq(gradingScales.id, id),
      with: { bands: { orderBy: [desc(gradingBands.minScore)] } },
    });
    if (!scale) return { success: false, message: "Grading scale not found." };
    return {
      success: true,
      message: "Grading scale retrieved.",
      scale: scale as any,
      bands: (scale as any).bands,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch grading scale." };
  }
};

// ================================================================
// 3. List scales for a school (with bands)
// ================================================================
export const listGradingScalesService = async (
  schoolId: string
): Promise<GradingScaleResponse> => {
  try {
    const rows = await db.query.gradingScales.findMany({
      where: eq(gradingScales.schoolId, schoolId),
      with: { bands: { orderBy: [desc(gradingBands.minScore)] } },
      orderBy: [desc(gradingScales.isDefault), asc(gradingScales.name)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} grading scale(s).`,
      scales: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list grading scales." };
  }
};

// ================================================================
// 4. Get the school's default scale
// ================================================================
export const getDefaultGradingScaleService = async (
  schoolId: string
): Promise<GradingScaleResponse> => {
  try {
    const scale = await db.query.gradingScales.findFirst({
      where: and(eq(gradingScales.schoolId, schoolId), eq(gradingScales.isDefault, true)),
      with: { bands: { orderBy: [desc(gradingBands.minScore)] } },
    });
    if (!scale) return { success: false, message: "No default grading scale set for this school." };
    return {
      success: true,
      message: "Default grading scale retrieved.",
      scale: scale as any,
      bands: (scale as any).bands,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch default scale." };
  }
};

// ================================================================
// 5. Set a scale as default (clears others)
// ================================================================
export const setDefaultGradingScaleService = async (
  schoolId: string,
  scaleId: string
): Promise<GradingScaleResponse> => {
  try {
    const scale = await db.query.gradingScales.findFirst({
      where: and(eq(gradingScales.id, scaleId), eq(gradingScales.schoolId, schoolId)),
    });
    if (!scale) return { success: false, message: "Scale not found for this school." };

    const updated = await db.transaction(async (tx) => {
      await tx
        .update(gradingScales)
        .set({ isDefault: false })
        .where(eq(gradingScales.schoolId, schoolId));
      const [row] = await tx
        .update(gradingScales)
        .set({ isDefault: true })
        .where(eq(gradingScales.id, scaleId))
        .returning();
      return row;
    });

    return { success: true, message: "Default scale updated.", scale: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to set default scale." };
  }
};

// ================================================================
// 6. Update scale
// ================================================================
export const updateGradingScaleService = async (
  id: string,
  patch: UpdateGradingScaleInput
): Promise<GradingScaleResponse> => {
  try {
    const existing = await db.query.gradingScales.findFirst({
      where: eq(gradingScales.id, id),
    });
    if (!existing) return { success: false, message: "Grading scale not found." };

    const updated = await db.transaction(async (tx) => {
      // If setting as default, clear others first
      if (patch.isDefault === true) {
        await tx
          .update(gradingScales)
          .set({ isDefault: false })
          .where(eq(gradingScales.schoolId, existing.schoolId));
      }
      const [row] = await tx
        .update(gradingScales)
        .set(patch)
        .where(eq(gradingScales.id, id))
        .returning();
      return row;
    });

    return { success: true, message: "Grading scale updated.", scale: updated };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A grading scale with that name already exists." };
    return { success: false, message: e?.message || "Failed to update grading scale." };
  }
};

// ================================================================
// 7. Delete scale (fails if referenced by exams)
// ================================================================
export const deleteGradingScaleService = async (id: string): Promise<GradingScaleResponse> => {
  try {
    const [row] = await db.delete(gradingScales).where(eq(gradingScales.id, id)).returning();
    if (!row) return { success: false, message: "Grading scale not found." };
    return { success: true, message: "Grading scale deleted.", scale: row };
  } catch (e: any) {
    if (String(e?.code) === "23503")
      return {
        success: false,
        message: "Cannot delete: this scale is referenced by one or more exams.",
      };
    return { success: false, message: e?.message || "Failed to delete grading scale." };
  }
};

// ================================================================
// 8. Search scales
// ================================================================
export const searchGradingScalesService = async (
  schoolId: string,
  query: string
): Promise<GradingScaleResponse> => {
  try {
    const rows = await db.query.gradingScales.findMany({
      where: and(eq(gradingScales.schoolId, schoolId), ilike(gradingScales.name, `%${query}%`)),
      with: { bands: { orderBy: [desc(gradingBands.minScore)] } },
      orderBy: [asc(gradingScales.name)],
    });
    return {
      success: true,
      message: `Found ${rows.length} scale(s) matching "${query}".`,
      scales: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search scales." };
  }
};

// ================================================================
// 9. Copy scale (+ all bands)
// ================================================================
export const copyGradingScaleService = async (
  schoolId: string,
  sourceScaleId: string,
  newName: string
): Promise<GradingScaleResponse> => {
  try {
    const source = await db.query.gradingScales.findFirst({
      where: and(eq(gradingScales.id, sourceScaleId), eq(gradingScales.schoolId, schoolId)),
    });
    if (!source) return { success: false, message: "Source scale not found." };

    const bands = await getBandsForScale(sourceScaleId);
    if (bands.length === 0)
      return { success: false, message: "Source scale has no bands to copy." };

    const result = await db.transaction(async (tx) => {
      const [newScale] = await tx
        .insert(gradingScales)
        .values({
          schoolId,
          name: newName.trim(),
          description: source.description,
          isDefault: false,
        })
        .returning();

      const insertedBands = await tx
        .insert(gradingBands)
        .values(
          bands.map((b) => ({
            scaleId: newScale.id,
            minScore: b.minScore,
            maxScore: b.maxScore,
            grade: b.grade,
            points: b.points,
            descriptor: b.descriptor,
            remark: b.remark,
          }))
        )
        .returning();

      return { scale: newScale, bands: insertedBands };
    });

    return {
      success: true,
      message: `Copied "${source.name}" → "${newName}" (${result.bands.length} bands).`,
      scale: { ...result.scale, bands: result.bands } as any,
      bands: result.bands,
      count: result.bands.length,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A scale with that name already exists." };
    return { success: false, message: e?.message || "Failed to copy grading scale." };
  }
};

// ================================================================
// 10. Seed a standard template (KCSE, CBC, PERCENTAGE_A_E, IGCSE)
// ================================================================
const TEMPLATES: Record<BandTemplate, Array<{
  minScore: string; maxScore: string; grade: string; points: number | null;
  descriptor: string; remark: string;
}>> = {
  KCSE: [
    { minScore: "80.00", maxScore: "100.00", grade: "A",  points: 12, descriptor: "Excellent", remark: "Outstanding performance." },
    { minScore: "75.00", maxScore: "79.99",  grade: "A-", points: 11, descriptor: "Very Good", remark: "Very good work." },
    { minScore: "70.00", maxScore: "74.99",  grade: "B+", points: 10, descriptor: "Good",      remark: "Good performance." },
    { minScore: "65.00", maxScore: "69.99",  grade: "B",  points: 9,  descriptor: "Good",      remark: "Good performance." },
    { minScore: "60.00", maxScore: "64.99",  grade: "B-", points: 8,  descriptor: "Fair",      remark: "Can improve." },
    { minScore: "55.00", maxScore: "59.99",  grade: "C+", points: 7,  descriptor: "Fair",      remark: "Can improve." },
    { minScore: "50.00", maxScore: "54.99",  grade: "C",  points: 6,  descriptor: "Fair",      remark: "Needs attention." },
    { minScore: "45.00", maxScore: "49.99",  grade: "C-", points: 5,  descriptor: "Weak",      remark: "Needs more effort." },
    { minScore: "40.00", maxScore: "44.99",  grade: "D+", points: 4,  descriptor: "Weak",      remark: "Needs more effort." },
    { minScore: "35.00", maxScore: "39.99",  grade: "D",  points: 3,  descriptor: "Weak",      remark: "Needs intervention." },
    { minScore: "30.00", maxScore: "34.99",  grade: "D-", points: 2,  descriptor: "Very Weak", remark: "Needs intervention." },
    { minScore: "0.00",  maxScore: "29.99",  grade: "E",  points: 1,  descriptor: "Fail",      remark: "Needs intervention." },
  ],
  CBC: [
    { minScore: "80.00", maxScore: "100.00", grade: "EE", points: 4, descriptor: "Exceeds Expectations",     remark: "Exceeds expectations." },
    { minScore: "65.00", maxScore: "79.99",  grade: "ME", points: 3, descriptor: "Meets Expectations",       remark: "Meets expectations." },
    { minScore: "50.00", maxScore: "64.99",  grade: "AE", points: 2, descriptor: "Approaches Expectations",  remark: "Approaches expectations." },
    { minScore: "0.00",  maxScore: "49.99",  grade: "BE", points: 1, descriptor: "Below Expectations",       remark: "Below expectations." },
  ],
  PERCENTAGE_A_E: [
    { minScore: "80.00", maxScore: "100.00", grade: "A", points: 5, descriptor: "Excellent", remark: "Excellent." },
    { minScore: "70.00", maxScore: "79.99",  grade: "B", points: 4, descriptor: "Good",      remark: "Good." },
    { minScore: "60.00", maxScore: "69.99",  grade: "C", points: 3, descriptor: "Average",   remark: "Average." },
    { minScore: "50.00", maxScore: "59.99",  grade: "D", points: 2, descriptor: "Below Average", remark: "Below average." },
    { minScore: "0.00",  maxScore: "49.99",  grade: "E", points: 1, descriptor: "Fail",      remark: "Needs improvement." },
  ],
  IGCSE_1_9: [
    { minScore: "90.00", maxScore: "100.00", grade: "9", points: 9, descriptor: "Outstanding", remark: "Outstanding performance." },
    { minScore: "80.00", maxScore: "89.99",  grade: "8", points: 8, descriptor: "Excellent",   remark: "Excellent performance." },
    { minScore: "70.00", maxScore: "79.99",  grade: "7", points: 7, descriptor: "Very Good",   remark: "Very good performance." },
    { minScore: "60.00", maxScore: "69.99",  grade: "6", points: 6, descriptor: "Good",        remark: "Good performance." },
    { minScore: "50.00", maxScore: "59.99",  grade: "5", points: 5, descriptor: "Satisfactory", remark: "Satisfactory." },
    { minScore: "40.00", maxScore: "49.99",  grade: "4", points: 4, descriptor: "Adequate",    remark: "Adequate." },
    { minScore: "30.00", maxScore: "39.99",  grade: "3", points: 3, descriptor: "Weak",        remark: "Needs improvement." },
    { minScore: "20.00", maxScore: "29.99",  grade: "2", points: 2, descriptor: "Poor",        remark: "Needs improvement." },
    { minScore: "0.00",  maxScore: "19.99",  grade: "1", points: 1, descriptor: "Very Poor",   remark: "Needs intervention." },
  ],
};

export const seedDefaultGradingScaleService = async (
  schoolId: string,
  template: BandTemplate
): Promise<GradingScaleResponse> => {
  try {
    const templateName: Record<BandTemplate, string> = {
      KCSE: "KCSE Grading",
      CBC: "CBC Performance Levels",
      PERCENTAGE_A_E: "Percentage A–E",
      IGCSE_1_9: "IGCSE 1–9",
    };

    const existing = await db.query.gradingScales.findFirst({
      where: and(
        eq(gradingScales.schoolId, schoolId),
        eq(gradingScales.name, templateName[template])
      ),
    });
    if (existing)
      return { success: false, message: `Scale "${templateName[template]}" already exists.` };

    const bands = TEMPLATES[template];

    const result = await db.transaction(async (tx) => {
      const [scale] = await tx
        .insert(gradingScales)
        .values({
          schoolId,
          name: templateName[template],
          description: `Standard ${template} grading scale.`,
          isDefault: false,
        })
        .returning();

      const insertedBands = await tx
        .insert(gradingBands)
        .values(bands.map((b) => ({ ...b, scaleId: scale.id })))
        .returning();

      return { scale, bands: insertedBands };
    });

    return {
      success: true,
      message: `Seeded "${templateName[template]}" with ${result.bands.length} bands.`,
      scale: { ...result.scale, bands: result.bands } as any,
      bands: result.bands,
      count: result.bands.length,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "That template already exists." };
    return { success: false, message: e?.message || "Failed to seed grading scale." };
  }
};

// ================================================================
// 11. Create a band
// ================================================================
export const createGradingBandService = async (
  data: CreateGradingBandInput
): Promise<GradingScaleResponse> => {
  try {
    const scale = await getScaleOrFail(data.scaleId);
    if (!scale) return { success: false, message: "Grading scale not found." };

    if (Number(data.maxScore) < Number(data.minScore))
      return { success: false, message: "maxScore must be greater than or equal to minScore." };

    const conflicts = await assertNoOverlap(data.scaleId, data.minScore, data.maxScore);
    if (conflicts.length > 0) {
      const detail = conflicts
        .map((c) => `"${c.grade}" (${c.minScore}–${c.maxScore})`)
        .join(", ");
      return {
        success: false,
        message: `Band overlaps with existing band(s): ${detail}.`,
      };
    }

    const [row] = await db
      .insert(gradingBands)
      .values({
        scaleId: data.scaleId,
        minScore: data.minScore,
        maxScore: data.maxScore,
        grade: data.grade.trim(),
        points: data.points ?? null,
        descriptor: data.descriptor ?? null,
        remark: data.remark ?? null,
      })
      .returning();

    return { success: true, message: "Grading band created.", band: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create grading band." };
  }
};

// ================================================================
// 12. Bulk create bands
// ================================================================
export const bulkCreateGradingBandsService = async (
  data: BulkCreateBandsInput
): Promise<GradingScaleResponse> => {
  try {
    const scale = await getScaleOrFail(data.scaleId);
    if (!scale) return { success: false, message: "Grading scale not found." };

    // Check overlap against existing bands on the scale
    const existingBands = await getBandsForScale(data.scaleId);
    const combined = [
      ...existingBands.map((b) => ({
        minScore: b.minScore,
        maxScore: b.maxScore,
        grade: b.grade,
      })),
      ...data.bands,
    ];
    const overlaps = detectOverlaps(combined);
    if (overlaps.length > 0) {
      return {
        success: false,
        message: `Bands overlap: ${overlaps.join("; ")}`,
        issues: overlaps,
      };
    }

    // Check duplicate grade labels against existing
    const existingGrades = new Set(existingBands.map((b) => b.grade));
    const dupGrades = data.bands.filter((b) => existingGrades.has(b.grade.trim())).map((b) => b.grade);
    if (dupGrades.length > 0) {
      return {
        success: false,
        message: `Grades already exist on this scale: ${dupGrades.join(", ")}`,
      };
    }

    const inserted = await db
      .insert(gradingBands)
      .values(
        data.bands.map((b) => ({
          scaleId: data.scaleId,
          minScore: b.minScore,
          maxScore: b.maxScore,
          grade: b.grade.trim(),
          points: b.points ?? null,
          descriptor: b.descriptor ?? null,
          remark: b.remark ?? null,
        }))
      )
      .returning();

    return {
      success: true,
      message: `Created ${inserted.length} grading band(s).`,
      bands: inserted,
      count: inserted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create bands." };
  }
};

// ================================================================
// 13. List bands for a scale
// ================================================================
export const listGradingBandsService = async (
  scaleId: string
): Promise<GradingScaleResponse> => {
  try {
    const rows = await getBandsForScale(scaleId);
    return {
      success: true,
      message: `Fetched ${rows.length} band(s).`,
      bands: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list grading bands." };
  }
};

// ================================================================
// 14. Update a band
// ================================================================
export const updateGradingBandService = async (
  id: string,
  patch: Partial<CreateGradingBandInput>
): Promise<GradingScaleResponse> => {
  try {
    const existing = await db.query.gradingBands.findFirst({
      where: eq(gradingBands.id, id),
    });
    if (!existing) return { success: false, message: "Grading band not found." };

    const minScore = patch.minScore ?? existing.minScore;
    const maxScore = patch.maxScore ?? existing.maxScore;

    if (Number(maxScore) < Number(minScore))
      return { success: false, message: "maxScore must be greater than or equal to minScore." };

    if (patch.minScore || patch.maxScore) {
      const conflicts = await assertNoOverlap(existing.scaleId, minScore, maxScore, id);
      if (conflicts.length > 0) {
        const detail = conflicts.map((c) => `"${c.grade}" (${c.minScore}–${c.maxScore})`).join(", ");
        return {
          success: false,
          message: `Updated band would overlap with: ${detail}.`,
        };
      }
    }

    const [row] = await db
      .update(gradingBands)
      .set({
        ...(patch.minScore && { minScore: patch.minScore }),
        ...(patch.maxScore && { maxScore: patch.maxScore }),
        ...(patch.grade && { grade: patch.grade.trim() }),
        ...(patch.points !== undefined && { points: patch.points }),
        ...(patch.descriptor !== undefined && { descriptor: patch.descriptor }),
        ...(patch.remark !== undefined && { remark: patch.remark }),
      })
      .where(eq(gradingBands.id, id))
      .returning();

    return { success: true, message: "Grading band updated.", band: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update grading band." };
  }
};

// ================================================================
// 15. Delete a band
// ================================================================
export const deleteGradingBandService = async (id: string): Promise<GradingScaleResponse> => {
  try {
    const [row] = await db.delete(gradingBands).where(eq(gradingBands.id, id)).returning();
    if (!row) return { success: false, message: "Grading band not found." };
    return { success: true, message: "Grading band deleted.", band: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete grading band." };
  }
};

// ================================================================
// 16. Delete all bands for a scale
// ================================================================
export const deleteAllBandsForScaleService = async (
  scaleId: string
): Promise<GradingScaleResponse> => {
  try {
    const deleted = await db
      .delete(gradingBands)
      .where(eq(gradingBands.scaleId, scaleId))
      .returning();
    return {
      success: true,
      message: `Deleted ${deleted.length} band(s).`,
      count: deleted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete bands." };
  }
};

// ================================================================
// 17. Resolve a mark to a grade
// ================================================================
export const resolveGradeForMarkService = async (
  scaleId: string,
  mark: string
): Promise<GradingScaleResponse> => {
  try {
    const scale = await getScaleOrFail(scaleId);
    if (!scale) return { success: false, message: "Grading scale not found." };

    const m = Number(mark);
    if (Number.isNaN(m) || m < 0 || m > 100)
      return { success: false, message: "Mark must be a number between 0 and 100." };

    const band = await db.query.gradingBands.findFirst({
      where: and(
        eq(gradingBands.scaleId, scaleId),
        lte(gradingBands.minScore, mark),
        gte(gradingBands.maxScore, mark)
      ),
    });

    if (!band) {
      return {
        success: false,
        message: `No band matches mark ${mark} on scale "${scale.name}". The scale has gaps.`,
      };
    }

    return {
      success: true,
      message: `Mark ${mark} → Grade ${band.grade}.`,
      resolved: {
        scaleId: scale.id,
        scaleName: scale.name,
        mark: fmt(m),
        grade: band.grade,
        points: band.points,
        descriptor: band.descriptor,
        remark: band.remark,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to resolve grade." };
  }
};

// ================================================================
// 18. Validate a scale (overlap + coverage)
// ================================================================
export const validateGradingScaleService = async (
  scaleId: string
): Promise<GradingScaleResponse> => {
  try {
    const scale = await getScaleOrFail(scaleId);
    if (!scale) return { success: false, message: "Grading scale not found." };

    const bands = await getBandsForScale(scaleId);
    if (bands.length === 0) {
      return {
        success: false,
        message: "Scale has no bands.",
        validation: {
          valid: false,
          overlapIssues: [],
          coverageGaps: ["No bands defined."],
          bandCount: 0,
          coverageMin: "—",
          coverageMax: "—",
        },
      };
    }

    const overlapIssues = detectOverlaps(
      bands.map((b) => ({ minScore: b.minScore, maxScore: b.maxScore, grade: b.grade }))
    );
    const coverageGaps = detectGaps(
      bands.map((b) => ({ minScore: b.minScore, maxScore: b.maxScore, grade: b.grade }))
    );

    const minScore = bands.reduce((min, b) => (Number(b.minScore) < Number(min) ? b.minScore : min), "100.00");
    const maxScore = bands.reduce((max, b) => (Number(b.maxScore) > Number(max) ? b.maxScore : max), "0.00");

    const valid = overlapIssues.length === 0;

    return {
      success: true,
      message: valid
        ? coverageGaps.length === 0
          ? "Scale is valid and fully covered."
          : `Scale is valid but has ${coverageGaps.length} coverage gap(s).`
        : `Scale has ${overlapIssues.length} overlap issue(s) and ${coverageGaps.length} gap(s).`,
      validation: {
        valid,
        overlapIssues,
        coverageGaps,
        bandCount: bands.length,
        coverageMin: minScore,
        coverageMax: maxScore,
      },
      bands,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate scale." };
  }
};