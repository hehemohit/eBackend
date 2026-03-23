const { validationResult } = require('express-validator');
const Bid = require('../models/Bid');
const Produce = require('../models/Produce');
const Notification = require('../models/Notification');

// Create notification helper
const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    await Notification.create({
      user: userId,
      type,
      title,
      message,
      data
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Get user's bids
const getBids = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      produce,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { wholesaler: req.user._id };
    
    if (status) filter.status = status;
    if (produce) filter.produce = produce;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bids, total] = await Promise.all([
      Bid.find(filter)
        .populate('produce', 'name description category quantity unit basePrice images status auctionEndTime currentHighestBid')
        .populate('produce.farmer', 'name email phone')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Bid.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        bids,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single bid
const getBidById = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id)
      .populate('produce', 'name description category quantity unit basePrice images status auctionEndTime currentHighestBid')
      .populate('produce.farmer', 'name email phone')
      .populate('wholesaler', 'name email businessName');

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check ownership
    if (bid.wholesaler._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { bid }
    });
  } catch (error) {
    console.error('Get bid by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Place bid
const placeBid = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, message } = req.body;
    const produceId = req.params.produceId;

    // Check if produce exists and is in auction
    const produce = await Produce.findById(produceId);
    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    if (produce.status !== 'auction') {
      return res.status(400).json({
        success: false,
        message: 'Produce is not in auction'
      });
    }

    // Check if auction has ended
    if (produce.auctionEndTime && new Date() > produce.auctionEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Auction has ended'
      });
    }

    // Check if bid amount is higher than current highest bid
    if (amount <= produce.currentHighestBid) {
      return res.status(400).json({
        success: false,
        message: `Bid amount must be higher than current highest bid of ₹${produce.currentHighestBid}`
      });
    }

    // Check if user already has an active bid
    const existingBid = await Bid.findOne({
      wholesaler: req.user._id,
      produce: produceId,
      status: 'active'
    });

    if (existingBid) {
      // If user already has an active bid, update it instead of creating a new one
      if (amount <= existingBid.amount) {
        return res.status(400).json({
          success: false,
          message: `New bid amount must be higher than your current bid of ₹${existingBid.amount}`
        });
      }

      // Update the existing bid
      const updatedBid = await Bid.findByIdAndUpdate(
        existingBid._id,
        { amount, message },
        { new: true }
      );

      // Update produce with new highest bid
      await Produce.findByIdAndUpdate(produceId, {
        currentHighestBid: amount,
        currentHighestBidder: req.user._id
      });

      // Notify farmer about bid update
      await createNotification(
        produce.farmer,
        'bid_placed',
        'Bid updated on your produce',
        `${req.user.businessName || req.user.name} updated their bid to ₹${amount} on ${produce.name}`,
        { produceId, bidId: updatedBid._id, bidderId: req.user._id }
      );

      // Populate bid details
      await updatedBid.populate('produce', 'name description category quantity unit basePrice images status auctionEndTime currentHighestBid');
      await updatedBid.populate('produce.farmer', 'name email phone');

      // Emit real-time update to all connected clients
      const io = req.app.get('io');
      if (io) {
        io.emit('bid-updated', {
          produceId: produceId,
          currentHighestBid: amount,
          currentHighestBidder: req.user._id,
          bidderName: req.user.businessName || req.user.name,
          produceName: produce.name,
          timestamp: new Date()
        });
      }

      return res.json({
        success: true,
        message: 'Bid updated successfully',
        data: { bid: updatedBid }
      });
    }

    // Create bid
    const bid = await Bid.create({
      wholesaler: req.user._id,
      produce: produceId,
      amount,
      message
    });

    // Update produce with new highest bid
    await Produce.findByIdAndUpdate(produceId, {
      currentHighestBid: amount,
      currentHighestBidder: req.user._id
    });

    // Notify farmer about new bid
    await createNotification(
      produce.farmer,
      'bid_placed',
      'New bid placed on your produce',
      `${req.user.businessName || req.user.name} placed a bid of ₹${amount} on ${produce.name}`,
      { produceId, bidId: bid._id, bidderId: req.user._id }
    );

    // Populate bid details
    await bid.populate('produce', 'name description category quantity unit basePrice images status auctionEndTime currentHighestBid');
    await bid.populate('produce.farmer', 'name email phone');

    // Emit real-time update to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('bid-updated', {
        produceId: produceId,
        currentHighestBid: amount,
        currentHighestBidder: req.user._id,
        bidderName: req.user.businessName || req.user.name,
        produceName: produce.name,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Bid placed successfully',
      data: { bid }
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update bid
const updateBid = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, message } = req.body;

    const bid = await Bid.findById(req.params.id);
    
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check ownership
    if (bid.wholesaler.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if bid is active
    if (bid.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update inactive bid'
      });
    }

    // Check if produce is still in auction
    const produce = await Produce.findById(bid.produce);
    if (produce.status !== 'auction') {
      return res.status(400).json({
        success: false,
        message: 'Produce is not in auction'
      });
    }

    // Check if auction has ended
    if (produce.auctionEndTime && new Date() > produce.auctionEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Auction has ended'
      });
    }

    // Check if new amount is higher than current highest bid
    if (amount <= produce.currentHighestBid) {
      return res.status(400).json({
        success: false,
        message: `Bid amount must be higher than current highest bid of ₹${produce.currentHighestBid}`
      });
    }

    // Update bid
    const updatedBid = await Bid.findByIdAndUpdate(
      req.params.id,
      { amount, message },
      { new: true }
    );

    // Update produce with new highest bid
    await Produce.findByIdAndUpdate(bid.produce, {
      currentHighestBid: amount,
      currentHighestBidder: req.user._id
    });

    // Notify farmer about bid update
    await createNotification(
      produce.farmer,
      'bid_placed',
      'Bid updated on your produce',
      `${req.user.businessName || req.user.name} updated their bid to ₹${amount} on ${produce.name}`,
      { produceId: bid.produce, bidId: updatedBid._id, bidderId: req.user._id }
    );

    // Populate bid details
    await updatedBid.populate('produce', 'name description category quantity unit basePrice images status auctionEndTime currentHighestBid');
    await updatedBid.populate('produce.farmer', 'name email phone');

    res.json({
      success: true,
      message: 'Bid updated successfully',
      data: { bid: updatedBid }
    });
  } catch (error) {
    console.error('Update bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Cancel bid
const cancelBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id);
    
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check ownership
    if (bid.wholesaler.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if bid is active
    if (bid.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel inactive bid'
      });
    }

    // Update bid status
    await Bid.findByIdAndUpdate(req.params.id, { status: 'cancelled' });

    // Check if this was the highest bid and update produce accordingly
    const produce = await Produce.findById(bid.produce);
    if (produce.currentHighestBidder && produce.currentHighestBidder.toString() === req.user._id.toString()) {
      // Find the next highest bid
      const nextHighestBid = await Bid.findOne({
        produce: bid.produce,
        status: 'active',
        wholesaler: { $ne: req.user._id }
      }).sort({ amount: -1 });

      if (nextHighestBid) {
        await Produce.findByIdAndUpdate(bid.produce, {
          currentHighestBid: nextHighestBid.amount,
          currentHighestBidder: nextHighestBid.wholesaler
        });
      } else {
        await Produce.findByIdAndUpdate(bid.produce, {
          currentHighestBid: produce.basePrice,
          currentHighestBidder: null
        });
      }
    }

    res.json({
      success: true,
      message: 'Bid cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get bids for a specific produce (for farmers)
const getProduceBids = async (req, res) => {
  try {
    const produceId = req.params.produceId;

    // Check if produce exists and belongs to farmer
    const produce = await Produce.findById(produceId);
    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    if (produce.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const bids = await Bid.find({ produce: produceId })
      .populate('wholesaler', 'name email businessName phone')
      .sort({ amount: -1, createdAt: 1 });

    res.json({
      success: true,
      data: { bids }
    });
  } catch (error) {
    console.error('Get produce bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getBids,
  getBidById,
  placeBid,
  updateBid,
  cancelBid,
  getProduceBids
};
