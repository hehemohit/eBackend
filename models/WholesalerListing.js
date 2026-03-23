const mongoose = require('mongoose');

const wholesalerListingSchema = new mongoose.Schema({
  wholesaler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    required: true
  },
  originalProduce: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Produce',
    required: true
  },
  produceName: {
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
  price: {
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
    enum: ['available', 'sold', 'out_of_stock'],
    default: 'available'
  },
  // Markup percentage applied
  markupPercentage: {
    type: Number,
    required: true,
    min: 0
  },
  // Original bid amount
  originalBidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Location for delivery
  location: {
    type: String,
    required: true,
    trim: true
  },
  // Available quantity (can be less than total if partially sold)
  availableQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  // Quality grade
  qualityGrade: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: 'A'
  },
  // Organic certification
  isOrganic: {
    type: Boolean,
    default: false
  },
  // Delivery options
  deliveryOptions: {
    homeDelivery: {
      type: Boolean,
      default: false
    },
    pickupAvailable: {
      type: Boolean,
      default: true
    },
    deliveryCharges: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
wholesalerListingSchema.index({ wholesaler: 1, status: 1 });
wholesalerListingSchema.index({ category: 1, status: 1 });
wholesalerListingSchema.index({ price: 1, status: 1 });

module.exports = mongoose.model('WholesalerListing', wholesalerListingSchema);
