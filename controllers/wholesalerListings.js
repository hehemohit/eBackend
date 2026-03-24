const { validationResult } = require('express-validator');
const WholesalerListing = require('../models/WholesalerListing');
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

// Get wholesaler listings (for customers)
const getWholesalerListings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      wholesaler,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { status: 'available' };
    
    if (category) filter.category = category;
    if (wholesaler) filter.wholesaler = wholesaler;
    
    if (search) {
      filter.$or = [
        { produceName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [listings, total] = await Promise.all([
      WholesalerListing.find(filter)
        .populate('wholesaler', 'name businessName email phone')
        .populate('originalBid', 'amount')
        .populate('originalProduce', 'name description category')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      WholesalerListing.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        listings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get wholesaler listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single listing
const getListingById = async (req, res) => {
  try {
    const listing = await WholesalerListing.findById(req.params.id)
      .populate('wholesaler', 'name businessName email phone address')
      .populate('originalBid', 'amount')
      .populate('originalProduce', 'name description category harvestDate qualityGrade isOrganic');

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    res.json({
      success: true,
      data: { listing }
    });
  } catch (error) {
    console.error('Get listing by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create listing from won bid
const createListing = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { bidId, markupPercentage, description, deliveryOptions } = req.body;

    // Find the won bid
    const bid = await Bid.findById(bidId)
      .populate('produce')
      .populate('wholesaler', 'name businessName');

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check if bid belongs to user and is won
    if (bid.wholesaler._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (bid.status !== 'won') {
      return res.status(400).json({
        success: false,
        message: 'Can only create listings from won bids'
      });
    }

    // Check if listing already exists for this bid
    const existingListing = await WholesalerListing.findOne({ originalBid: bidId });
    if (existingListing) {
      return res.status(400).json({
        success: false,
        message: 'Listing already exists for this bid'
      });
    }

    // Calculate price with markup
    const markupAmount = (bid.amount * markupPercentage) / 100;
    const finalPrice = bid.amount + markupAmount;

    // Create listing
    const listing = await WholesalerListing.create({
      wholesaler: req.user._id,
      originalBid: bidId,
      originalProduce: bid.produce._id,
      produceName: bid.produce.name,
      description: description || bid.produce.description,
      category: bid.produce.category,
      quantity: bid.produce.quantity,
      unit: bid.produce.unit,
      price: finalPrice,
      images: bid.produce.images,
      markupPercentage,
      originalBidAmount: bid.amount,
      location: req.user.address,
      availableQuantity: bid.produce.quantity,
      qualityGrade: bid.produce.qualityGrade,
      isOrganic: bid.produce.isOrganic,
      deliveryOptions: deliveryOptions || {
        homeDelivery: false,
        pickupAvailable: true,
        deliveryCharges: 0
      }
    });

    // Populate listing details
    await listing.populate('wholesaler', 'name businessName email phone');
    await listing.populate('originalBid', 'amount');
    await listing.populate('originalProduce', 'name description category');

    // Add to centralized inventory directly
    try {
      const InventoryItem = require('../models/InventoryItem');
      
      const existingInvItem = await InventoryItem.findOne({ listingId: listing._id });
      if (!existingInvItem) {
        const invItem = new InventoryItem({
          listingId: listing._id,
          produceName: listing.produceName,
          description: listing.description || bid.produce.description || '',
          price: listing.price,
          images: listing.images || [],
          category: listing.category || 'other',
          quantity: listing.quantity || 1,
          status: 'available',
          wholesaler: {
            id: listing.wholesaler._id,
            name: listing.wholesaler.name,
            businessName: listing.wholesaler.businessName,
            email: listing.wholesaler.email,
            phone: listing.wholesaler.phone
          },
          deliveryOptions: listing.deliveryOptions
        });
        await invItem.save();
        console.log('✅ Added listing to centralized inventory directly:', listing.produceName);
      }
    } catch (error) {
      console.error('Error adding listing to centralized inventory:', error);
      // Don't fail the listing creation if inventory sync fails
    }

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: { listing }
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update listing
const updateListing = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const listing = await WholesalerListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check ownership
    if (listing.wholesaler.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow updates if sold
    if (listing.status === 'sold') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update sold listing'
      });
    }

    const updatedListing = await WholesalerListing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('wholesaler', 'name businessName email phone')
      .populate('originalBid', 'amount')
      .populate('originalProduce', 'name description category');

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: { listing: updatedListing }
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete listing
const deleteListing = async (req, res) => {
  try {
    const listing = await WholesalerListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check ownership
    if (listing.wholesaler.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow deletion if sold
    if (listing.status === 'sold') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete sold listing'
      });
    }

    await WholesalerListing.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get wholesaler's own listings
const getMyListings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { wholesaler: req.user._id };
    
    if (status) filter.status = status;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [listings, total] = await Promise.all([
      WholesalerListing.find(filter)
        .populate('originalBid', 'amount')
        .populate('originalProduce', 'name description category')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      WholesalerListing.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        listings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get won bids for creating listings
const getWonBids = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bids, total] = await Promise.all([
      Bid.find({ 
        wholesaler: req.user._id, 
        status: 'won' 
      })
        .populate('produce', 'name description category quantity unit basePrice images harvestDate qualityGrade isOrganic')
        .populate('produce.farmer', 'name email phone')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Bid.countDocuments({ 
        wholesaler: req.user._id, 
        status: 'won' 
      })
    ]);

    // Check which bids already have listings
    const bidsWithListingStatus = await Promise.all(
      bids.map(async (bid) => {
        const existingListing = await WholesalerListing.findOne({ originalBid: bid._id });
        return {
          ...bid.toObject(),
          hasListing: !!existingListing,
          listingId: existingListing?._id
        };
      })
    );

    res.json({
      success: true,
      data: {
        bids: bidsWithListingStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get won bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getWholesalerListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
  getWonBids
};
