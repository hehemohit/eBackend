const mongoose = require('mongoose');

const produceSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['vegetables', 'fruits', 'grains', 'spices', 'dairy', 'poultry', 'other'],
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter', 'other'],
    trim: true
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['available', 'auction', 'auction_ended', 'sold'],
    default: 'available'
  },
  auctionEndTime: {
    type: Date,
    default: null
  },
  currentHighestBid: {
    type: Number,
    default: 0
  },
  currentHighestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Location information
  location: {
    type: String,
    required: true,
    trim: true
  },
  // Quality grade
  qualityGrade: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: 'A'
  },
  // Harvest date
  harvestDate: {
    type: Date,
    required: true
  },
  // Organic certification
  isOrganic: {
    type: Boolean,
    default: false
  },
  // Minimum bid increment
  bidIncrement: {
    type: Number,
    default: 10
  },
  // Payment completion fields
  paymentCompleted: {
    type: Boolean,
    default: false
  },
  paymentCompletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
produceSchema.index({ farmer: 1, status: 1 });
produceSchema.index({ category: 1, status: 1 });
produceSchema.index({ auctionEndTime: 1 });

module.exports = mongoose.model('Produce', produceSchema);
