const express = require('express');
const { body, query } = require('express-validator');
const { authenticateToken, requireRole, requireVerification } = require('../middleware/auth');
const {
  getProduce,
  getProduceById,
  createProduce,
  updateProduce,
  deleteProduce,
  startAuction,
  endAuction
} = require('../controllers/produce');

const router = express.Router();

// Validation rules
const createProduceValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Produce name must be between 2 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('category')
    .isIn(['vegetables', 'fruits', 'grains', 'spices', 'dairy', 'poultry', 'other'])
    .withMessage('Invalid category'),
  body('quantity')
    .isFloat({ min: 0.1 })
    .withMessage('Quantity must be greater than 0'),
  body('unit')
    .isIn(['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter', 'other'])
    .withMessage('Invalid unit'),
  body('basePrice')
    .isFloat({ min: 0 })
    .withMessage('Base price must be greater than or equal to 0'),
  body('location')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Location must be between 5 and 100 characters'),
  body('harvestDate')
    .isISO8601()
    .withMessage('Please provide a valid harvest date'),
  body('qualityGrade')
    .optional()
    .isIn(['A', 'B', 'C'])
    .withMessage('Quality grade must be A, B, or C'),
  body('isOrganic')
    .optional()
    .isBoolean()
    .withMessage('isOrganic must be a boolean value')
];

const updateProduceValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Produce name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('category')
    .optional()
    .isIn(['vegetables', 'fruits', 'grains', 'spices', 'dairy', 'poultry', 'other'])
    .withMessage('Invalid category'),
  body('quantity')
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage('Quantity must be greater than 0'),
  body('unit')
    .optional()
    .isIn(['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter', 'other'])
    .withMessage('Invalid unit'),
  body('basePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base price must be greater than or equal to 0'),
  body('location')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Location must be between 5 and 100 characters'),
  body('harvestDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid harvest date'),
  body('qualityGrade')
    .optional()
    .isIn(['A', 'B', 'C'])
    .withMessage('Quality grade must be A, B, or C'),
  body('isOrganic')
    .optional()
    .isBoolean()
    .withMessage('isOrganic must be a boolean value')
];

const startAuctionValidation = [
  body('auctionDuration')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Auction duration must be between 1 and 168 hours')
];

// Query validation
const getProduceValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isIn(['vegetables', 'fruits', 'grains', 'spices', 'dairy', 'poultry', 'other'])
    .withMessage('Invalid category'),
  query('status')
    .optional()
    .isIn(['available', 'auction', 'auction_ended', 'sold'])
    .withMessage('Invalid status'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'name', 'basePrice', 'quantity', 'auctionEndTime'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes
router.get('/', getProduceValidation, getProduce);
router.get('/:id', getProduceById);
router.post('/', authenticateToken, requireRole('farmer'), createProduceValidation, createProduce);
router.put('/:id', authenticateToken, requireRole('farmer'), updateProduceValidation, updateProduce);
router.delete('/:id', authenticateToken, requireRole('farmer'), deleteProduce);
router.post('/:id/start-auction', authenticateToken, requireRole('farmer'), startAuctionValidation, startAuction);
router.post('/:id/end-auction', authenticateToken, requireRole('farmer'), endAuction);

module.exports = router;
