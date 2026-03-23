const express = require('express');
const { body, query } = require('express-validator');
const { authenticateToken, requireRole, requireVerification } = require('../middleware/auth');
const {
  getBids,
  getBidById,
  placeBid,
  updateBid,
  cancelBid,
  getProduceBids
} = require('../controllers/bids');

const router = express.Router();

// Validation rules
const placeBidValidation = [
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Bid amount must be greater than or equal to 0'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Message must be less than 200 characters')
];

const updateBidValidation = [
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Bid amount must be greater than or equal to 0'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Message must be less than 200 characters')
];

// Query validation
const getBidsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['active', 'won', 'lost', 'cancelled'])
    .withMessage('Invalid status'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'amount', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes
router.get('/', authenticateToken, requireRole('wholesaler'), getBidsValidation, getBids);
router.get('/:id', authenticateToken, requireRole('wholesaler'), getBidById);
router.post('/produce/:produceId', authenticateToken, requireRole('wholesaler'), requireVerification, placeBidValidation, placeBid);
router.put('/:id', authenticateToken, requireRole('wholesaler'), requireVerification, updateBidValidation, updateBid);
router.delete('/:id', authenticateToken, requireRole('wholesaler'), cancelBid);
router.get('/produce/:produceId/bids', authenticateToken, requireRole('farmer'), getProduceBids);

module.exports = router;
