import { eq, and } from "drizzle-orm";
import { TInsertClass, TSelectClass } from "../../drizzle/types";
import { classes, users } from "../../drizzle/schema";
import db from "../../drizzle/db";


export interface ClassServiceResponse {
  success: boolean;
  message: string;
  classItem?: TSelectClass | any;
  classes?: TSelectClass[] | any[];
}

/**
 * 1. Create a new class with duplicate check for the same grade, stream, and academic year
 */
export const createClassService = async (data: TInsertClass): Promise<ClassServiceResponse> => {
  try {
    // Check if class with same grade level and stream already exists for this school and academic year
    const existingClass = await db.query.classes.findFirst({
      where: and(
        eq(classes.schoolId, data.schoolId),
        eq(classes.gradeLevel, data.gradeLevel),
        eq(classes.stream, data.stream),
        eq(classes.academicYear, data.academicYear)
      ),
    });

    if (existingClass) {
      return { 
        success: false, 
        message: `Class '${data.gradeLevel} ${data.stream}' for academic year ${data.academicYear} already exists.` 
      };
    }

    // If a teacher is assigned, verify they exist and belong to the same school
    if (data.classTeacherId) {
      const teacher = await db.query.users.findFirst({
        where: eq(users.id, data.classTeacherId),
      });

      if (!teacher) {
        return { success: false, message: "Assigned class teacher not found." };
      }
    }

    const [newClass] = await db.insert(classes).values(data).returning();

    return {
      success: true,
      message: "Class created successfully.",
      classItem: newClass,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create class." };
  }
};

/**
 * 2. Get class by ID with relations (School, Class Teacher, Students)
 */
export const getClassByIdService = async (classId: string): Promise<ClassServiceResponse> => {
  try {
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
      with: {
        school: true,
        classTeacher: {
          columns: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        // students: true,
      },
    });

    if (!classData) {
      return { success: false, message: "Class not found." };
    }

    return {
      success: true,
      message: "Class retrieved successfully.",
      classItem: classData,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch class details." };
  }
};

/**
 * 3. List all classes for a school, optionally filtered by academic year
 */
export const listClassesBySchoolService = async (
  schoolId: string, 
  academicYear?: string
): Promise<ClassServiceResponse> => {
  try {
    const conditions = [eq(classes.schoolId, schoolId)];
    if (academicYear) {
      conditions.push(eq(classes.academicYear, academicYear));
    }

    const classList = await db.query.classes.findMany({
      where: and(...conditions),
      with: {
        classTeacher: {
          columns: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        // students: {
        //   columns: {
        //     id: true,
        //   },
        // },
      },
      orderBy: (classes, { asc }) => [asc(classes.gradeLevel), asc(classes.stream)],
    });

    return {
      success: true,
      message: "Classes fetched successfully.",
      classes: classList,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch classes." };
  }
};

/**
 * 4. Update class details
 */
export const updateClassService = async (
  classId: string,
  updates: Partial<TInsertClass>
): Promise<ClassServiceResponse> => {
  try {
    const existingClass = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
    });

    if (!existingClass) {
      return { success: false, message: "Class not found." };
    }

    // If changing grade level, stream, or academic year, check for duplicates
    if (updates.gradeLevel || updates.stream || updates.academicYear) {
      const gradeLevel = updates.gradeLevel || existingClass.gradeLevel;
      const stream = updates.stream || existingClass.stream;
      const academicYear = updates.academicYear || existingClass.academicYear;

      const duplicateCheck = await db.query.classes.findFirst({
        where: and(
          eq(classes.schoolId, existingClass.schoolId),
          eq(classes.gradeLevel, gradeLevel),
          eq(classes.stream, stream),
          eq(classes.academicYear, academicYear)
        ),
      });

      if (duplicateCheck && duplicateCheck.id !== classId) {
        return { 
          success: false, 
          message: `Another class with grade '${gradeLevel} ${stream}' for academic year ${academicYear} already exists.` 
        };
      }
    }

    const [updatedClass] = await db.update(classes)
      .set(updates)
      .where(eq(classes.id, classId))
      .returning();

    return {
      success: true,
      message: "Class updated successfully.",
      classItem: updatedClass,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update class." };
  }
};

/**
 * 5. Assign or update class teacher for a specific class
 */
export const assignClassTeacherService = async (
  classId: string,
  classTeacherId: string | null
): Promise<ClassServiceResponse> => {
  try {
    const existingClass = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
    });

    if (!existingClass) {
      return { success: false, message: "Class not found." };
    }

    if (classTeacherId) {
      const teacher = await db.query.users.findFirst({
        where: eq(users.id, classTeacherId),
      });

      if (!teacher) {
        return { success: false, message: "Teacher not found." };
      }
    }

    const [updatedClass] = await db.update(classes)
      .set({ classTeacherId })
      .where(eq(classes.id, classId))
      .returning();

    return {
      success: true,
      message: "Class teacher assigned successfully.",
      classItem: updatedClass,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to assign class teacher." };
  }
};

/**
 * 6. Delete a class
 */
export const deleteClassService = async (classId: string): Promise<ClassServiceResponse> => {
  try {
    const [deletedClass] = await db.delete(classes)
      .where(eq(classes.id, classId))
      .returning();

    if (!deletedClass) {
      return { success: false, message: "Class not found." };
    }

    return {
      success: true,
      message: "Class deleted successfully.",
      classItem: deletedClass,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete class." };
  }
};