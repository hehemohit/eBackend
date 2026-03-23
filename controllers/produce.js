const { validationResult } = require('express-validator');
const Produce = require('../models/Produce');
const Bid = require('../models/Bid');
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

// Get all produce with filtering
const getProduce = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      farmer,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (farmer === 'me') {
      filter.farmer = req.user._id;
    } else if (farmer) {
      filter.farmer = farmer;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [produce, total] = await Promise.all([
      Produce.find(filter)
        .populate('farmer', 'name email phone')
        .populate('currentHighestBidder', 'name businessName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Produce.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        produce,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get produce error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single produce
const getProduceById = async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id)
      .populate('farmer', 'name email phone address')
      .populate('currentHighestBidder', 'name businessName');

    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    res.json({
      success: true,
      data: { produce }
    });
  } catch (error) {
    console.error('Get produce by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create produce listing
const createProduce = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const produceData = {
      ...req.body,
      farmer: req.user._id
    };

    const produce = await Produce.create(produceData);

    // Populate farmer details
    await produce.populate('farmer', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Produce listed successfully',
      data: { produce }
    });
  } catch (error) {
    console.error('Create produce error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update produce
const updateProduce = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const produce = await Produce.findById(req.params.id);
    
    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    // Check ownership
    if (produce.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow updates if auction has started
    if (produce.status === 'auction' || produce.status === 'auction_ended') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update produce during or after auction'
      });
    }

    const updatedProduce = await Produce.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('farmer', 'name email phone');

    res.json({
      success: true,
      message: 'Produce updated successfully',
      data: { produce: updatedProduce }
    });
  } catch (error) {
    console.error('Update produce error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete produce
const deleteProduce = async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    
    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    // Check ownership
    if (produce.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow deletion if auction has started
    if (produce.status === 'auction' || produce.status === 'auction_ended') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete produce during or after auction'
      });
    }

    await Produce.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Produce deleted successfully'
    });
  } catch (error) {
    console.error('Delete produce error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Start auction
const startAuction = async (req, res) => {
  try {
    const { auctionDuration = 24 } = req.body; // Duration in hours

    const produce = await Produce.findById(req.params.id);
    
    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    // Check ownership
    if (produce.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if auction can be started
    if (produce.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Auction can only be started for available produce'
      });
    }

    const auctionEndTime = new Date(Date.now() + auctionDuration * 60 * 60 * 1000);

    const updatedProduce = await Produce.findByIdAndUpdate(
      req.params.id,
      {
        status: 'auction',
        auctionEndTime,
        currentHighestBid: produce.basePrice
      },
      { new: true }
    ).populate('farmer', 'name email phone');

    res.json({
      success: true,
      message: 'Auction started successfully',
      data: { produce: updatedProduce }
    });
  } catch (error) {
    console.error('Start auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// End auction
const endAuction = async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    
    if (!produce) {
      return res.status(404).json({
        success: false,
        message: 'Produce not found'
      });
    }

    // Check ownership
    if (produce.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if auction is active
    if (produce.status !== 'auction') {
      return res.status(400).json({
        success: false,
        message: 'Auction is not active'
      });
    }

    // Find the winning bid
    const winningBid = await Bid.findOne({
      produce: produce._id,
      amount: produce.currentHighestBid,
      status: 'active'
    }).populate('wholesaler', 'name email businessName');

    // Update produce status
    const updatedProduce = await Produce.findByIdAndUpdate(
      req.params.id,
      { status: 'auction_ended' },
      { new: true }
    ).populate('farmer', 'name email phone');

    // Update all bids status
    if (winningBid) {
      // Mark winning bid as won
      await Bid.findByIdAndUpdate(winningBid._id, { status: 'won' });
      
      // Mark all other bids as lost
      await Bid.updateMany(
        {
          produce: produce._id,
          _id: { $ne: winningBid._id },
          status: 'active'
        },
        { status: 'lost' }
      );

      // Create ticket for communication between farmer and winning wholesaler
      const Ticket = require('../models/Ticket');
      const existingTicket = await Ticket.findOne({
        produce: produce._id,
        winningBid: winningBid._id
      });

      if (!existingTicket) {
        const ticket = new Ticket({
          produce: produce._id,
          farmer: produce.farmer,
          wholesaler: winningBid.wholesaler._id,
          winningBid: winningBid._id,
          status: 'active',
          messages: [],
          deliveryDetails: {},
          paymentDetails: {
            method: 'cash',
            amount: winningBid.amount,
            status: 'pending'
          }
        });

        await ticket.save();

        // Emit ticket creation to both users
        const io = req.app.get('io');
        if (io) {
          io.to(`user-${produce.farmer}`).emit('new-ticket', {
            ticketId: ticket._id,
            produceName: produce.name,
            wholesalerName: winningBid.wholesaler.businessName || winningBid.wholesaler.name
          });

          io.to(`user-${winningBid.wholesaler._id}`).emit('new-ticket', {
            ticketId: ticket._id,
            produceName: produce.name,
            farmerName: produce.farmer.name
          });
        }
      }

      // Notify winner
      await createNotification(
        winningBid.wholesaler._id,
        'bid_won',
        'Congratulations! You won the auction',
        `You won the auction for ${produce.name} with a bid of ₹${winningBid.amount}. A chat ticket has been created for communication.`,
        { produceId: produce._id, bidId: winningBid._id }
      );

      // Notify farmer
      await createNotification(
        produce.farmer,
        'auction_ended',
        'Auction ended successfully',
        `Your auction for ${produce.name} ended. Winner: ${winningBid.wholesaler.name}. A chat ticket has been created for communication.`,
        { produceId: produce._id, winnerId: winningBid.wholesaler._id }
      );
    } else {
      // No bids - notify farmer
      await createNotification(
        produce.farmer,
        'auction_ended',
        'Auction ended with no bids',
        `Your auction for ${produce.name} ended with no bids.`,
        { produceId: produce._id }
      );
    }

    res.json({
      success: true,
      message: 'Auction ended successfully',
      data: { 
        produce: updatedProduce,
        winner: winningBid ? {
          id: winningBid.wholesaler._id,
          name: winningBid.wholesaler.name,
          businessName: winningBid.wholesaler.businessName,
          winningAmount: winningBid.amount
        } : null
      }
    });
  } catch (error) {
    console.error('End auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Auto-end expired auctions
const autoEndExpiredAuctions = async () => {
  try {
    const now = new Date();
    
    // Find all active auctions that have expired
    const expiredAuctions = await Produce.find({
      status: 'auction',
      auctionEndTime: { $lt: now }
    }).populate('farmer', 'name email');

    console.log(`Found ${expiredAuctions.length} expired auctions to process`);

    for (const produce of expiredAuctions) {
      try {
        // Find the winning bid
        const winningBid = await Bid.findOne({
          produce: produce._id,
          amount: produce.currentHighestBid,
          status: 'active'
        }).populate('wholesaler', 'name email businessName');

        // Update produce status
        await Produce.findByIdAndUpdate(produce._id, { status: 'auction_ended' });

        // Update all bids status
        if (winningBid) {
          // Mark winning bid as won
          await Bid.findByIdAndUpdate(winningBid._id, { status: 'won' });
          
          // Mark all other bids as lost
          await Bid.updateMany(
            {
              produce: produce._id,
              _id: { $ne: winningBid._id },
              status: 'active'
            },
            { status: 'lost' }
          );

          // Create ticket for communication between farmer and winning wholesaler
          const Ticket = require('../models/Ticket');
          const existingTicket = await Ticket.findOne({
            produce: produce._id,
            winningBid: winningBid._id
          });

          if (!existingTicket) {
            const ticket = new Ticket({
              produce: produce._id,
              farmer: produce.farmer._id,
              wholesaler: winningBid.wholesaler._id,
              winningBid: winningBid._id,
              status: 'active',
              messages: [],
              deliveryDetails: {},
              paymentDetails: {
                method: 'cash',
                amount: winningBid.amount,
                status: 'pending'
              }
            });

            await ticket.save();
            console.log(`Created ticket ${ticket._id} for expired auction ${produce.name}`);
          }

          // Notify winner
          await createNotification(
            winningBid.wholesaler._id,
            'bid_won',
            'Congratulations! You won the auction',
            `You won the auction for ${produce.name} with a bid of ₹${winningBid.amount}. A chat ticket has been created for communication.`,
            { produceId: produce._id, bidId: winningBid._id }
          );

          // Notify farmer
          await createNotification(
            produce.farmer._id,
            'auction_ended',
            'Auction ended automatically',
            `Your auction for ${produce.name} ended automatically. Winner: ${winningBid.wholesaler.name}. A chat ticket has been created for communication.`,
            { produceId: produce._id, winnerId: winningBid.wholesaler._id }
          );

          console.log(`Auto-ended auction ${produce.name} with winner ${winningBid.wholesaler.name}`);
        } else {
          // No bids - notify farmer
          await createNotification(
            produce.farmer._id,
            'auction_ended',
            'Auction ended with no bids',
            `Your auction for ${produce.name} ended automatically with no bids.`,
            { produceId: produce._id }
          );

          console.log(`Auto-ended auction ${produce.name} with no bids`);
        }
      } catch (error) {
        console.error(`Error auto-ending auction ${produce._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in autoEndExpiredAuctions:', error);
  }
};

module.exports = {
  getProduce,
  getProduceById,
  createProduce,
  updateProduce,
  deleteProduce,
  startAuction,
  endAuction,
  autoEndExpiredAuctions
};
