const { validationResult } = require('express-validator');
const User = require('../models/User');
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

// Get verification statistics
const getVerificationStats = async (req, res) => {
  try {
    const [
      totalFarmers,
      totalWholesalers,
      totalCustomers,
      verifiedWholesalers,
      unverifiedWholesalers,
      totalProduce,
      activeAuctions
    ] = await Promise.all([
      User.countDocuments({ role: 'farmer', isActive: true }),
      User.countDocuments({ role: 'wholesaler', isActive: true }),
      User.countDocuments({ role: 'customer', isActive: true }),
      User.countDocuments({ role: 'wholesaler', isVerified: true, isActive: true }),
      User.countDocuments({ role: 'wholesaler', isVerified: false, isActive: true }),
      require('../models/Produce').countDocuments({ status: { $in: ['available', 'auction'] } }),
      require('../models/Produce').countDocuments({ status: 'auction' })
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalFarmers,
          totalWholesalers,
          totalCustomers,
          verifiedWholesalers,
          unverifiedWholesalers,
          totalProduce,
          activeAuctions
        }
      }
    });
  } catch (error) {
    console.error('Get verification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get unverified wholesalers
const getUnverifiedWholesalers = async (req, res) => {
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

    const [wholesalers, total] = await Promise.all([
      User.find({ 
        role: 'wholesaler', 
        isVerified: false, 
        isActive: true 
      })
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments({ 
        role: 'wholesaler', 
        isVerified: false, 
        isActive: true 
      })
    ]);

    res.json({
      success: true,
      data: {
        wholesalers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get unverified wholesalers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get verified wholesalers
const getVerifiedWholesalers = async (req, res) => {
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

    const [wholesalers, total] = await Promise.all([
      User.find({ 
        role: 'wholesaler', 
        isVerified: true, 
        isActive: true 
      })
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments({ 
        role: 'wholesaler', 
        isVerified: true, 
        isActive: true 
      })
    ]);

    res.json({
      success: true,
      data: {
        wholesalers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get verified wholesalers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify wholesaler
const verifyWholesaler = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const wholesalerId = req.params.id;

    const wholesaler = await User.findById(wholesalerId);
    
    if (!wholesaler) {
      return res.status(404).json({
        success: false,
        message: 'Wholesaler not found'
      });
    }

    if (wholesaler.role !== 'wholesaler') {
      return res.status(400).json({
        success: false,
        message: 'User is not a wholesaler'
      });
    }

    if (action === 'approve') {
      await User.findByIdAndUpdate(wholesalerId, { isVerified: true });
      
      // Notify wholesaler
      await createNotification(
        wholesalerId,
        'wholesaler_verified',
        'Account verified successfully',
        'Your wholesaler account has been verified. You can now participate in auctions.',
        { verifiedBy: req.user._id }
      );

      res.json({
        success: true,
        message: 'Wholesaler verified successfully',
        data: { wholesaler: { ...wholesaler.toObject(), isVerified: true } }
      });
    } else if (action === 'reject') {
      // Optionally deactivate the account or just leave it unverified
      await User.findByIdAndUpdate(wholesalerId, { isActive: false });
      
      // Notify wholesaler
      await createNotification(
        wholesalerId,
        'wholesaler_rejected',
        'Account verification rejected',
        `Your wholesaler account verification was rejected. Reason: ${reason || 'Please contact support for more information.'}`,
        { rejectedBy: req.user._id, reason }
      );

      res.json({
        success: true,
        message: 'Wholesaler verification rejected',
        data: { wholesaler: { ...wholesaler.toObject(), isActive: false } }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }
  } catch (error) {
    console.error('Verify wholesaler error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get wholesaler details for verification
const getWholesalerDetails = async (req, res) => {
  try {
    const wholesaler = await User.findById(req.params.id).select('-password');
    
    if (!wholesaler) {
      return res.status(404).json({
        success: false,
        message: 'Wholesaler not found'
      });
    }

    if (wholesaler.role !== 'wholesaler') {
      return res.status(400).json({
        success: false,
        message: 'User is not a wholesaler'
      });
    }

    res.json({
      success: true,
      data: { wholesaler }
    });
  } catch (error) {
    console.error('Get wholesaler details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all users for panchayat dashboard
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isVerified,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (role) filter.role = role;
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getVerificationStats,
  getUnverifiedWholesalers,
  getVerifiedWholesalers,
  verifyWholesaler,
  getWholesalerDetails,
  getAllUsers
};
