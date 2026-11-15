// src/validators/events.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

export const eventCategoryEnum = z.enum([
  "Academic", "Sports", "Cultural", "Club", "Meeting", "Holiday", "General", "Other",
]);

/** Co-curricular category is a free varchar(50) in schema — we validate length only. */
const activityCategory = z.string().trim().min(2).max(50);

// ================================================================
// SCHOOL EVENTS
// ================================================================
export const createSchoolEventSchema = z
  .object({
    schoolId: uuid("school ID"),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(255),
    description: z.string().trim().max(5000).optional().nullable(),
    category: eventCategoryEnum,
    location: z.string().trim().max(150).optional().nullable(),
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "endDate must be on or after startDate.",
    path: ["endDate"],
  });

export const bulkCreateSchoolEventsSchema = z.object({
  schoolId: uuid("school ID"),
  events: z
    .array(
      z
        .object({
          title: z.string().trim().min(3).max(255),
          description: z.string().trim().max(5000).optional().nullable(),
          category: eventCategoryEnum,
          location: z.string().trim().max(150).optional().nullable(),
          startDate: z.string().datetime({ offset: true }),
          endDate: z.string().datetime({ offset: true }),
        })
        .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
          message: "endDate must be on or after startDate.",
        })
    )
    .min(1, "At least one event is required.")
    .max(50, "Cannot create more than 50 events at once."),
});

export const updateSchoolEventSchema = z
  .object({
    title: z.string().trim().min(3).max(255).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    category: eventCategoryEnum.optional(),
    location: z.string().trim().max(150).optional().nullable(),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const listSchoolEventsQuerySchema = z.object({
  category: eventCategoryEnum.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  upcomingOnly: z.enum(["true", "false"]).optional().default("false"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const upcomingEventsQuerySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const eventsInRangeQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

// ================================================================
// CO-CURRICULAR ACTIVITIES
// ================================================================
export const createActivitySchema = z.object({
  schoolId: uuid("school ID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  category: activityCategory,
  patronTeacherId: uuid("patron teacher ID").optional().nullable(),
});

export const updateActivitySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    category: activityCategory.optional(),
    patronTeacherId: uuid("patron teacher ID").optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const assignPatronSchema = z.object({
  patronTeacherId: uuid("patron teacher ID").nullable(),
});

export const listActivitiesQuerySchema = z.object({
  category: activityCategory.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ================================================================
// STUDENT ACTIVITY MEMBERSHIPS
// ================================================================
export const addStudentToActivitySchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  activityId: uuid("activity ID"),
  termId: uuid("term ID"),
  performanceRole: z.string().trim().max(100).optional().nullable(),
});

export const bulkAddStudentsSchema = z.object({
  schoolId: uuid("school ID"),
  activityId: uuid("activity ID"),
  termId: uuid("term ID"),
  studentIds: z
    .array(uuid("student ID"))
    .min(1, "At least one student is required.")
    .max(200, "Cannot add more than 200 students at once."),
  performanceRole: z.string().trim().max(100).optional().nullable(),
});

export const updateMembershipRoleSchema = z.object({
  performanceRole: z.string().trim().max(100).optional().nullable(),
});

export const listMembershipsQuerySchema = z.object({
  termId: uuid("term ID").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const listActivitiesForStudentQuerySchema = z.object({
  termId: uuid("term ID").optional(),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const eventIdParamSchema = z.object({ eventId: uuid("event ID") });
export const activityIdParamSchema = z.object({ activityId: uuid("activity ID") });
export const membershipIdParamSchema = z.object({ membershipId: uuid("membership ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const studentIdParamSchema = z.object({ studentId: uuid("student ID") });
export const teacherIdParamSchema = z.object({ teacherId: uuid("teacher ID") });
export const termIdParamSchema = z.object({ termId: uuid("term ID") });

// ================================================================
// Inferred types
// ================================================================
export type CreateSchoolEventInput = z.infer<typeof createSchoolEventSchema>;
export type UpdateSchoolEventInput = z.infer<typeof updateSchoolEventSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type AddStudentToActivityInput = z.infer<typeof addStudentToActivitySchema>;