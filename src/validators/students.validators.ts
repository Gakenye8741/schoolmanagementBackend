import { z } from "zod";

export const createStudentSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  admissionNumber: z.string().min(1, { message: "Admission number is required." }),
  upiNumber: z.string().optional(),
  parentId: z.string().uuid({ message: "Invalid parent ID format." }).optional(),
  classId: z.string().uuid({ message: "Invalid class ID format." }).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  enrollmentDate: z.string().optional(),
  isEnrolled: z.boolean().optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

export const createEnrollmentHistorySchema = z.object({
  studentId: z.string().uuid({ message: "Invalid student ID format." }),
  termId: z.string().uuid({ message: "Invalid term ID format." }),
  gradeLevel: z.string().min(1, { message: "Grade level is required." }),
  stream: z.string().min(1, { message: "Stream is required." }),
  status: z.enum(["Active", "Promoted", "Transferred"]).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type CreateEnrollmentHistoryInput = z.infer<typeof createEnrollmentHistorySchema>;