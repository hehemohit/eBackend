const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  wholesaler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  produce: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Produce',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'cancelled'],
    default: 'active'
  },
  // Bid message/note
  message: {
    type: String,
    trim: true,
    maxlength: 200
  },
  // Auto-bid settings
  maxBidAmount: {
    type: Number,
    default: null
  },
  // Bid timestamp for tie-breaking
  bidTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
bidSchema.index({ wholesaler: 1, status: 1 });
bidSchema.index({ produce: 1, status: 1 });
bidSchema.index({ amount: -1, bidTime: 1 });

// Ensure one active bid per wholesaler per produce
bidSchema.index({ wholesaler: 1, produce: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

module.exports = mongoose.model('Bid', bidSchema);
