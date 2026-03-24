const mongoose = require('mongoose');
require('dotenv').config();

const { MONGODB_URI } = process.env;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
  console.log('Connected to MongoDB');
  require('./models/User');
  require('./models/Produce');
  require('./models/Bid');
  const WholesalerListing = require('./models/WholesalerListing');
  const InventoryItem = require('./models/InventoryItem');
  
  const listings = await WholesalerListing.find().populate('wholesaler');
  for (const l of listings) {
    console.log(`\nListing: ${l.produceName}`);
    try {
      const invItem = new InventoryItem({
        listingId: l._id.toString(),
        produceName: l.produceName,
        description: l.description || '',
        price: l.price,
        images: l.images || [],
        category: l.category || 'other',
        quantity: l.quantity || 1,
        status: 'available',
        wholesaler: {
          id: l.wholesaler ? l.wholesaler._id.toString() : 'missing',
          name: l.wholesaler ? l.wholesaler.name : 'missing',
          businessName: l.wholesaler ? l.wholesaler.businessName : 'missing',
          email: l.wholesaler ? l.wholesaler.email : 'missing',
          phone: l.wholesaler ? l.wholesaler.phone : 'missing'
        },
        deliveryOptions: l.deliveryOptions
      });
      await invItem.validate();
      console.log('Validation passed!');
    } catch (e) {
      console.error('Validation failed!', e.message);
    }
  }
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
