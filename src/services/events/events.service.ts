import  db  from "../../drizzle/db";
import { eq, and, gte, asc, desc } from "drizzle-orm";
import { 
  coCurricularActivities, 
  schoolEvents, 
  studentActivityMemberships 
} from "../../drizzle/schema";
import { 
  TInsertCoCurricularActivity, 
  TInsertSchoolEvent, 
  TInsertStudentActivityMembership 
} from "../../drizzle/types";

/**
 * Translate database constraint errors into human-friendly messages.
 */
const formatDatabaseError = (errorMessage: string = ""): string => {
  if (errorMessage.includes("school_id") || errorMessage.includes("schools_id_fk")) {
    return "The specified school does not exist in the system.";
  }
  if (errorMessage.includes("posted_by") || errorMessage.includes("patron_teacher_id") || errorMessage.includes("users_id_fk")) {
    return "The specified user account could not be found.";
  }
  if (errorMessage.includes("student_id") || errorMessage.includes("students_id_fk")) {
    return "The specified student record does not exist.";
  }
  if (errorMessage.includes("activity_id") || errorMessage.includes("co_curricular_activities_id_fk")) {
    return "The specified co-curricular activity does not exist.";
  }
  if (errorMessage.includes("term_id") || errorMessage.includes("academic_terms_id_fk")) {
    return "The specified academic term does not exist.";
  }
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate key")) {
    return "A conflicting record already exists in the database.";
  }
  return errorMessage || "An unexpected database error occurred.";
};

// ==========================================
// SCHOOL EVENTS SERVICES
// ==========================================

export const createSchoolEventService = async (data: TInsertSchoolEvent) => {
  try {
    const [newEvent] = await db.insert(schoolEvents).values(data).returning();
    return {
      success: true,
      message: "School event successfully created.",
      data: newEvent,
    };
  } catch (error: any) {
    return {
      success: false,
      message: formatDatabaseError(error.message),
    };
  }
};

export const getSchoolEventByIdService = async (id: string) => {
  try {
    const event = await db.query.schoolEvents.findFirst({
      where: eq(schoolEvents.id, id),
      with: {
        school: true,
        postedByUser: true,
      },
    });

    if (!event) {
      return { success: false, message: "School event not found." };
    }

    return { success: true, data: event };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getSchoolEventsBySchoolService = async (schoolId: string) => {
  try {
    const events = await db.query.schoolEvents.findMany({
      where: eq(schoolEvents.schoolId, schoolId),
      with: {
        postedByUser: true,
      },
      orderBy: [desc(schoolEvents.startDate)],
    });

    return { success: true, data: events };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getUpcomingSchoolEventsService = async (schoolId: string) => {
  try {
    const currentDate = new Date();
    const events = await db.query.schoolEvents.findMany({
      where: and(
        eq(schoolEvents.schoolId, schoolId),
        gte(schoolEvents.startDate, currentDate)
      ),
      with: {
        postedByUser: true,
      },
      orderBy: [asc(schoolEvents.startDate)],
    });

    return { success: true, data: events };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getSchoolEventsByCategoryService = async (schoolId: string, category: any) => {
  try {
    const events = await db.query.schoolEvents.findMany({
      where: and(
        eq(schoolEvents.schoolId, schoolId),
        eq(schoolEvents.category, category)
      ),
      with: {
        postedByUser: true,
      },
      orderBy: [asc(schoolEvents.startDate)],
    });

    return { success: true, data: events };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const updateSchoolEventService = async (id: string, data: Partial<TInsertSchoolEvent>) => {
  try {
    const [updatedEvent] = await db
      .update(schoolEvents)
      .set(data)
      .where(eq(schoolEvents.id, id))
      .returning();

    if (!updatedEvent) {
      return { success: false, message: "School event not found for update." };
    }

    return {
      success: true,
      message: "School event successfully updated.",
      data: updatedEvent,
    };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const deleteSchoolEventService = async (id: string) => {
  try {
    const [deletedEvent] = await db
      .delete(schoolEvents)
      .where(eq(schoolEvents.id, id))
      .returning();

    if (!deletedEvent) {
      return { success: false, message: "School event not found for deletion." };
    }

    return { success: true, message: "School event successfully deleted." };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};


// ==========================================
// CO-CURRICULAR ACTIVITIES SERVICES
// ==========================================

export const createCoCurricularActivityService = async (data: TInsertCoCurricularActivity) => {
  try {
    const [newActivity] = await db.insert(coCurricularActivities).values(data).returning();
    return {
      success: true,
      message: "Co-curricular activity successfully created.",
      data: newActivity,
    };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getCoCurricularActivityByIdService = async (id: string) => {
  try {
    const activity = await db.query.coCurricularActivities.findFirst({
      where: eq(coCurricularActivities.id, id),
      with: {
        school: true,
        patronTeacher: true,
        memberships: {
          with: {
            student: true,
            term: true,
          },
        },
      },
    });

    if (!activity) {
      return { success: false, message: "Co-curricular activity not found." };
    }

    return { success: true, data: activity };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getCoCurricularActivitiesBySchoolService = async (schoolId: string) => {
  try {
    const activities = await db.query.coCurricularActivities.findMany({
      where: eq(coCurricularActivities.schoolId, schoolId),
      with: {
        patronTeacher: true,
      },
    });

    return { success: true, data: activities };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const updateCoCurricularActivityService = async (id: string, data: Partial<TInsertCoCurricularActivity>) => {
  try {
    const [updatedActivity] = await db
      .update(coCurricularActivities)
      .set(data)
      .where(eq(coCurricularActivities.id, id))
      .returning();

    if (!updatedActivity) {
      return { success: false, message: "Co-curricular activity not found for update." };
    }

    return {
      success: true,
      message: "Co-curricular activity successfully updated.",
      data: updatedActivity,
    };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const deleteCoCurricularActivityService = async (id: string) => {
  try {
    const [deletedActivity] = await db
      .delete(coCurricularActivities)
      .where(eq(coCurricularActivities.id, id))
      .returning();

    if (!deletedActivity) {
      return { success: false, message: "Co-curricular activity not found for deletion." };
    }

    return { success: true, message: "Co-curricular activity successfully deleted." };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};


// ==========================================
// STUDENT ACTIVITY MEMBERSHIPS SERVICES
// ==========================================

export const enrollStudentInActivityService = async (data: TInsertStudentActivityMembership) => {
  try {
    const [membership] = await db.insert(studentActivityMemberships).values(data).returning();
    return {
      success: true,
      message: "Student successfully enrolled in co-curricular activity.",
      data: membership,
    };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const bulkEnrollStudentsService = async (
  activityId: string,
  termId: string,
  studentIds: string[]
) => {
  try {
    if (!studentIds || studentIds.length === 0) {
      return { success: false, message: "No students provided for bulk enrollment." };
    }

    const enrollmentValues = studentIds.map((studentId) => ({
      studentId,
      activityId,
      termId,
    }));

    const insertedMemberships = await db
      .insert(studentActivityMemberships)
      .values(enrollmentValues)
      .returning();

    return {
      success: true,
      message: `${insertedMemberships.length} students successfully enrolled in the activity.`,
      data: insertedMemberships,
    };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getMembershipsByActivityService = async (activityId: string) => {
  try {
    const memberships = await db.query.studentActivityMemberships.findMany({
      where: eq(studentActivityMemberships.activityId, activityId),
      with: {
        student: true,
        term: true,
      },
    });

    return { success: true, data: memberships };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const getMembershipsByStudentService = async (studentId: string) => {
  try {
    const memberships = await db.query.studentActivityMemberships.findMany({
      where: eq(studentActivityMemberships.studentId, studentId),
      with: {
        activity: true,
        term: true,
      },
    });

    return { success: true, data: memberships };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const updateMembershipService = async (id: string, data: Partial<TInsertStudentActivityMembership>) => {
  try {
    const [updatedMembership] = await db
      .update(studentActivityMemberships)
      .set(data)
      .where(eq(studentActivityMemberships.id, id))
      .returning();

    if (!updatedMembership) {
      return { success: false, message: "Membership record not found for update." };
    }

    return {
      success: true,
      message: "Membership record successfully updated.",
      data: updatedMembership,
    };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};

export const removeStudentMembershipService = async (id: string) => {
  try {
    const [deletedMembership] = await db
      .delete(studentActivityMemberships)
      .where(eq(studentActivityMemberships.id, id))
      .returning();

    if (!deletedMembership) {
      return { success: false, message: "Membership record not found for removal." };
    }

    return { success: true, message: "Student successfully removed from activity." };
  } catch (error: any) {
    return { success: false, message: formatDatabaseError(error.message) };
  }
};