const mongoose = require('mongoose');
const Goods = require('./server');

mongoose.connect('mongodb://localhost:27017/babies', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Failed to connect to MongoDB:', error);
    });

const goodsId = '6478018c2a9cb687f1787b6a'; // Replace with the ID of the goods you want to update
const updatedFields = {
    name: 'Updated Goods Name',
    price: 9.99,
    description: 'Updated goods description',
    category: 'Updated category',
    quantity: 100,
    image: 'path/to/updated-image.jpg',
};

Goods.findByIdAndUpdate(goodsId, updatedFields, { new: true })
    .then((updatedGoods) => {
        if (!updatedGoods) {
            console.log('Goods not found');
        } else {
            console.log('Updated goods:', updatedGoods);
        }
    })
    .catch((error) => {
        console.error('Failed to update goods:', error);
    })
    .finally(() => {
        mongoose.disconnect();
    });
