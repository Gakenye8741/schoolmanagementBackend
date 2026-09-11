import { eq, and, or, ilike, desc, asc, SQL, sql } from 'drizzle-orm';
import  db  from '../../drizzle/db'; 
import { 
  users, 
  classes, 
  schools, 
  students, 
  feeTransactions, 
  schoolExpenses, 
  cbcAssessments, 
  homeworkAssignments, 
  attendance, 
  disciplinaryRecords, 
  announcements, 
  schoolEvents 
} from '../../drizzle/schema'; 
import type { TSelectUser, TInsertUser } from '../../drizzle/types';

export interface GetUsersParams {
  schoolId: string;
  role?: TSelectUser['role'];
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export type UserResponseDto = Omit<TSelectUser, 'passwordHash'>;

export interface StudentProfileDto extends UserResponseDto {
  studentDetails: {
    id: string;
    classId: string | null;
    admissionDate: string | null;
  } | null;
}

// 1. Get Users with Pagination, Filtering, and Search
export const getUsers = async (params: GetUsersParams) => {
  const {
    schoolId,
    role,
    search,
    isActive,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const conditions: SQL[] = [eq(users.schoolId, schoolId)];

  if (role) {
    conditions.push(eq(users.role, role));
  }

  if (typeof isActive === 'boolean') {
    conditions.push(eq(users.isActive, isActive));
  }

  if (search && search.trim() !== '') {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(users.name, searchTerm),
        ilike(users.email, searchTerm),
        ilike(users.phone, searchTerm),
        ilike(users.admissionNumber, searchTerm)
      )!
    );
  }

  const whereClause = and(...conditions);
  const offset = (page - 1) * limit;

  let sortColumn: any = users.createdAt;
  if (sortBy === 'name') sortColumn = users.name;
  if (sortBy === 'email') sortColumn = users.email;

  const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const [fetchedUsers, allMatchingUsers] = await Promise.all([
    db
      .select()
      .from(users)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderByClause),
    db
      .select({ id: users.id })
      .from(users)
      .where(whereClause),
  ]);

  const total = allMatchingUsers.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const sanitizedUsers: UserResponseDto[] = fetchedUsers.map((user) => {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  });

  return {
    data: sanitizedUsers,
    total,
    page,
    limit,
    totalPages,
  };
};

// 2. Get User By ID
export const getUserById = async (userId: string, schoolId: string): Promise<UserResponseDto | null> => {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.schoolId, schoolId)))
    .limit(1);

  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

// 3. Get User By Email (Platform-wide or school-specific lookup)
export const getUserByEmail = async (email: string, schoolId?: string): Promise<TSelectUser | null> => {
  const conditions: SQL[] = [eq(users.email, email)];
  if (schoolId) {
    conditions.push(eq(users.schoolId, schoolId));
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .limit(1);

  return user || null;
};

// 4. Create User
export const createUser = async (data: TInsertUser): Promise<UserResponseDto> => {
  const [newUser] = await db
    .insert(users)
    .values(data)
    .returning();

  const { passwordHash, ...safeUser } = newUser;
  return safeUser;
};

// 5. Update User Details
export const updateUser = async (userId: string, schoolId: string, patch: Partial<TInsertUser>): Promise<UserResponseDto | null> => {
  const [updatedUser] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.schoolId, schoolId)))
    .returning();

  if (!updatedUser) return null;

  const { passwordHash, ...safeUser } = updatedUser;
  return safeUser;
};

// 6. Update User Active Status (Deactivate / Activate)
export const updateUserStatus = async (userId: string, schoolId: string, isActive: boolean): Promise<UserResponseDto | null> => {
  const [updatedUser] = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.schoolId, schoolId)))
    .returning();

  if (!updatedUser) return null;

  const { passwordHash, ...safeUser } = updatedUser;
  return safeUser;
};

// 7. Update User Last Login Timestamp
export const updateLastLogin = async (userId: string): Promise<void> => {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
};

// 8. Delete User
export const deleteUser = async (userId: string, schoolId: string): Promise<boolean> => {
  const [deletedUser] = await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.schoolId, schoolId)))
    .returning({ id: users.id });

  return !!deletedUser;
};

// 9. Get Users Count By Role
export const getUsersCountByRole = async (schoolId: string, role: TSelectUser['role']): Promise<number> => {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, role)));

  return Number(result?.count || 0);
};

// 10. Get Teachers By School (Shortcut Service)
export const getTeachersBySchool = async (schoolId: string): Promise<UserResponseDto[]> => {
  const fetchedTeachers = await db
    .select()
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, 'teacher'), eq(users.isActive, true)))
    .orderBy(asc(users.name));

  return fetchedTeachers.map((user) => {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  });
};

// 11. Get Students By Class (Using relation join or query)
// export const getStudentsByClass = async (schoolId: string, classId: string): Promise<UserResponseDto[]> => {
//   const fetchedStudents = await db
//     .select({
//       user: users,
//     })
//     .from(students)
//     .innerJoin(u eq(students.userId, users.id))
//     .where(and(eq(students.schoolId, schoolId), eq(students.classId, classId)));

//   return fetchedStudents.map(({ user }) => {
//     const { passwordHash, ...safeUser } = user as TSelectUser;
//     return safeUser;
//   });
// };

// 12. Get Student Profile with Full School and Class Details by Student User ID (Using Drizzle Relational Query `with`)
export const getStudentByUserId = async (userId: string, schoolId: string): Promise<StudentProfileDto | null> => {
  const studentRecord = await db.query.students.findFirst({
    where: and(eq(students.id, userId), eq(students.schoolId, schoolId)),
    with: {
      parent: true,
      class: true,
    },
  });

  if (!studentRecord) return null;

  const parent = studentRecord.parent;

  return {
    id: studentRecord.id,
    name: parent?.name || '',
    email: parent?.email || '',
    phone: parent?.phone || '',
    role: 'student' as const,
    schoolId: studentRecord.schoolId,
    isActive: studentRecord.isEnrolled,
    classDetails: studentRecord.class ? {
      id: studentRecord.class.id,
      gradeLevel: studentRecord.class.gradeLevel,
      stream: studentRecord.class.stream,
      academicYear: studentRecord.class.academicYear,
    } : null,
    parentDetails: parent ? {
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
    } : null,
    studentDetails: {
      id: studentRecord.id,
      classId: studentRecord.classId,
      admissionDate: studentRecord.enrollmentDate || null,
    },
  };
};
// 13. Get All Students by School ID with Joined Student Record Fields (Using Drizzle Relational Query `with`)
// 13. Get All Students by School ID with Joined Student Record Fields (Using Drizzle Relational Query `with`)
export const getStudentsBySchoolId = async (schoolId?: string): Promise<StudentProfileDto[]> => {
  const whereClause = schoolId 
    ? eq(students.schoolId, schoolId)
    : undefined;

  const studentRecords = await db.query.students.findMany({
    where: whereClause,
    with: {
      parent: true,
      class: true,
    },
  });

  return studentRecords.map((studentRecord) => {
    const parent = studentRecord.parent;

    return {
      id: studentRecord.id,
      name: parent?.name || '',
      email: parent?.email || '',
      phone: parent?.phone || '',
      role: 'student' as const,
      schoolId: studentRecord.schoolId,
      isActive: studentRecord.isEnrolled,
      createdAt: studentRecord.createdAt,
      updatedAt: studentRecord.updatedAt,
      admissionNumber: studentRecord.admissionNumber,
      upiNumber: studentRecord.upiNumber,
      dateOfBirth: studentRecord.dateOfBirth,
      gender: studentRecord.gender,
      enrollmentDate: studentRecord.enrollmentDate,
      isEnrolled: studentRecord.isEnrolled,
      classDetails: studentRecord.class ? {
        id: studentRecord.class.id,
        gradeLevel: studentRecord.class.gradeLevel,
        stream: studentRecord.class.stream,
        academicYear: studentRecord.class.academicYear,
      } : null,
      parentDetails: parent ? {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
      } : null,
      studentDetails: {
        id: studentRecord.id,
        classId: studentRecord.classId,
        admissionDate: studentRecord.enrollmentDate || null,
      },
    };
  });
};

// 14. Bulk Update User Status (Activate/Deactivate multiple users at once)
export const bulkUpdateUserStatus = async (userIds: string[], schoolId: string, isActive: boolean): Promise<number> => {
  if (userIds.length === 0) return 0;

  const updatedRecords = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(users.schoolId, schoolId),
      sql`${users.id} = ANY(${userIds})`
    ))
    .returning({ id: users.id });

  return updatedRecords.length;
};

// 15. Check if Admission Number Exists Within School (For uniqueness validation)
export const isAdmissionNumberTaken = async (admissionNumber: string, schoolId: string, excludeUserId?: string): Promise<boolean> => {
  const conditions = [
    eq(users.schoolId, schoolId),
    eq(users.admissionNumber, admissionNumber)
  ];

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .limit(1);

  if (!existingUser) return false;
  if (excludeUserId && existingUser.id === excludeUserId) return false;

  return true;
};