import { Request, Response } from 'express';
import * as userService from './users.serices';

// Helper to safely extract a single string from req.params or req.query
const getStringParam = (param: string | string[] | undefined): string | undefined => {
  if (Array.isArray(param)) return param[0];
  return param;
};

// 1. Get Users with Pagination, Filtering, and Search (Super Admin can view all schools if schoolId is omitted)
// 1. Get Users with Pagination, Filtering, and Search (Super Admin can view all schools if schoolId is omitted)
export const getUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    const { role, search, isActive, page, limit, sortBy, sortOrder } = req.query;

    // Rule enforcement: Non-super-admins cannot view student records via this general list endpoint if restricted
    let roleFilter = role as any;
    if (!isSuperAdmin && role === 'student') {
      res.status(403).json({ success: false, message: 'Access denied to student records' });
      return;
    }

    const result = await userService.getUsers({
      schoolId: isSuperAdmin ? (schoolId || undefined) : schoolId,
      role: roleFilter,
      search: getStringParam(search as string | string[]),
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(getStringParam(page as string | string[]) || '1', 10) : undefined,
      limit: limit ? parseInt(getStringParam(limit as string | string[]) || '10', 10) : undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 2. Get User By ID
export const getUserByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const foundUser = await userService.getUserById(id, isSuperAdmin ? (schoolId || undefined) : schoolId);
    if (!foundUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: foundUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 3. Get User By Email
export const getUserByEmailController = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = getStringParam(req.query.email as string | string[]);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!email) {
      res.status(400).json({ success: false, message: 'Email query parameter is required' });
      return;
    }

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    const foundUser = await userService.getUserByEmail(email, isSuperAdmin ? (schoolId || undefined) : schoolId);
    if (!foundUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const { passwordHash, ...safeUser } = foundUser;
    res.status(200).json({ success: true, data: safeUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 4. Create User
export const createUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || req.body.schoolId || user?.schoolId;

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    const userData = { ...req.body, ...(schoolId ? { schoolId } : {}) };
    
    if (userData.admissionNumber && schoolId) {
      const isTaken = await userService.isAdmissionNumberTaken(userData.admissionNumber, schoolId);
      if (isTaken) {
        res.status(400).json({ success: false, message: 'Admission number is already taken within this school' });
        return;
      }
    }

    const newUser = await userService.createUser(userData);
    res.status(201).json({ success: true, data: newUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 5. Update User Details
export const updateUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    if (req.body.admissionNumber && schoolId) {
      const isTaken = await userService.isAdmissionNumberTaken(req.body.admissionNumber, schoolId, id);
      if (isTaken) {
        res.status(400).json({ success: false, message: 'Admission number is already taken by another user' });
        return;
      }
    }

    const updatedUser = await userService.updateUser(id, isSuperAdmin ? (schoolId || undefined) : schoolId, req.body);
    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 6. Update User Active Status
export const updateUserStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);
    const { isActive } = req.body;

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, message: 'isActive boolean field is required' });
      return;
    }

    const updatedUser = await userService.updateUserStatus(id, isSuperAdmin ? (schoolId || undefined) : schoolId, isActive);
    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 8. Delete User
export const deleteUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const deleted = await userService.deleteUser(id, isSuperAdmin ? (schoolId || undefined) : schoolId);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 9. Get Users Count By Role
export const getUsersCountByRoleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = getStringParam(req.params.role);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!role) {
      res.status(400).json({ success: false, message: 'Role is required' });
      return;
    }

    const count = await userService.getUsersCountByRole(isSuperAdmin ? (schoolId || undefined) : schoolId, role as any);
    res.status(200).json({ success: true, count });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 10. Get Teachers By School
export const getTeachersBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    const teachers = await userService.getTeachersBySchool(isSuperAdmin ? (schoolId || undefined) : schoolId);
    res.status(200).json({ success: true, data: teachers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 12. Get Student Profile By ID
export const getStudentByUserIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const studentProfile = await userService.getStudentByUserId(id, isSuperAdmin ? (schoolId || undefined) : schoolId);
    if (!studentProfile) {
      res.status(404).json({ success: false, message: 'Student profile not found' });
      return;
    }

    res.status(200).json({ success: true, data: studentProfile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 13. Get All Students by School ID
export const getStudentsBySchoolIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    const students = await userService.getStudentsBySchoolId(isSuperAdmin ? (schoolId || undefined) : schoolId);
    res.status(200).json({ success: true, data: students });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 14. Bulk Update User Status
export const bulkUpdateUserStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);
    const { userIds, isActive } = req.body;

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!Array.isArray(userIds) || typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, message: 'userIds array and isActive boolean are required' });
      return;
    }

    const updatedCount = await userService.bulkUpdateUserStatus(userIds, isSuperAdmin ? (schoolId || undefined) : schoolId, isActive);
    res.status(200).json({ success: true, updatedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// 15. Check Admission Number Availability
export const checkAdmissionNumberController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const schoolId = getStringParam(req.params.schoolId) || user?.schoolId || getStringParam(req.query.schoolId as string | string[]);
    const admissionNumber = getStringParam(req.query.admissionNumber as string | string[]);
    const excludeUserId = getStringParam(req.query.excludeUserId as string | string[]);

    if (!isSuperAdmin && !schoolId) {
      res.status(400).json({ success: false, message: 'School ID is required' });
      return;
    }

    if (!admissionNumber) {
      res.status(400).json({ success: false, message: 'admissionNumber query parameter is required' });
      return;
    }

    const isTaken = await userService.isAdmissionNumberTaken(
      admissionNumber,
      isSuperAdmin ? (schoolId || undefined) : schoolId,
      excludeUserId
    );

    res.status(200).json({ success: true, isTaken });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};