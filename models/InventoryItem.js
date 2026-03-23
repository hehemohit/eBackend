const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  listingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  produceName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String
  }],
  category: {
    type: String,
    required: true,
    enum: ['vegetables', 'fruits', 'grains', 'spices', 'dairy', 'poultry', 'other']
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['available', 'out_of_stock', 'sold'],
    default: 'available',
    index: true
  },
  wholesaler: {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    businessName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
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
      default: 0,
      min: 0
    }
  },
  lastPurchasedBy: {
    type: String,
    default: null
  },
  purchaseHistory: [{
    purchasedBy: String,
    purchasedAt: {
      type: Date,
      default: Date.now
    },
    quantity: Number,
    price: Number
  }]
}, {
  timestamps: true
});

// Index for better query performance
inventoryItemSchema.index({ status: 1, category: 1 });
inventoryItemSchema.index({ 'wholesaler.id': 1 });
inventoryItemSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
