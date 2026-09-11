import { Router } from 'express';
import * as userController from './users.controller';
import { adminAuth, adminOrTeacherAuth, anyAuthenticatedUser } from '../../middleware/bearAuth';

const userRouter = Router();

// userRouter protected with appropriate role-based authentication middleware
userRouter.get('/', adminOrTeacherAuth, userController.getUsersController);
userRouter.post('/', adminAuth, userController.createUserController);

userRouter.get('/email', adminAuth, userController.getUserByEmailController);
userRouter.get('/teachers', adminOrTeacherAuth, userController.getTeachersBySchoolController);
userRouter.get('/students', adminOrTeacherAuth, userController.getStudentsBySchoolIdController);
// userRouter.get('/students/class/:classId', adminOrTeacherAuth, userController.getStudentsByClassController);
userRouter.get('/check-admission', adminAuth, userController.checkAdmissionNumberController);

userRouter.patch('/status/bulk', adminAuth, userController.bulkUpdateUserStatusController);

userRouter.get('/role/:role/count', adminOrTeacherAuth, userController.getUsersCountByRoleController);

userRouter.get('/:id', anyAuthenticatedUser, userController.getUserByIdController);
userRouter.put('/:id', adminAuth, userController.updateUserController);
userRouter.delete('/:id', adminAuth, userController.deleteUserController);
userRouter.patch('/:id/status', adminAuth, userController.updateUserStatusController);
userRouter.get('/:id/student-profile', anyAuthenticatedUser, userController.getStudentByUserIdController);

export default userRouter;