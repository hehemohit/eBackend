const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const {
  getTickets,
  getTicket,
  sendMessage,
  updateTicketStatus,
  createTicket,
  markPaymentDone
} = require('../controllers/tickets');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all tickets for a user
router.get('/', getTickets);

// Mark payment as done for a ticket - MUST be before /:ticketId route
router.post('/:ticketId/payment-done', markPaymentDone);

// Get a specific ticket with messages
router.get('/:ticketId', getTicket);

// Send a message in a ticket
router.post('/:ticketId/messages', [
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
], sendMessage);

// Update ticket status and details
router.put('/:ticketId', [
  body('status')
    .optional()
    .isIn(['active', 'completed', 'cancelled', 'disputed'])
    .withMessage('Invalid status'),
  body('deliveryDetails.address')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('deliveryDetails.contactNumber')
    .optional()
    .isLength({ min: 10, max: 15 })
    .withMessage('Contact number must be between 10 and 15 characters'),
  body('deliveryDetails.preferredDeliveryDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid delivery date format'),
  body('paymentDetails.method')
    .optional()
    .isIn(['cash', 'bank_transfer', 'upi', 'cheque'])
    .withMessage('Invalid payment method'),
  body('paymentDetails.amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number'),
  body('paymentDetails.status')
    .optional()
    .isIn(['pending', 'completed', 'failed'])
    .withMessage('Invalid payment status')
], updateTicketStatus);

// Create a ticket (typically called when auction ends)
router.post('/', [
  body('produceId')
    .isMongoId()
    .withMessage('Invalid produce ID'),
  body('winningBidId')
    .isMongoId()
    .withMessage('Invalid bid ID')
], createTicket);

// Mark payment as done for a ticket
// router.post('/:ticketId/payment-done', markPaymentDone);

module.exports = router;
