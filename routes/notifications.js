const express = require('express');
const { query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  deleteAllNotifications,
  createNotification
} = require('../controllers/notifications');

const router = express.Router();

// Validation rules
const getNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn([
      'bid_placed',
      'bid_won',
      'bid_lost',
      'auction_ended',
      'produce_approved',
      'produce_rejected',
      'wholesaler_verified',
      'wholesaler_rejected',
      'new_produce',
      'price_update',
      'system_announcement'
    ])
    .withMessage('Invalid notification type'),
  query('isRead')
    .optional()
    .isBoolean()
    .withMessage('isRead must be a boolean'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'priority', 'type'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes
router.get('/', authenticateToken, getNotificationsValidation, getNotifications);
router.get('/:id', authenticateToken, getNotificationById);
router.put('/:id/read', authenticateToken, markAsRead);
router.put('/read-all', authenticateToken, markAllAsRead);
router.get('/unread/count', authenticateToken, getUnreadCount);
router.delete('/:id', authenticateToken, deleteNotification);
router.delete('/', authenticateToken, deleteAllNotifications);
router.post('/create', authenticateToken, createNotification); // For testing/admin use

module.exports = router;
