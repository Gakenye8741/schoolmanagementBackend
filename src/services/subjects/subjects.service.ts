import { eq, and, inArray } from "drizzle-orm";
import { TInsertSubject, TSelectSubject } from "../../drizzle/types";
import { subjects, teacherSubjects, users } from "../../drizzle/schema";
import db from "../../drizzle/db";

export interface SubjectServiceResponse {
  success: boolean;
  message: string;
  subjectItem?: TSelectSubject | any;
  subjects?: TSelectSubject[] | any[];
}

/**
 * 1. Create a new subject with unique code check per school
 */
export const createSubjectService = async (data: TInsertSubject): Promise<SubjectServiceResponse> => {
  try {
    const existingSubject = await db.query.subjects.findFirst({
      where: and(
        eq(subjects.schoolId, data.schoolId),
        eq(subjects.code, data.code)
      ),
    });

    if (existingSubject) {
      return { 
        success: false, 
        message: `Subject with code '${data.code}' already exists for this school.` 
      };
    }

    const [newSubject] = await db.insert(subjects).values(data).returning();

    return {
      success: true,
      message: "Subject created successfully.",
      subjectItem: newSubject,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create subject." };
  }
};

/**
 * 2. Bulk create multiple subjects for a school (skipping duplicate codes)
 */
export const bulkCreateSubjectsService = async (subjectsData: TInsertSubject[]): Promise<SubjectServiceResponse> => {
  try {
    if (!subjectsData || subjectsData.length === 0) {
      return { success: false, message: "No subjects provided for bulk creation." };
    }

    const schoolId = subjectsData[0].schoolId;
    const codes = subjectsData.map(s => s.code);

    const existingSubjects = await db.query.subjects.findMany({
      where: and(
        eq(subjects.schoolId, schoolId),
        inArray(subjects.code, codes)
      ),
    });

    const existingCodesSet = new Set(existingSubjects.map(s => s.code));
    const newSubjectsToInsert = subjectsData.filter(s => !existingCodesSet.has(s.code));

    if (newSubjectsToInsert.length === 0) {
      return { success: false, message: "All provided subject codes already exist for this school." };
    }

    const insertedSubjects = await db.insert(subjects).values(newSubjectsToInsert).returning();

    return {
      success: true,
      message: `Successfully created ${insertedSubjects.length} subjects. ${existingCodesSet.size} duplicates were skipped.`,
      subjects: insertedSubjects,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to bulk create subjects." };
  }
};

/**
 * 3. Get subject by ID with relations (School, Teacher Assignments)
 */
export const getSubjectByIdService = async (subjectId: string): Promise<SubjectServiceResponse> => {
  try {
    const subjectData = await db.query.subjects.findFirst({
      where: eq(subjects.id, subjectId),
      with: {
        school: true,
        teacherSubjects: {
          with: {
            teacher: {
              columns: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!subjectData) {
      return { success: false, message: "Subject not found." };
    }

    return {
      success: true,
      message: "Subject retrieved successfully.",
      subjectItem: subjectData,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch subject details." };
  }
};

/**
 * 4. List all subjects for a school, optionally filtered by category
 */
export const listSubjectsBySchoolService = async (
  schoolId: string, 
  category?: string
): Promise<SubjectServiceResponse> => {
  try {
    const conditions = [eq(subjects.schoolId, schoolId)];
    if (category) {
      conditions.push(eq(subjects.category, category as any));
    }

    const subjectList = await db.query.subjects.findMany({
      where: and(...conditions),
      with: {
        teacherSubjects: {
          with: {
            teacher: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: (subjects, { asc }) => [asc(subjects.name)],
    });

    return {
      success: true,
      message: "Subjects fetched successfully.",
      subjects: subjectList,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch subjects." };
  }
};

/**
 * 5. List all subjects taught by a specific teacher ID
 */
export const listSubjectsByTeacherService = async (teacherId: string): Promise<SubjectServiceResponse> => {
  try {
    const teacherAssignments = await db.query.teacherSubjects.findMany({
      where: eq(teacherSubjects.teacherId, teacherId),
      with: {
        subject: {
          with: {
            school: true,
          },
        },
      },
    });

    const subjectsList = teacherAssignments.map(ta => ta.subject);

    return {
      success: true,
      message: "Subjects fetched by teacher successfully.",
      subjects: subjectsList,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch subjects by teacher." };
  }
};

/**
 * 6. Update subject details
 */
export const updateSubjectService = async (
  subjectId: string,
  updates: Partial<TInsertSubject>
): Promise<SubjectServiceResponse> => {
  try {
    const existingSubject = await db.query.subjects.findFirst({
      where: eq(subjects.id, subjectId),
    });

    if (!existingSubject) {
      return { success: false, message: "Subject not found." };
    }

    // If updating code, verify uniqueness within the school
    if (updates.code && updates.code !== existingSubject.code) {
      const duplicateCheck = await db.query.subjects.findFirst({
        where: and(
          eq(subjects.schoolId, existingSubject.schoolId),
          eq(subjects.code, updates.code)
        ),
      });

      if (duplicateCheck) {
        return { 
          success: false, 
          message: `Subject code '${updates.code}' is already in use by another subject in this school.` 
        };
      }
    }

    const [updatedSubject] = await db.update(subjects)
      .set(updates)
      .where(eq(subjects.id, subjectId))
      .returning();

    return {
      success: true,
      message: "Subject updated successfully.",
      subjectItem: updatedSubject,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update subject." };
  }
};

/**
 * 7. Assign a teacher to a subject
 */
export const assignTeacherToSubjectService = async (
  subjectId: string,
  teacherId: string
): Promise<SubjectServiceResponse> => {
  try {
    const subject = await db.query.subjects.findFirst({
      where: eq(subjects.id, subjectId),
    });

    if (!subject) {
      return { success: false, message: "Subject not found." };
    }

    const teacher = await db.query.users.findFirst({
      where: eq(users.id, teacherId),
    });

    if (!teacher) {
      return { success: false, message: "Teacher not found." };
    }

    // Check if assignment already exists
    const existingAssignment = await db.query.teacherSubjects.findFirst({
      where: and(
        eq(teacherSubjects.subjectId, subjectId),
        eq(teacherSubjects.teacherId, teacherId)
      ),
    });

    if (existingAssignment) {
      return { success: false, message: "Teacher is already assigned to this subject." };
    }

    const [assignment] = await db.insert(teacherSubjects)
      .values({ subjectId, teacherId })
      .returning();

    return {
      success: true,
      message: "Teacher assigned to subject successfully.",
      subjectItem: assignment,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to assign teacher to subject." };
  }
};

/**
 * 8. Remove a teacher from a subject
 */
export const removeTeacherFromSubjectService = async (
  subjectId: string,
  teacherId: string
): Promise<SubjectServiceResponse> => {
  try {
    const [deletedAssignment] = await db.delete(teacherSubjects)
      .where(and(
        eq(teacherSubjects.subjectId, subjectId),
        eq(teacherSubjects.teacherId, teacherId)
      ))
      .returning();

    if (!deletedAssignment) {
      return { success: false, message: "Teacher assignment not found for this subject." };
    }

    return {
      success: true,
      message: "Teacher removed from subject successfully.",
      subjectItem: deletedAssignment,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to remove teacher from subject." };
  }
};

/**
 * 9. Delete a subject
 */
export const deleteSubjectService = async (subjectId: string): Promise<SubjectServiceResponse> => {
  try {
    const [deletedSubject] = await db.delete(subjects)
      .where(eq(subjects.id, subjectId))
      .returning();

    if (!deletedSubject) {
      return { success: false, message: "Subject not found." };
    }

    return {
      success: true,
      message: "Subject deleted successfully.",
      subjectItem: deletedSubject,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete subject." };
  }
};