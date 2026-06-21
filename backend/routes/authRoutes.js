import express from 'express';
import { login, getMe, updateProfile, getUsers, createUser, updateUser, deleteUser, resetPassword } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';
import { loginValidator } from '../validators/authValidator.js';
import { createUserValidator, updateUserValidator, resetPasswordValidator } from '../validators/userValidator.js';
import validate from '../validators/validate.js';

const router = express.Router();

// Public routes
router.post('/login', loginValidator, validate, login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Super Admin only routes
router.get('/users', protect, authorize('super_admin'), getUsers);
router.post('/users', protect, authorize('super_admin'), createUserValidator, validate, createUser);
router.put('/users/:id', protect, authorize('super_admin'), updateUserValidator, validate, updateUser);
router.delete('/users/:id', protect, authorize('super_admin'), deleteUser);
router.put('/users/:id/reset-password', protect, authorize('super_admin'), resetPasswordValidator, validate, resetPassword);

export default router;
