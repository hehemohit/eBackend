const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
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
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Expiry date for the notification
  expiresAt: {
    type: Date,
    default: null
  },
  // Related entities
  relatedProduce: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Produce',
    default: null
  },
  relatedBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    default: null
  },
  relatedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesalerListing',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
