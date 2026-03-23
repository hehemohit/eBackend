const Ticket = require('../models/Ticket');
const Produce = require('../models/Produce');
const Bid = require('../models/Bid');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all tickets for a user
const getTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;

    let filter = {};
    if (userRole === 'farmer') {
      filter.farmer = userId;
    } else if (userRole === 'wholesaler') {
      filter.wholesaler = userId;
    }

    if (status) {
      filter.status = status;
    }

    const tickets = await Ticket.find(filter)
      .populate('produce', 'name description category quantity unit basePrice images')
      .populate('farmer', 'name email phone businessName')
      .populate('wholesaler', 'name email phone businessName')
      .populate('winningBid', 'amount createdAt')
      .sort({ lastMessageAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Ticket.countDocuments(filter);

    res.json({
      success: true,
      data: {
        tickets,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get a specific ticket with messages
const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const ticket = await Ticket.findById(ticketId)
      .populate('produce', 'name description category quantity unit basePrice images')
      .populate('farmer', 'name email phone businessName')
      .populate('wholesaler', 'name email phone businessName')
      .populate('winningBid', 'amount createdAt');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user has access to this ticket
    if (userRole === 'farmer' && ticket.farmer._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (userRole === 'wholesaler' && ticket.wholesaler._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Mark messages as read for the current user
    ticket.messages.forEach(message => {
      if (message.sender._id.toString() !== userId.toString()) {
        message.isRead = true;
      }
    });
    await ticket.save();

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Send a message in a ticket
const sendMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    const ticket = await Ticket.findById(ticketId)
      .populate('farmer', 'name businessName')
      .populate('wholesaler', 'name businessName');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user has access to this ticket
    if (userRole === 'farmer' && ticket.farmer._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (userRole === 'wholesaler' && ticket.wholesaler._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add message to ticket
    const newMessage = {
      sender: userId,
      senderName: userRole === 'farmer' ? ticket.farmer.name : ticket.wholesaler.name,
      senderRole: userRole,
      message: message.trim(),
      timestamp: new Date(),
      isRead: false
    };

    ticket.messages.push(newMessage);
    ticket.lastMessageAt = new Date();
    await ticket.save();

    // Emit real-time message to all users in the ticket room for real-time chat
    const io = req.app.get('io');
    if (io) {
      // Broadcast to the ticket room so both users see the message immediately
      io.to(`ticket-${ticket._id}`).emit('new-message', {
        ticketId: ticket._id,
        message: newMessage,
        senderName: newMessage.senderName,
        senderRole: newMessage.senderRole
      });
      
      // Also send to the other user's personal room for notifications
      const recipientId = userRole === 'farmer' ? ticket.wholesaler._id : ticket.farmer._id;
      io.to(`user-${recipientId}`).emit('new-message', {
        ticketId: ticket._id,
        message: newMessage,
        senderName: newMessage.senderName,
        senderRole: newMessage.senderRole
      });
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { message: newMessage }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update ticket status
const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, deliveryDetails, paymentDetails } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user has access to this ticket
    if (userRole === 'farmer' && ticket.farmer.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (userRole === 'wholesaler' && ticket.wholesaler.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update ticket
    if (status) {
      ticket.status = status;
      if (status === 'completed') {
        ticket.completedAt = new Date();
      }
    }

    if (deliveryDetails) {
      ticket.deliveryDetails = { ...ticket.deliveryDetails, ...deliveryDetails };
    }

    if (paymentDetails) {
      ticket.paymentDetails = { ...ticket.paymentDetails, ...paymentDetails };
    }

    await ticket.save();

    // Emit status update to both users
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${ticket.farmer}`).emit('ticket-status-updated', {
        ticketId: ticket._id,
        status: ticket.status
      });

      io.to(`user-${ticket.wholesaler}`).emit('ticket-status-updated', {
        ticketId: ticket._id,
        status: ticket.status
      });
    }

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create a ticket when auction ends
const createTicket = async (req, res) => {
  try {
    const { produceId, winningBidId } = req.body;

    const produce = await Produce.findById(produceId);
    const winningBid = await Bid.findById(winningBidId).populate('wholesaler');

    if (!produce || !winningBid) {
      return res.status(404).json({
        success: false,
        message: 'Produce or bid not found'
      });
    }

    // Check if ticket already exists
    const existingTicket = await Ticket.findOne({
      produce: produceId,
      winningBid: winningBidId
    });

    if (existingTicket) {
      return res.status(400).json({
        success: false,
        message: 'Ticket already exists for this auction'
      });
    }

    // Create new ticket
    const ticket = new Ticket({
      produce: produceId,
      farmer: produce.farmer,
      wholesaler: winningBid.wholesaler._id,
      winningBid: winningBidId,
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

    // Populate the ticket for response
    await ticket.populate([
      { path: 'produce', select: 'name description category quantity unit basePrice images' },
      { path: 'farmer', select: 'name email phone businessName' },
      { path: 'wholesaler', select: 'name email phone businessName' },
      { path: 'winningBid', select: 'amount createdAt' }
    ]);

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

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mark payment as done for a ticket
const markPaymentDone = async (req, res) => {
  try {
    console.log('Payment done request body:', req.body);
    console.log('Payment done request params:', req.params);
    console.log('User ID:', req.user._id);

    const { ticketId } = req.params;
    const { amount, farmerId, wholesalerId, produceId } = req.body;
    const userId = req.user._id;

    // Verify the user is the farmer for this ticket
    const ticket = await Ticket.findById(ticketId)
      .populate('farmer', '_id name email')
      .populate('wholesaler', '_id name email businessName')
      .populate('produce', 'name description category quantity unit basePrice');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if the user is the farmer for this ticket
    if (ticket.farmer._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only the farmer can mark payment as done'
      });
    }

    // Check if payment is already completed
    if (ticket.paymentCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been marked as completed for this ticket'
      });
    }

    // Update the ticket with payment completion
    ticket.paymentCompleted = true;
    ticket.paymentCompletedAt = new Date();
    ticket.status = 'payment_completed';
    await ticket.save();

    // Update the produce status to sold
    try {
      await Produce.findByIdAndUpdate(produceId, {
        status: 'sold',
        paymentCompleted: true,
        paymentCompletedAt: new Date()
      });
    } catch (produceError) {
      console.error('Error updating produce status:', produceError);
      // Continue with payment processing even if produce update fails
    }

    // Update farmer's earnings
    try {
      await User.findByIdAndUpdate(farmerId, {
        $inc: { totalEarnings: amount }
      });
    } catch (earningsError) {
      console.error('Error updating farmer earnings:', earningsError);
      // Continue with payment processing even if earnings update fails
    }

    // Create a notification for the wholesaler
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        user: wholesalerId,
        type: 'payment_confirmed',
        title: 'Payment Confirmed',
        message: `Payment of ₹${amount} has been confirmed by ${ticket.farmer.name} for ${ticket.produce.name}`,
        data: {
          ticketId: ticket._id,
          amount: amount,
          farmerName: ticket.farmer.name,
          produceName: ticket.produce.name
        }
      });
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Continue with payment processing even if notification creation fails
    }

    res.status(200).json({
      success: true,
      message: 'Payment marked as completed successfully',
      data: {
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          paymentCompleted: ticket.paymentCompleted,
          paymentCompletedAt: ticket.paymentCompletedAt
        },
        amount: amount,
        farmerEarnings: amount
      }
    });

  } catch (error) {
    console.error('Mark payment done error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getTickets,
  getTicket,
  sendMessage,
  updateTicketStatus,
  createTicket,
  markPaymentDone
};
