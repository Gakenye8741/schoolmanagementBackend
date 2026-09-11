import { z } from "zod";

export const upsertTimetableSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  gradeLevel: z.string().min(1, { message: "Grade level is required." }),
  stream: z.string().min(1, { message: "Stream is required." }),
  dayOfWeek: z.string().min(1, { message: "Day of week is required." }),
  periodNumber: z.number().int().positive({ message: "Period number must be a positive integer." }),
  subjectId: z.string().uuid({ message: "Invalid subject ID format." }),
  teacherId: z.string().uuid({ message: "Invalid teacher ID format." }),
});

export const generateGlobalTimetableSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  classes: z.array(
    z.object({
      gradeLevel: z.string().min(1, { message: "Grade level is required." }),
      stream: z.string().min(1, { message: "Stream is required." }),
    })
  ).min(1, { message: "At least one class stream must be provided." }),
  subjectQuotas: z.array(
    z.object({
      subjectId: z.string().uuid({ message: "Invalid subject ID format." }),
      weeklyTarget: z.number().int().positive({ message: "Weekly target must be a positive integer." }),
    })
  ).min(1, { message: "At least one subject quota must be provided." }),
  daysOfWeek: z.array(z.string()).optional(),
  periodsPerDay: z.number().int().positive().optional(),
});

export type UpsertTimetableInput = z.infer<typeof upsertTimetableSchema>;
export type GenerateGlobalTimetableInput = z.infer<typeof generateGlobalTimetableSchema>;