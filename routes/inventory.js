const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');

// GET /api/inventory - Get all inventory items
router.get('/', async (req, res) => {
  try {
    const { status, category, wholesaler } = req.query;
    let filter = {};

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by wholesaler
    if (wholesaler) {
      filter['wholesaler.id'] = wholesaler;
    }

    const items = await InventoryItem.find(filter).sort({ createdAt: -1 });
    
    // Calculate stats
    const stats = await InventoryItem.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] } },
          sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
          totalValue: { $sum: '$price' }
        }
      }
    ]);

    const inventoryStats = stats[0] || {
      total: 0,
      available: 0,
      outOfStock: 0,
      sold: 0,
      totalValue: 0
    };

    res.json({
      success: true,
      data: items,
      stats: inventoryStats
    });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items',
      error: error.message
    });
  }
});

// GET /api/inventory/stats - Get inventory statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await InventoryItem.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] } },
          sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
          totalValue: { $sum: '$price' }
        }
      }
    ]);

    const inventoryStats = stats[0] || {
      total: 0,
      available: 0,
      outOfStock: 0,
      sold: 0,
      totalValue: 0
    };

    res.json({
      success: true,
      data: inventoryStats
    });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory stats',
      error: error.message
    });
  }
});

// GET /api/inventory/listing/:listingId - Get item by listing ID
router.get('/listing/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const item = await InventoryItem.findOne({ listingId });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item by listing ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item',
      error: error.message
    });
  }
});

// GET /api/inventory/search - Search items
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      const items = await InventoryItem.find().sort({ createdAt: -1 });
      return res.json({
        success: true,
        data: items
      });
    }

    const query = q.toLowerCase();
    const items = await InventoryItem.find({
      $or: [
        { produceName: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { 'wholesaler.businessName': { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error searching items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search items',
      error: error.message
    });
  }
});

// GET /api/inventory/category/:category - Get items by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const items = await InventoryItem.find({ 
      category: { $regex: category, $options: 'i' } 
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch items by category',
      error: error.message
    });
  }
});

// GET /api/inventory/wholesaler/:wholesalerId - Get items by wholesaler
router.get('/wholesaler/:wholesalerId', async (req, res) => {
  try {
    const { wholesalerId } = req.params;
    const items = await InventoryItem.find({ 
      'wholesaler.id': wholesalerId 
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items by wholesaler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch items by wholesaler',
      error: error.message
    });
  }
});

// POST /api/inventory - Add new item to inventory
router.post('/', async (req, res) => {
  try {
    const {
      listingId,
      produceName,
      description,
      price,
      images,
      category,
      quantity,
      wholesaler,
      deliveryOptions
    } = req.body;

    // Check if item already exists
    const existingItem = await InventoryItem.findOne({ listingId });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item already exists in inventory'
      });
    }

    const newItem = new InventoryItem({
      listingId,
      produceName,
      description,
      price,
      images: images || [],
      category: category || 'other',
      quantity: quantity || 1,
      status: 'available',
      wholesaler,
      deliveryOptions: deliveryOptions || {
        homeDelivery: false,
        pickupAvailable: true,
        deliveryCharges: 0
      }
    });

    await newItem.save();

    res.status(201).json({
      success: true,
      data: newItem,
      message: 'Item added to inventory successfully'
    });
  } catch (error) {
    console.error('Error adding item to inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to inventory',
      error: error.message
    });
  }
});

// PATCH /api/inventory/:itemId - Update item status
router.patch('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status, lastPurchasedBy } = req.body;

    // Try to find by MongoDB ObjectId first, then by custom ID
    let item;
    try {
      // First try as MongoDB ObjectId
      item = await InventoryItem.findById(itemId);
    } catch (objectIdError) {
      // If ObjectId fails, try to find by custom ID field
      item = await InventoryItem.findOne({ id: itemId });
    }
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Add to purchase history if being sold
    if (status === 'sold' && lastPurchasedBy) {
      item.purchaseHistory.push({
        purchasedBy: lastPurchasedBy,
        purchasedAt: new Date(),
        quantity: item.quantity,
        price: item.price
      });
    }

    item.status = status;
    if (lastPurchasedBy) {
      item.lastPurchasedBy = lastPurchasedBy;
    }

    await item.save();

    res.json({
      success: true,
      data: item,
      message: 'Item status updated successfully'
    });
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item status',
      error: error.message
    });
  }
});

// DELETE /api/inventory/:itemId - Remove item from inventory
router.delete('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await InventoryItem.findByIdAndDelete(itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      message: 'Item removed from inventory successfully'
    });
  } catch (error) {
    console.error('Error removing item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item',
      error: error.message
    });
  }
});

// POST /api/inventory/bulk-update - Bulk update multiple items
router.post('/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body; // Array of { itemId, status, lastPurchasedBy }
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    const updatedItems = [];
    for (const update of updates) {
      const item = await InventoryItem.findById(update.itemId);
      if (item) {
        // Add to purchase history if being sold
        if (update.status === 'sold' && update.lastPurchasedBy) {
          item.purchaseHistory.push({
            purchasedBy: update.lastPurchasedBy,
            purchasedAt: new Date(),
            quantity: item.quantity,
            price: item.price
          });
        }

        item.status = update.status;
        if (update.lastPurchasedBy) {
          item.lastPurchasedBy = update.lastPurchasedBy;
        }

        await item.save();
        updatedItems.push(item);
      }
    }

    res.json({
      success: true,
      data: updatedItems,
      message: `${updatedItems.length} items updated successfully`
    });
  } catch (error) {
    console.error('Error bulk updating items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update items',
      error: error.message
    });
  }
});

// POST /api/inventory/clear - Clear all inventory (for testing)
router.post('/clear', async (req, res) => {
  try {
    await InventoryItem.deleteMany({});
    
    res.json({
      success: true,
      message: 'Inventory cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear inventory',
      error: error.message
    });
  }
});

// GET /api/inventory/sales-data - Get sales data for charts
router.get('/sales-data', async (req, res) => {
  try {
    // Get all items with purchase history
    const items = await InventoryItem.find({
      'purchaseHistory.0': { $exists: true }
    });

    // Group sales by month for the last 12 months
    const monthlySales = {};
    const currentDate = new Date();
    
    // Initialize last 12 months with 0 sales
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toISOString().substring(0, 7); // YYYY-MM format
      monthlySales[monthKey] = 0;
    }

    // Process purchase history
    items.forEach(item => {
      item.purchaseHistory.forEach(purchase => {
        const purchaseDate = new Date(purchase.purchasedAt);
        const monthKey = purchaseDate.toISOString().substring(0, 7);
        
        if (monthlySales.hasOwnProperty(monthKey)) {
          monthlySales[monthKey] += purchase.quantity || 1;
        }
      });
    });

    // Convert to array format for chart
    const salesData = Object.keys(monthlySales).map(month => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      value: monthlySales[month]
    }));

    // Get total sales count
    const totalSales = Object.values(monthlySales).reduce((sum, count) => sum + count, 0);

    res.json({
      success: true,
      data: {
        monthlySales: salesData,
        totalSales: totalSales,
        totalTransactions: items.reduce((sum, item) => sum + item.purchaseHistory.length, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales data',
      error: error.message
    });
  }
});

module.exports = router;