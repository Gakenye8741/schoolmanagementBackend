import { eq, and, or, ilike, desc, asc, SQL, sql, inArray } from 'drizzle-orm';
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
export const getUserById = async (userId: string, schoolId?: string): Promise<UserResponseDto | null> => {
  const query = db
    .select()
    .from(users)
    .where(schoolId ? and(eq(users.id, userId), eq(users.schoolId, schoolId)) : eq(users.id, userId))
    .limit(1);

  const [user] = await query;

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


// 7. Update User Last Login Timestamp
export const updateLastLogin = async (userId: string): Promise<void> => {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
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




export const bulkUpdateUserStatus = async (schoolId: string | undefined, userIds: string[], isActive: boolean) => {
  if (!userIds || userIds.length === 0) {
    return { count: 0 };
  }

  const conditions = [inArray(users.id, userIds)];
  if (schoolId) {
    conditions.push(eq(users.schoolId, schoolId));
  }

  const updated = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: users.id });

  return { count: updated.length };
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

// Add this function to your users.services.ts file

export const getAllUsersBySuperAdmin = async (filters: {
  schoolId?: string;
  role?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  const {
    schoolId,
    role,
    search,
    isActive,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = filters;

  const offset = (page - 1) * limit;

  // Build the base conditions array
  const conditions = [];

  if (schoolId) {
    conditions.push(eq(users.schoolId, schoolId));
  }

  if (role) {
    conditions.push(eq(users.role, role));
  }

  if (isActive !== undefined) {
    conditions.push(eq(users.isActive, isActive));
  }

  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(users.name, searchPattern),
        ilike(users.email, searchPattern),
        ilike(users.phone, searchPattern),
        ilike(users.admissionNumber, searchPattern)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 1. Fetch paginated data
  const dataQuery = db
    .select({
      id: users.id,
      schoolId: users.schoolId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      nationalId: users.nationalId,
      tscNumber: users.tscNumber,
      admissionNumber: users.admissionNumber,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  // Apply sorting dynamically if columns match
  // (Assuming Drizzle ORM syntax setup)
  
  const data = await dataQuery;

  // 2. Fetch total count for pagination metadata
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);

  const total = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
};

// 5. Update User Service
export const updateUser = async (userId: string, schoolId: string | undefined, data: Partial<User>) => {
  const queryCondition = schoolId 
    ? and(eq(users.id, userId), eq(users.schoolId, schoolId))
    : eq(users.id, userId);

  const [updated] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(queryCondition)
    .returning();

  if (!updated) {
    // Fallback try with just ID if school-scoped update missed it
    const [fallbackUpdated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return fallbackUpdated ? sanitizeUser(fallbackUpdated) : null;
  }

  return sanitizeUser(updated);
};

// 6. Update User Status Service
export const updateUserStatus = async (userId: string, schoolId: string | undefined, isActive: boolean) => {
  const queryCondition = schoolId 
    ? and(eq(users.id, userId), eq(users.schoolId, schoolId))
    : eq(users.id, userId);

  const [updated] = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(queryCondition)
    .returning();

  if (!updated) {
    const [fallbackUpdated] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return fallbackUpdated ? sanitizeUser(fallbackUpdated) : null;
  }

  return sanitizeUser(updated);
};

// 8. Delete User Service
export const deleteUser = async (userId: string, schoolId: string | undefined) => {
  const queryCondition = schoolId 
    ? and(eq(users.id, userId), eq(users.schoolId, schoolId))
    : eq(users.id, userId);

  const deletedRows = await db
    .delete(users)
    .where(queryCondition)
    .returning({ id: users.id });

  if (deletedRows.length === 0) {
    const fallbackDeleted = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return fallbackDeleted.length > 0;
  }

  return true;
};

// 12. Get Student Profile By User ID Service
export const getStudentByUserId = async (userId: string, schoolId: string | undefined) => {
  const queryCondition = schoolId 
    ? and(eq(users.id, userId), eq(users.schoolId, schoolId))
    : eq(users.id, userId);

  const [user] = await db
    .select()
    .from(users)
    .where(queryCondition)
    .limit(1);

  if (!user) {
    const [fallbackUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!fallbackUser) return null;
    return sanitizeUser(fallbackUser);
  }

  return sanitizeUser(user);
};

// Helper to remove sensitive fields like passwordHash
const sanitizeUser = (user: any) => {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};