const express = require('express');
const { body, query } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getVerificationStats,
  getUnverifiedWholesalers,
  getVerifiedWholesalers,
  verifyWholesaler,
  getWholesalerDetails,
  getAllUsers
} = require('../controllers/verification');

const router = express.Router();

// Validation rules
const verifyWholesalerValidation = [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Reason must be between 5 and 200 characters')
];

// Query validation
const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['farmer', 'wholesaler', 'customer', 'panchayat'])
    .withMessage('Invalid role'),
  query('isVerified')
    .optional()
    .isBoolean()
    .withMessage('isVerified must be a boolean'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'name', 'email', 'role'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const getWholesalersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'name', 'businessName'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes
router.get('/stats', authenticateToken, requireRole('panchayat'), getVerificationStats);
router.get('/wholesalers/unverified', authenticateToken, requireRole('panchayat'), getWholesalersValidation, getUnverifiedWholesalers);
router.get('/wholesalers/verified', authenticateToken, requireRole('panchayat'), getWholesalersValidation, getVerifiedWholesalers);
router.get('/wholesalers/:id', authenticateToken, requireRole('panchayat'), getWholesalerDetails);
router.put('/wholesalers/:id', authenticateToken, requireRole('panchayat'), verifyWholesalerValidation, verifyWholesaler);
router.get('/users', authenticateToken, requireRole('panchayat'), getUsersValidation, getAllUsers);

module.exports = router;
