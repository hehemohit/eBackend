const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['farmer', 'wholesaler'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
});

const ticketSchema = new mongoose.Schema({
  produce: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Produce',
    required: true
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wholesaler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  winningBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'disputed', 'payment_completed'],
    default: 'active'
  },
  messages: [messageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  paymentCompleted: {
    type: Boolean,
    default: false
  },
  paymentCompletedAt: {
    type: Date
  },
  deliveryDetails: {
    address: String,
    contactNumber: String,
    preferredDeliveryDate: Date,
    specialInstructions: String
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'cheque'],
      default: 'cash'
    },
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    transactionId: String,
    completedAt: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
ticketSchema.index({ farmer: 1, status: 1 });
ticketSchema.index({ wholesaler: 1, status: 1 });
ticketSchema.index({ produce: 1 });
ticketSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
