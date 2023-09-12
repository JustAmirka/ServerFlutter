const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const app = express(); // Move the initialization of 'app' here
const googleAuth = require('./googleAuth'); // Import the file created in the previous step

app.use(express.json());

// Rest of your code...

// Enable sessions
app.use(
    session({
        secret: 'YOUR_SESSION_SECRET',
        resave: false,
        saveUninitialized: true,
    })
);

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Define the Google OAuth2 routes
app.get(
    '/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'], // Adjust the scope as needed
    })
);

app.get(
    '/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: '/success', // Redirect URL after successful authentication
        failureRedirect: '/failure', // Redirect URL after failed authentication
    })
);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/babies', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error('Failed to connect to MongoDB:', error));

const goodsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    image: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Goods = mongoose.model('Goods', goodsSchema);

const cartSchema = new mongoose.Schema({
    goods: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goods',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const favoriteSchema = new mongoose.Schema({
    goods: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goods',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    cart: [cartSchema],
    favorites: [favoriteSchema],
});

const Cart = mongoose.model('Cart', cartSchema);
const Favorite = mongoose.model('Favorite', favoriteSchema);
const User = mongoose.model('User', userSchema);

// Rest of your code...
// Checkout route
app.post('/checkout', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        // Find the user by ID
        const user = await User.findById(userId).populate('cart.goods');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate the total price of the goods in the user's cart
        let totalPrice = 0;
        user.cart.forEach(item => {
            totalPrice += item.goods.price * item.quantity;
        });

        // Perform the payment process here...
        // You can use a payment gateway or any other payment method

        // Clear the user's cart after successful payment
        user.cart = [];
        await user.save();

        res.json({ message: 'Checkout successful', totalPrice });
    } catch (error) {
        console.error('Checkout failed:', error);
        res.status(500).json({ error: 'Checkout failed' });
    }
});

// Add to favorites
app.post('/addFavorite', authenticateToken, async (req, res) => {
    const { goodsId } = req.body;
    const userId = req.user.userId;

    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find the goods by ID
        const goods = await Goods.findById(goodsId);
        if (!goods) {
            return res.status(404).json({ error: 'Goods not found' });
        }

        // Check if the goods already exist in the user's favorites
        const existingFavorite = await Favorite.findOne({ user: userId, goods: goodsId });
        if (existingFavorite) {
            return res.status(400).json({ error: 'Goods already in favorites' });
        }

        // Create a new favorite and save it
        const favorite = new Favorite({ user: userId, goods: goodsId });
        await favorite.save();

        res.json({ message: 'Goods added to favorites successfully' });
    } catch (error) {
        console.error('Failed to get favorite:', error);
        res.status(500).json({ error: 'Failed to get favorite' });
    }
});

// Remove from favorites
app.post('/removeFavorite', authenticateToken, async (req, res) => {
    const { goodsId } = req.body;
    const userId = req.user.userId;
    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find the favorite by user ID and goods ID
        const favorite = await Favorite.findOne({ user: userId, goods: goodsId });
        if (!favorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        // Remove the favorite
        await favorite.remove();

        res.json({ message: 'Goods removed from favorites successfully' });
    } catch (error) {
        console.error('Failed to remove goods from favorites:', error);
        res.status(500).json({ error: 'Failed to remove goods from favorites' });
    }
});

app.get('/getFavorite', authenticateToken, async (req, res) => {
    try {
        // Retrieve the user ID from the authenticated token
        const userId = req.user.userId;

        // Find the user by ID and populate the favorites field
        const user = await User.findById(userId).populate('favorites.goods');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the user's favorites data
        res.json({ favorites: user.favorites });
    } catch (error) {
        console.error('Failed to get favorites:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

// Get the user's cart
app.get('/getCart', authenticateToken, async (req, res) => {
    try {
        // Retrieve the user ID from the authenticated token
        const userId = req.user.userId;

        // Find the user by ID
        const user = await User.findById(userId).populate('cart.goods');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the user's cart data
        res.json({ cart: user.cart });
    } catch (error) {
        console.error('Failed to get cart:', error);
        res.status(500).json({ error: 'Failed to get cart' });
    }
});

// Register endpoint
app.post('/register', async (req, res) => {
    const { email, password, firstname, lastname, address, phone, role } = req.body; // Add 'role' to the destructuring

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const user = new User({ email, password: hashedPassword, firstname, lastname, address, phone, role }); // Add 'role' to the user creation
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Failed to register user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});


// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check the password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate a JWT token
        const token = jwt.sign({ userId: user._id }, 'secret-key');

        // Redirect based on the user's role
        if (user.role === 'admin') {
            res.json({ token, redirectTo: '/admin' });
        } else {
            res.json({ token, redirectTo: '/' });
        }
    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});


app.get('/getAccount', authenticateToken, async (req, res) => {
    try {
        // Retrieve the user ID from the authenticated token
        const userId = req.user.userId;

        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the user account data
        const accountData = {
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            address: user.address,
            phone: user.phone
        };

        res.json({ account: accountData });
    } catch (error) {
        console.error('Failed to get account data:', error);
        res.status(500).json({ error: 'Failed to get account data' });
    }
});

// Remove from cart
app.post('/removeFromCart', authenticateToken, async (req, res) => {
    const { goodsId } = req.body;
    const userId = req.user.userId;

    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find the index of the goods in the user's cart
        const index = user.cart.findIndex(item => item.goods.toString() === goodsId);
        if (index === -1) {
            return res.status(404).json({ error: 'Goods not found in cart' });
        }

        // Remove the goods from the user's cart
        user.cart.splice(index, 1);
        await user.save();

        res.json({ message: 'Goods removed from cart successfully' });
    } catch (error) {
        console.error('Failed to remove goods from cart:', error);
        res.status(500).json({ error: 'Failed to remove goods from cart' });
    }
});
app.post('/updateCart', authenticateToken, async (req, res) => {
    const { goodsId, quantity } = req.body;
    const userId = req.user.userId;

    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find the goods by ID
        const goods = await Goods.findById(goodsId);
        if (!goods) {
            return res.status(404).json({ error: 'Goods not found' });
        }

        // Check if the requested quantity is available in stock
        if (quantity > goods.quantity) {
            return res.status(400).json({ error: 'Insufficient quantity available' });
        }

        // Find the cart item in the user's cart
        const cartItem = user.cart.find(item => item.goods.toString() === goodsId);
        if (!cartItem) {
            return res.status(404).json({ error: 'Goods not found in cart' });
        }

        // Update the quantity of the cart item
        cartItem.quantity = quantity;

        // Save the updated cart
        await user.save();

        res.json({ message: 'Cart updated successfully' });
    } catch (error) {
        console.error('Failed to update cart:', error);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});

// Add to cart
// Add to cart
// Add to cart
app.post('/addToCart', authenticateToken, async (req, res) => {
    const { goodsId, quantity } = req.body;
    const userId = req.user.userId;

    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find the goods by ID
        const goods = await Goods.findById(goodsId);
        if (!goods) {
            return res.status(404).json({ error: 'Goods not found' });
        }

        // Check if the requested quantity is available
        if (quantity > goods.quantity) {
            return res.status(400).json({ error: 'Insufficient quantity available' });
        }

        // Initialize user.cart if it's undefined
        if (!user.cart) {
            user.cart = [];
        }

        // Check if the goods already exist in the user's cart
        const existingCartItemIndex = user.cart.findIndex(item => item.goods.toString() === goodsId);
        if (existingCartItemIndex !== -1) {
            // Update the quantity if the goods already exist in the cart
            user.cart[existingCartItemIndex].quantity += quantity;
        } else {
            // Add the goods to the user's cart
            user.cart.push({ goods: goodsId, quantity });
        }

        // Save the updated cart
        await user.save();

        res.json({ message: 'Goods added to cart successfully' });
    } catch (error) {
        console.error('Failed to add goods to cart:', error);
        res.status(500).json({ error: 'Failed to add goods to cart' });
    }
});


// Create a new goods
// Create a new goods (admin only)
app.post('/addGoods', authenticateToken, async (req, res) => {
    // Check if the user is an admin
    const { name, price, description, category, quantity, image } = req.body;

    try {
        // Create a new goods
        const goods = new Goods({
            name,
            price,
            description,
            category,
            quantity,
            image
        });

        // Save the goods to the database
        await goods.save();

        res.status(201).json({ message: 'Goods created successfully' });
    } catch (error) {
        console.error('Failed to create goods:', error);
        res.status(500).json({ error: 'Failed to create goods' });
    }
});

// Get all goods
app.get('/goods', async (req, res) => {
    try {
        // Retrieve all goods from the database
        const goods = await Goods.find();

        res.json({ goods });
    } catch (error) {
        console.error('Failed to retrieve goods:', error);
        res.status(500).json({ error: 'Failed to retrieve goods' });
    }
});

// Get a specific goods by ID
app.get('/goods/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Retrieve the goods by ID from the database
        const goods = await Goods.findById(id);

        if (!goods) {
            return res.status(404).json({ error: 'Goods not found' });
        }

        res.json({ goods });
    } catch (error) {
        console.error('Failed to retrieve goods:', error);
        res.status(500).json({ error: 'Failed to retrieve goods' });
    }
});

// Update a specific goods by ID (admin only)
app.put('/putGoods/:id', authenticateToken, async (req, res) => {
    // Check if the user is an admin
    // (Admin authorization logic can be implemented here)

    const { id } = req.params;
    const { name, price, description, category, quantity, image, discounts } = req.body;

    try {
        // Find the goods by ID and update its fields
        const updatedGoods = await Goods.findByIdAndUpdate(
            id,
            { name, price, description, category, quantity, image, discounts },
            { new: true }
        );

        if (!updatedGoods) {
            return res.status(404).json({ error: 'Goods not found' });
        }

        res.json({ goods: updatedGoods });
    } catch (error) {
        console.error('Failed to update goods:', error);
        res.status(500).json({ error: 'Failed to update goods' });
    }
});


// Delete a specific goods by ID (admin only)
app.delete('/deleteGoods/:id', authenticateToken, async (req, res) => {
    // Check if the user is an admin


    const {id} = req.params;

    try {
        // Find the goods by ID and remove it from the database
        const deletedGoods = await Goods.findByIdAndRemove(id);
        if (!deletedGoods) {
            return res.status(404).json({error: 'Goods not found'});
        }

        res.json({message: 'Goods deleted successfully'});
    } catch (error) {
        console.error('Failed to delete goods:', error);
        res.status(500).json({error: 'Failed to delete goods'});
    }
});


// Middleware to authenticate the token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, 'secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    });
}


// Start the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});


