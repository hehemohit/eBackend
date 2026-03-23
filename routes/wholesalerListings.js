const express = require('express');
const { body, query } = require('express-validator');
const { authenticateToken, requireRole, requireVerification } = require('../middleware/auth');
const {
  getWholesalerListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
  getWonBids
} = require('../controllers/wholesalerListings');

const router = express.Router();

// Validation rules
const createListingValidation = [
  body('bidId')
    .isMongoId()
    .withMessage('Valid bid ID is required'),
  body('markupPercentage')
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Markup percentage must be between 0 and 1000'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('deliveryOptions.homeDelivery')
    .optional()
    .isBoolean()
    .withMessage('homeDelivery must be a boolean'),
  body('deliveryOptions.pickupAvailable')
    .optional()
    .isBoolean()
    .withMessage('pickupAvailable must be a boolean'),
  body('deliveryOptions.deliveryCharges')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Delivery charges must be greater than or equal to 0')
];

const updateListingValidation = [
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be greater than or equal to 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('availableQuantity')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Available quantity must be greater than or equal to 0'),
  body('deliveryOptions.homeDelivery')
    .optional()
    .isBoolean()
    .withMessage('homeDelivery must be a boolean'),
  body('deliveryOptions.pickupAvailable')
    .optional()
    .isBoolean()
    .withMessage('pickupAvailable must be a boolean'),
  body('deliveryOptions.deliveryCharges')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Delivery charges must be greater than or equal to 0')
];

// Query validation
const getListingsValidation = [
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
  query('wholesaler')
    .optional()
    .isMongoId()
    .withMessage('Invalid wholesaler ID'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be greater than or equal to 0'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be greater than or equal to 0'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'price', 'produceName'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const getMyListingsValidation = [
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
    .isIn(['available', 'sold', 'out_of_stock'])
    .withMessage('Invalid status'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'price', 'produceName'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const getWonBidsValidation = [
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
    .isIn(['createdAt', 'amount'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes
router.get('/', getListingsValidation, getWholesalerListings);
router.get('/:id', getListingById);
router.post('/', authenticateToken, requireRole('wholesaler'), requireVerification, createListingValidation, createListing);
router.put('/:id', authenticateToken, requireRole('wholesaler'), requireVerification, updateListingValidation, updateListing);
router.delete('/:id', authenticateToken, requireRole('wholesaler'), requireVerification, deleteListing);
router.get('/my/listings', authenticateToken, requireRole('wholesaler'), requireVerification, getMyListingsValidation, getMyListings);
router.get('/my/won-bids', authenticateToken, requireRole('wholesaler'), requireVerification, getWonBidsValidation, getWonBids);

module.exports = router;
