const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// JWT secret key (should be stored in environment variable in production)
const JWT_SECRET = 'your_jwt_secret_key';

// MySQL connection configuration
const dbConfig = {
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: '',
    database: 'food_delivery_'
};

// Function to initialize the database
async function initializeDatabase() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password
        });
        console.log('Connected to MySQL on port 3307');

        await connection.query('CREATE DATABASE IF NOT EXISTS food_delivery');
        console.log('Database food_delivery ready');

        await connection.end();

        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to food_delivery_ database');

        // Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                password VARCHAR(255),
                address VARCHAR(255),
                phone VARCHAR(20)
            )
        `);
        console.log('Users table created or exists');

        // Check if password column exists
        const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'password'");
        if (columns.length === 0) {
            console.log('Password column missing, adding...');
            await connection.query('ALTER TABLE users ADD password VARCHAR(255) AFTER email');
            console.log('Password column added to users table');
        } else {
            console.log('Password column already exists');
        }

        // Create restaurants table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS restaurants (
                restaurant_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100),
                address VARCHAR(255),
                cuisine_type VARCHAR(50)
            )
        `);
        console.log('Restaurants table created');

        // Create delivery agents table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS delivery_agents (
                agent_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100),
                phone VARCHAR(20),
                is_available BOOLEAN DEFAULT TRUE,
                current_location VARCHAR(255)
            )
        `);
        console.log('Delivery agents table created');

        // Create menu items table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS menu_items (
                item_id INT PRIMARY KEY AUTO_INCREMENT,
                restaurant_id INT,
                name VARCHAR(100),
                price DECIMAL(10, 2),
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
            )
        `);
        console.log('Menu items table created');

        // Create orders table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS orders (
                order_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                restaurant_id INT,
                agent_id INT,
                order_date DATETIME,
                total_amount DECIMAL(10, 2),
                status VARCHAR(50),
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id),
                FOREIGN KEY (agent_id) REFERENCES delivery_agents(agent_id)
            )
        `);
        console.log('Orders table created');

        // Add delivery address and notes columns to orders if they don't exist
        const [deliveryColumns] = await connection.query("SHOW COLUMNS FROM orders LIKE 'delivery_address'");
        if (deliveryColumns.length === 0) {
            console.log('Adding delivery_address column...');
            await connection.query('ALTER TABLE orders ADD delivery_address TEXT AFTER status');
            console.log('Delivery_address column added');
        }

        const [notesColumns] = await connection.query("SHOW COLUMNS FROM orders LIKE 'delivery_notes'");
        if (notesColumns.length === 0) {
            console.log('Adding delivery_notes column...');
            await connection.query('ALTER TABLE orders ADD delivery_notes TEXT AFTER delivery_address');
            console.log('Delivery_notes column added');
        }

        // Create order details table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS order_details (
                order_detail_id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT,
                item_id INT,
                quantity INT,
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
            )
        `);
        console.log('Order details table created');

        // Create reviews table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                review_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                restaurant_id INT,
                order_id INT,
                rating INT NOT NULL,
                comment TEXT,
                review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id),
                FOREIGN KEY (order_id) REFERENCES orders(order_id)
            )
        `);
        console.log('Reviews table created or exists');

        // Create payment methods table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_methods (
                payment_method_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                provider VARCHAR(50),
                card_number VARCHAR(255),
                expiry_date VARCHAR(10),
                card_holder VARCHAR(100),
                is_default BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        `);
        console.log('Payment methods table created or exists');

        // Create payments table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS payments (
                payment_id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT,
                payment_method_id INT,
                amount DECIMAL(10, 2),
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50),
                transaction_id VARCHAR(100),
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)
            )
        `);
        console.log('Payments table created or exists');

        // Create split payments table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS split_payments (
                split_id INT PRIMARY KEY AUTO_INCREMENT,
                payment_id INT,
                email VARCHAR(100),
                amount DECIMAL(10, 2),
                status VARCHAR(50),
                invitation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                payment_date DATETIME,
                FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
            )
        `);
        console.log('Split payments table created or exists');

        return connection;
    } catch (err) {
        console.error('Error initializing database:', err);
        if (connection) await connection.end();
        throw err;
    }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Invalid token:', err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Start server after database initialization
let db;
initializeDatabase()
    .then(connection => {
        db = connection;
        app.listen(port, () => {
            console.log(`Server started on http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });

// --- API ROUTES ---

// User registration
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, address, phone } = req.body;
    console.log('Registration attempt:', { name, email, address, phone });

    if (!name || !email || !password || !address || !phone) {
        console.log('Incomplete registration data');
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Hashed password generated');
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, address, phone) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, address, phone]
        );
        console.log('User registered, ID:', result.insertId);
        res.json({ user_id: result.insertId });
    } catch (err) {
        console.error('Registration error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'This email is already in use' });
        }
        res.status(500).json({ error: err.message });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (results.length === 0) {
            console.log('User not found for email:', email);
            return res.status(401).json({ error: 'Incorrect email or password' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Incorrect password for email:', email);
            return res.status(401).json({ error: 'Incorrect email or password' });
        }

        const token = jwt.sign({ user_id: user.user_id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        console.log('Successful login, token generated for user_id:', user.user_id);
        res.json({
            token,
            user: { user_id: user.user_id, name: user.name, email: user.email, address: user.address, phone: user.phone }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin dashboard stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const [[{ count: totalOrders }]] = await db.query('SELECT COUNT(*) AS count FROM orders');
        const [[{ count: totalRestaurants }]] = await db.query('SELECT COUNT(*) AS count FROM restaurants');
        const [recentOrders] = await db.query('SELECT order_id, order_date, total_amount, status, restaurant_id FROM orders ORDER BY order_date DESC LIMIT 5');

        res.json({
            totalOrders,
            totalRestaurants,
            recentOrders
        });
    } catch (err) {
        console.error('Error loading stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// List restaurants (public) - IMPROVED WITH RATINGS
app.get('/api/restaurants', async (req, res) => {
    const cuisineType = req.query.cuisine_type;
    try {
        let query = `
            SELECT r.*, 
            COALESCE(AVG(rev.rating), 0) as avg_rating,
            COUNT(rev.review_id) as review_count
            FROM restaurants r
            LEFT JOIN reviews rev ON r.restaurant_id = rev.restaurant_id
        `;
        
        let params = [];
        if (cuisineType) {
            query += ' WHERE r.cuisine_type = ?';
            params.push(cuisineType);
        }
        
        query += ' GROUP BY r.restaurant_id ORDER BY avg_rating DESC, review_count DESC';
        
        const [results] = await db.query(query, params);
        
        // Ensure proper number formatting
        const formattedResults = results.map(restaurant => ({
            ...restaurant,
            avg_rating: parseFloat(restaurant.avg_rating) || 0,
            review_count: parseInt(restaurant.review_count) || 0
        }));
        
        res.json(formattedResults);
    } catch (err) {
        console.error('Error loading restaurants:', err);
        res.status(500).json({ error: err.message });
    }
});

// List unique cuisine types
app.get('/api/cuisine-types', async (req, res) => {
    try {
        const [results] = await db.query('SELECT DISTINCT cuisine_type FROM restaurants WHERE cuisine_type IS NOT NULL');
        const cuisineTypes = results.map(row => row.cuisine_type);
        res.json(cuisineTypes);
    } catch (err) {
        console.error('Error loading cuisine types:', err);
        res.status(500).json({ error: err.message });
    }
});

// List menu items for a restaurant (public)
app.get('/api/menu-items', async (req, res) => {
    const restaurantId = req.query.restaurant_id;
    try {
        let query = 'SELECT * FROM menu_items';
        let params = [];
        if (restaurantId) {
            query += ' WHERE restaurant_id = ?';
            params.push(restaurantId);
        }
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error loading menu items:', err);
        res.status(500).json({ error: err.message });
    }
});

// Place an order (authenticated)
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { restaurant_id, items, agent_id, delivery_address, delivery_notes } = req.body;
    const user_id = req.user.user_id;
    const order_date = new Date();
    let total_amount = 0;

    console.log('Order data received:', { restaurant_id, items, agent_id, delivery_address, delivery_notes });

    if (!restaurant_id || !items || !Array.isArray(items) || items.length === 0) {
        console.log('Invalid order data:', { restaurant_id, items });
        return res.status(400).json({ error: 'Invalid order data' });
    }

    try {
        // Calculate total amount
        for (const item of items) {
            const [[menuItem]] = await db.query('SELECT price FROM menu_items WHERE item_id = ?', [item.item_id]);
            if (!menuItem) {
                console.log('Item not found:', item.item_id);
                throw new Error(`Item ${item.item_id} not found`);
            }
            total_amount += menuItem.price * item.quantity;
        }

        // Get restaurant address
        const [[restaurant]] = await db.query('SELECT address FROM restaurants WHERE restaurant_id = ?', [restaurant_id]);
        if (!restaurant) {
            console.log('Restaurant not found:', restaurant_id);
            throw new Error('Restaurant not found');
        }

        // Assign delivery agent
        let selectedAgentId;

        if (agent_id) {
            const [[agent]] = await db.query(
                'SELECT agent_id FROM delivery_agents WHERE agent_id = ? AND is_available = TRUE',
                [agent_id]
            );
            if (!agent) {
                console.log('Agent not available or not found:', agent_id);
                return res.status(400).json({ error: 'Selected agent is not available' });
            }
            selectedAgentId = agent.agent_id;
        } else {
            // Auto-assign agent
            const [agents] = await db.query(
                `SELECT agent_id 
                 FROM delivery_agents 
                 WHERE is_available = TRUE 
                 AND current_location LIKE ? 
                 LIMIT 1`,
                [`%${restaurant.address.split(',')[1]?.trim() || ''}%`]
            );
            if (agents.length > 0) {
                selectedAgentId = agents[0].agent_id;
            } else {
                const [[agent]] = await db.query(
                    'SELECT agent_id FROM delivery_agents WHERE is_available = TRUE LIMIT 1'
                );
                if (!agent) {
                    console.log('No delivery agent available');
                    return res.status(400).json({ error: 'No delivery agent available' });
                }
                selectedAgentId = agent.agent_id;
            }
        }

        // Get user address if no delivery address provided
        const [[user]] = await db.query('SELECT address FROM users WHERE user_id = ?', [user_id]);
        const finalDeliveryAddress = delivery_address || user.address || 'Address not specified';

        console.log('Final delivery address:', finalDeliveryAddress);

        // Create order
        const [orderResult] = await db.query(
            'INSERT INTO orders (user_id, restaurant_id, agent_id, order_date, total_amount, status, delivery_address, delivery_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, restaurant_id, selectedAgentId, order_date, total_amount, 'pending', finalDeliveryAddress, delivery_notes || null]
        );
        const order_id = orderResult.insertId;

        // Add order details
        for (const item of items) {
            await db.query(
                'INSERT INTO order_details (order_id, item_id, quantity) VALUES (?, ?, ?)',
                [order_id, item.item_id, item.quantity]
            );
        }

        // Mark agent as busy
        await db.query('UPDATE delivery_agents SET is_available = FALSE WHERE agent_id = ?', [selectedAgentId]);

        console.log('Order created, ID:', order_id, 'Agent assigned:', selectedAgentId, 'Address:', finalDeliveryAddress);
        res.json({ order_id });
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: err.message });
    }
});

// List user orders (authenticated)
app.get('/api/orders', authenticateToken, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        const [results] = await db.query(
            `SELECT o.*, r.name AS restaurant_name, da.name AS agent_name
             FROM orders o
             LEFT JOIN restaurants r ON o.restaurant_id = r.restaurant_id
             LEFT JOIN delivery_agents da ON o.agent_id = da.agent_id
             WHERE o.user_id = ?
             ORDER BY o.order_date DESC`,
            [user_id]
        );
        res.json(results);
    } catch (err) {
        console.error('Error loading orders:', err);
        res.status(500).json({ error: err.message });
    }
});

// List order details (authenticated)
app.get('/api/order-details', authenticateToken, async (req, res) => {
    const orderId = req.query.order_id;
    const user_id = req.user.user_id;
    try {
        let query = `
            SELECT od.*, mi.name AS item_name, mi.price
            FROM order_details od
            JOIN menu_items mi ON od.item_id = mi.item_id
            JOIN orders o ON od.order_id = o.order_id
            WHERE o.user_id = ?
        `;
        let params = [user_id];
        if (orderId) {
            query += ' AND od.order_id = ?';
            params.push(orderId);
        }
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error loading order details:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get user profile (authenticated)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        const [[user]] = await db.query('SELECT user_id, name, email, address, phone FROM users WHERE user_id = ?', [user_id]);
        if (!user) {
            console.log('User not found, ID:', user_id);
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error loading profile:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update user profile (authenticated)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    const user_id = req.user.user_id;
    const { name, email, address, phone, password } = req.body;
    try {
        let query = 'UPDATE users SET name = ?, email = ?, address = ?, phone = ?';
        let params = [name, email, address, phone];
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        query += ' WHERE user_id = ?';
        params.push(user_id);
        await db.query(query, params);
        console.log('Profile updated for user_id:', user_id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating profile:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'This email is already in use' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Get user statistics (authenticated)
app.get('/api/user/stats', authenticateToken, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        // Total number of orders
        const [[{ totalOrders }]] = await db.query(
            'SELECT COUNT(*) AS totalOrders FROM orders WHERE user_id = ?', 
            [user_id]
        );
        
        // Total amount spent
        const [[{ totalSpent }]] = await db.query(
            'SELECT COALESCE(SUM(total_amount), 0) AS totalSpent FROM orders WHERE user_id = ? AND status IN ("paid", "delivered")', 
            [user_id]
        );
        
        // Favorite restaurant (most ordered from)
        const [favoriteResult] = await db.query(`
            SELECT r.name AS restaurant_name, COUNT(o.order_id) AS order_count
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.restaurant_id
            WHERE o.user_id = ?
            GROUP BY o.restaurant_id, r.name
            ORDER BY order_count DESC, MAX(o.order_date) DESC
            LIMIT 1
        `, [user_id]);
        
        const favoriteRestaurant = favoriteResult.length > 0 ? favoriteResult[0].restaurant_name : null;
        
        // Favorite cuisine
        const [cuisineResult] = await db.query(`
            SELECT r.cuisine_type, COUNT(o.order_id) AS order_count
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.restaurant_id
            WHERE o.user_id = ? AND r.cuisine_type IS NOT NULL AND r.cuisine_type != ''
            GROUP BY r.cuisine_type
            ORDER BY order_count DESC
            LIMIT 1
        `, [user_id]);
        
        console.log('Raw cuisine result:', cuisineResult);
        
        // Clean favorite cuisine (remove unwanted characters)
        let favoriteCuisine = null;
        if (cuisineResult.length > 0) {
            const rawCuisine = cuisineResult[0].cuisine_type;
            console.log('Raw cuisine before cleaning:', JSON.stringify(rawCuisine));
            
            favoriteCuisine = rawCuisine
                .replace(/^\||\|$/g, '') // Remove pipes at beginning and end
                .trim(); // Remove spaces
            
            console.log('Cuisine after cleaning:', JSON.stringify(favoriteCuisine));
            
            // If empty after cleaning, set to null
            if (!favoriteCuisine) {
                favoriteCuisine = null;
            }
        }
        
        console.log('Final cuisine:', favoriteCuisine);
        
        // Average order amount
        const [[{ averageOrder }]] = await db.query(
            'SELECT COALESCE(AVG(total_amount), 0) AS averageOrder FROM orders WHERE user_id = ? AND status IN ("paid", "delivered")', 
            [user_id]
        );
        
        console.log('Statistics calculated for user_id:', user_id, {
            totalOrders: parseInt(totalOrders),
            totalSpent: parseFloat(totalSpent),
            favoriteRestaurant,
            favoriteCuisine,
            averageOrder: parseFloat(averageOrder)
        });
        
        res.json({
            totalOrders: parseInt(totalOrders),
            totalSpent: parseFloat(totalSpent),
            favoriteRestaurant,
            favoriteCuisine,
            averageOrder: parseFloat(averageOrder)
        });
    } catch (err) {
        console.error('Error loading user statistics:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN ROUTES ---

// Admin: Get all restaurants
app.get('/api/admin/restaurants', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM restaurants');
        res.json(results);
    } catch (err) {
        console.error('Error loading restaurants:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Add restaurant
app.post('/api/admin/restaurants', async (req, res) => {
    const { name, address, cuisine_type } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO restaurants (name, address, cuisine_type) VALUES (?, ?, ?)',
            [name, address, cuisine_type]
        );
        res.json({ restaurant_id: result.insertId });
    } catch (err) {
        console.error('Error adding restaurant:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get menu items
app.get('/api/admin/menu-items', async (req, res) => {
    const restaurantId = req.query.restaurant_id;
    try {
        let query = 'SELECT mi.*, r.name AS restaurant_name FROM menu_items mi JOIN restaurants r ON mi.restaurant_id = r.restaurant_id';
        let params = [];
        if (restaurantId) {
            query += ' WHERE mi.restaurant_id = ?';
            params.push(restaurantId);
        }
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error loading menu items:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Add menu item
app.post('/api/admin/menu-items', async (req, res) => {
    const { restaurant_id, name, price } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO menu_items (restaurant_id, name, price) VALUES (?, ?, ?)',
            [restaurant_id, name, price]
        );
        res.json({ item_id: result.insertId });
    } catch (err) {
        console.error('Error adding menu item:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update menu item
app.put('/api/admin/menu-items/:id', async (req, res) => {
    const { restaurant_id, name, price } = req.body;
    try {
        await db.query(
            'UPDATE menu_items SET restaurant_id = ?, name = ?, price = ? WHERE item_id = ?',
            [restaurant_id, name, price, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating menu item:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete menu item
app.delete('/api/admin/menu-items/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM menu_items WHERE item_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting menu item:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all orders
app.get('/api/admin/orders', async (req, res) => {
    const status = req.query.status;
    try {
        let query = `
            SELECT o.*, r.name AS restaurant_name, u.name AS user_name, da.name AS agent_name
            FROM orders o
            LEFT JOIN restaurants r ON o.restaurant_id = r.restaurant_id
            LEFT JOIN users u ON o.user_id = u.user_id
            LEFT JOIN delivery_agents da ON o.agent_id = da.agent_id
        `;
        let params = [];
        if (status) {
            query += ' WHERE o.status = ?';
            params.push(status);
        }
        query += ' ORDER BY o.order_date DESC';
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error loading orders:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update order status
app.put('/api/admin/orders/:id', async (req, res) => {
    const { status } = req.body;
    const order_id = req.params.id;

    try {
        if (status === 'delivered') {
            const [[order]] = await db.query('SELECT agent_id FROM orders WHERE order_id = ?', [order_id]);
            if (order && order.agent_id) {
                await db.query('UPDATE delivery_agents SET is_available = TRUE WHERE agent_id = ?', [order.agent_id]);
                console.log('Agent made available after delivery:', order.agent_id);
            }
        }

        await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, order_id]);
        console.log('Order status updated:', { order_id, status });
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const [results] = await db.query('SELECT user_id, name, email, address, phone FROM users');
        res.json(results);
    } catch (err) {
        console.error('Error loading users:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Add user
app.post('/api/admin/users', async (req, res) => {
    const { name, email, address, phone } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO users (name, email, address, phone) VALUES (?, ?, ?, ?)',
            [name, email, address, phone]
        );
        res.json({ user_id: result.insertId });
    } catch (err) {
        console.error('Error adding user:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update user
app.put('/api/admin/users/:id', async (req, res) => {
    const { name, email, address, phone } = req.body;
    try {
        await db.query(
            'UPDATE users SET name = ?, email = ?, address = ?, phone = ? WHERE user_id = ?',
            [name, email, address, phone, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete user
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all delivery agents
app.get('/api/admin/delivery-agents', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM delivery_agents');
        res.json(results);
    } catch (err) {
        console.error('Error loading delivery agents:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Add delivery agent
app.post('/api/admin/delivery-agents', async (req, res) => {
    const { name, phone, current_location, is_available } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO delivery_agents (name, phone, current_location, is_available) VALUES (?, ?, ?, ?)',
            [name, phone, current_location, is_available]
        );
        res.json({ agent_id: result.insertId });
    } catch (err) {
        console.error('Error adding delivery agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update delivery agent
app.put('/api/admin/delivery-agents/:id', async (req, res) => {
    const { name, phone, current_location, is_available } = req.body;
    try {
        await db.query(
            'UPDATE delivery_agents SET name = ?, phone = ?, current_location = ?, is_available = ? WHERE agent_id = ?',
            [name, phone, current_location, is_available, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating delivery agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete delivery agent
app.delete('/api/admin/delivery-agents/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM delivery_agents WHERE agent_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting delivery agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get order details
app.get('/api/admin/order-details', async (req, res) => {
    const orderId = req.query.order_id;
    try {
        let query = `
            SELECT od.*, mi.name AS item_name
            FROM order_details od
            JOIN menu_items mi ON od.item_id = mi.item_id
        `;
        let params = [];
        if (orderId) {
            query += ' WHERE od.order_id = ?';
            params.push(orderId);
        }
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error loading order details:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- DELIVERY ROUTES ---

// Get available delivery agents
app.get('/api/delivery-agents/available', async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT agent_id, name, phone, current_location FROM delivery_agents WHERE is_available = TRUE'
        );
        console.log('Available agents retrieved:', results.length);
        res.json(results);
    } catch (err) {
        console.error('Error loading available agents:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Reassign agent to order
app.put('/api/admin/orders/:id/assign-agent', async (req, res) => {
    const { agent_id } = req.body;
    const order_id = req.params.id;

    try {
        const [[agent]] = await db.query(
            'SELECT agent_id FROM delivery_agents WHERE agent_id = ? AND is_available = TRUE',
            [agent_id]
        );
        if (!agent) {
            console.log('Agent not available or not found for reassignment:', agent_id);
            return res.status(400).json({ error: 'Selected agent is not available' });
        }

        const [[order]] = await db.query('SELECT agent_id FROM orders WHERE order_id = ?', [order_id]);
        if (!order) {
            console.log('Order not found:', order_id);
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.agent_id) {
            await db.query('UPDATE delivery_agents SET is_available = TRUE WHERE agent_id = ?', [order.agent_id]);
            console.log('Previous agent made available:', order.agent_id);
        }

        await db.query('UPDATE orders SET agent_id = ? WHERE order_id = ?', [agent_id, order_id]);
        await db.query('UPDATE delivery_agents SET is_available = FALSE WHERE agent_id = ?', [agent_id]);

        console.log('Agent reassigned to order:', { order_id, agent_id });
        res.json({ success: true });
    } catch (err) {
        console.error('Error reassigning agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- REVIEW SYSTEM ROUTES ---

// Add a review for a restaurant
app.post('/api/reviews', authenticateToken, async (req, res) => {
    const { restaurant_id, order_id, rating, comment } = req.body;
    const user_id = req.user.user_id;

    if (!restaurant_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Invalid review data' });
    }

    try {
        // Verify user has ordered from this restaurant
        if (order_id) {
            const [[order]] = await db.query(
                'SELECT order_id FROM orders WHERE order_id = ? AND user_id = ? AND restaurant_id = ?',
                [order_id, user_id, restaurant_id]
            );
            
            if (!order) {
                return res.status(403).json({ error: 'You can only review orders that belong to you' });
            }
        } else {
            const [[hasOrdered]] = await db.query(
                'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND restaurant_id = ? AND status = "delivered"',
                [user_id, restaurant_id]
            );
            
            if (!hasOrdered || hasOrdered.count === 0) {
                return res.status(403).json({ error: 'You must have ordered from this restaurant to review it' });
            }
        }

        // Check if user has already reviewed this order
        if (order_id) {
            const [[existingReview]] = await db.query(
                'SELECT review_id FROM reviews WHERE user_id = ? AND order_id = ?',
                [user_id, order_id]
            );
            
            if (existingReview) {
                // Update existing review
                await db.query(
                    'UPDATE reviews SET rating = ?, comment = ?, review_date = NOW() WHERE review_id = ?',
                    [rating, comment, existingReview.review_id]
                );
                return res.json({ 
                    success: true, 
                    message: 'Review updated', 
                    review_id: existingReview.review_id 
                });
            }
        }

        // Add new review
        const [result] = await db.query(
            'INSERT INTO reviews (user_id, restaurant_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
            [user_id, restaurant_id, order_id || null, rating, comment || null]
        );
        
        res.json({ 
            success: true, 
            message: 'Review added successfully', 
            review_id: result.insertId 
        });
    } catch (err) {
        console.error('Error adding review:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get reviews for a restaurant
app.get('/api/restaurants/:id/reviews', async (req, res) => {
    const restaurantId = req.params.id;
    
    try {
        const [reviews] = await db.query(
            `SELECT r.review_id, r.rating, r.comment, r.review_date,
            u.name as user_name, u.user_id 
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.restaurant_id = ?
            ORDER BY r.review_date DESC
            LIMIT 50`,
            [restaurantId]
        );
        
        // Calculate average rating
        const [[{ avg_rating }]] = await db.query(
            'SELECT AVG(rating) as avg_rating FROM reviews WHERE restaurant_id = ?',
            [restaurantId]
        );
        
        // Count total reviews
        const [[{ total_reviews }]] = await db.query(
            'SELECT COUNT(*) as total_reviews FROM reviews WHERE restaurant_id = ?',
            [restaurantId]
        );
        
        res.json({
            reviews,
            avg_rating: avg_rating || 0,
            total_reviews: total_reviews || 0
        });
    } catch (err) {
        console.error('Error loading reviews:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get average ratings for all restaurants
app.get('/api/restaurants/ratings', async (req, res) => {
    try {
        const [ratings] = await db.query(`
            SELECT r.restaurant_id, AVG(rev.rating) as avg_rating, COUNT(rev.review_id) as review_count
            FROM restaurants r
            LEFT JOIN reviews rev ON r.restaurant_id = rev.restaurant_id
            GROUP BY r.restaurant_id
        `);
        
        res.json(ratings);
    } catch (err) {
        console.error('Error loading ratings:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- PAYMENT SYSTEM ROUTES ---

// Add a payment method
app.post('/api/payment-methods', authenticateToken, async (req, res) => {
    const { provider, card_number, expiry_date, card_holder, is_default } = req.body;
    const user_id = req.user.user_id;
    
    if (!provider || !card_number || !expiry_date || !card_holder) {
        return res.status(400).json({ error: 'All payment information is required' });
    }
    
    try {
        // Encrypt card number (in production, use a more secure solution)
        const encryptedCardNumber = await bcrypt.hash(card_number.slice(-4), 10);
        
        // If this is the default method, deactivate others
        if (is_default) {
            await db.query(
                'UPDATE payment_methods SET is_default = FALSE WHERE user_id = ?',
                [user_id]
            );
        }
        
        const [result] = await db.query(
            'INSERT INTO payment_methods (user_id, provider, card_number, expiry_date, card_holder, is_default) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, provider, encryptedCardNumber, expiry_date, card_holder, is_default || false]
        );
        
        res.json({ 
            success: true, 
            payment_method_id: result.insertId,
            message: 'Payment method added' 
        });
    } catch (err) {
        console.error('Error adding payment method:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get user payment methods
app.get('/api/payment-methods', authenticateToken, async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        const [methods] = await db.query(
            `SELECT payment_method_id, provider, 
            CONCAT('XXXX-XXXX-XXXX-', RIGHT(card_number, 4)) as masked_card_number, 
            expiry_date, card_holder, is_default
            FROM payment_methods
            WHERE user_id = ?
            ORDER BY is_default DESC, payment_method_id DESC`,
            [user_id]
        );
        
        res.json(methods);
    } catch (err) {
        console.error('Error loading payment methods:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a payment method
app.delete('/api/payment-methods/:id', authenticateToken, async (req, res) => {
    const payment_method_id = req.params.id;
    const user_id = req.user.user_id;
    
    try {
        const [[method]] = await db.query(
            'SELECT payment_method_id, is_default FROM payment_methods WHERE payment_method_id = ? AND user_id = ?',
            [payment_method_id, user_id]
        );
        
        if (!method) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        
        await db.query(
            'DELETE FROM payment_methods WHERE payment_method_id = ?',
            [payment_method_id]
        );
        
        // If it was the default method, set another method as default
        if (method.is_default) {
            const [methods] = await db.query(
                'SELECT payment_method_id FROM payment_methods WHERE user_id = ? LIMIT 1',
                [user_id]
            );
            
            if (methods.length > 0) {
                await db.query(
                    'UPDATE payment_methods SET is_default = TRUE WHERE payment_method_id = ?',
                    [methods[0].payment_method_id]
                );
            }
        }
        
        res.json({ success: true, message: 'Payment method deleted' });
    } catch (err) {
        console.error('Error deleting payment method:', err);
        res.status(500).json({ error: err.message });
    }
});

// Process a payment
app.post('/api/payments', authenticateToken, async (req, res) => {
    const { order_id, payment_method_id, amount, split_with } = req.body;
    const user_id = req.user.user_id;
    
    if (!order_id || !amount) {
        return res.status(400).json({ error: 'Incomplete payment information' });
    }
    
    try {
        // Verify order belongs to user
        const [[order]] = await db.query(
            'SELECT total_amount FROM orders WHERE order_id = ? AND user_id = ?',
            [order_id, user_id]
        );
        
        if (!order) {
            return res.status(403).json({ error: 'Order not found or unauthorized' });
        }
        
        // Verify payment method
        let selectedPaymentMethodId = payment_method_id;
        
        if (!selectedPaymentMethodId) {
            // Use default method
            const [[defaultMethod]] = await db.query(
                'SELECT payment_method_id FROM payment_methods WHERE user_id = ? AND is_default = TRUE LIMIT 1',
                [user_id]
            );
            
            if (!defaultMethod) {
                return res.status(400).json({ error: 'No payment method specified or default' });
            }
            
            selectedPaymentMethodId = defaultMethod.payment_method_id;
        } else {
            // Verify method belongs to user
            const [[method]] = await db.query(
                'SELECT payment_method_id FROM payment_methods WHERE payment_method_id = ? AND user_id = ?',
                [selectedPaymentMethodId, user_id]
            );
            
            if (!method) {
                return res.status(403).json({ error: 'Payment method not found or unauthorized' });
            }
        }
        
        // Create payment (in a real system, there would be integration with a payment processor)
        const transaction_id = 'TR' + Date.now() + Math.floor(Math.random() * 1000);
        const totalAmount = parseFloat(amount);
        
        const [paymentResult] = await db.query(
            'INSERT INTO payments (order_id, payment_method_id, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?)',
            [order_id, selectedPaymentMethodId, totalAmount, 'completed', transaction_id]
        );
        
        const payment_id = paymentResult.insertId;
        
        // Handle bill splitting if requested
        if (split_with && Array.isArray(split_with) && split_with.length > 0) {
            const individualAmount = totalAmount / (split_with.length + 1);
            
            for (const email of split_with) {
                await db.query(
                    'INSERT INTO split_payments (payment_id, email, amount, status) VALUES (?, ?, ?, ?)',
                    [payment_id, email, individualAmount, 'pending']
                );
            }
            
            // Update order status
            await db.query(
                'UPDATE orders SET status = ? WHERE order_id = ?',
                ['partially paid', order_id]
            );
        } else {
            // Update order status
            await db.query(
                'UPDATE orders SET status = ? WHERE order_id = ?',
                ['paid', order_id]
            );
        }
        
        res.json({
            success: true,
            payment_id,
            transaction_id,
            message: split_with && split_with.length > 0 
                ? 'Partial payment completed and invitations sent' 
                : 'Payment completed successfully'
        });
    } catch (err) {
        console.error('Payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Handle bill splitting (guest payment)
app.post('/api/split-payments/:id/pay', async (req, res) => {
    const split_id = req.params.id;
    const { email, payment_method_details } = req.body;
    
    if (!email || !payment_method_details) {
        return res.status(400).json({ error: 'Incomplete information' });
    }
    
    try {
        // Verify invitation exists and matches email
        const [[splitPayment]] = await db.query(
            'SELECT * FROM split_payments WHERE split_id = ? AND email = ? AND status = "pending"',
            [split_id, email]
        );
        
        if (!splitPayment) {
            return res.status(404).json({ error: 'Payment invitation not found or already used' });
        }
        
        // Simulate payment with provided details
        // In a real system, integrate with a payment processor
        
        // Mark as paid
        await db.query(
            'UPDATE split_payments SET status = "paid", payment_date = NOW() WHERE split_id = ?',
            [split_id]
        );
        
        // Check if all splits are paid
        const [[{ total, paid }]] = await db.query(
            `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid 
             FROM split_payments WHERE payment_id = ?`,
            [splitPayment.payment_id]
        );
        
        if (total === paid) {
            // All splits are paid, update order status
            const [[payment]] = await db.query(
                'SELECT order_id FROM payments WHERE payment_id = ?',
                [splitPayment.payment_id]
            );
            
            if (payment) {
                await db.query(
                    'UPDATE orders SET status = "paid" WHERE order_id = ?',
                    [payment.order_id]
                );
            }
        }
        
        res.json({
            success: true,
            message: 'Shared payment completed successfully'
        });
    } catch (err) {
        console.error('Shared payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- SUGGESTIONS ROUTES ---

// Get restaurant suggestions based on user preferences
app.get('/api/restaurants/suggestions', authenticateToken, async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        // Find user's preferred cuisine types
        const [cuisinePreferences] = await db.query(`
            SELECT r.cuisine_type, AVG(rev.rating) as avg_rating, COUNT(rev.review_id) as review_count
            FROM reviews rev
            JOIN restaurants r ON rev.restaurant_id = r.restaurant_id
            WHERE rev.user_id = ? AND rev.rating >= 4
            GROUP BY r.cuisine_type
            ORDER BY avg_rating DESC, review_count DESC
            LIMIT 3
        `, [user_id]);
        
        // If user has no preferences yet, return top-rated restaurants
        if (cuisinePreferences.length === 0) {
            const [topRatedRestaurants] = await db.query(`
                SELECT r.*, 
                COALESCE(AVG(rev.rating), 0) as avg_rating,
                COUNT(rev.review_id) as review_count
                FROM restaurants r
                LEFT JOIN reviews rev ON r.restaurant_id = rev.restaurant_id
                GROUP BY r.restaurant_id
                HAVING avg_rating > 0
                ORDER BY avg_rating DESC, review_count DESC
                LIMIT 5
            `);
            
            return res.json({
                type: 'top_rated',
                message: 'Top-rated restaurants',
                restaurants: topRatedRestaurants
            });
        }
        
        // Build query based on preferences
        const cuisineTypes = cuisinePreferences.map(pref => pref.cuisine_type);
        
        const placeholders = cuisineTypes.map(() => '?').join(',');
        const [suggestedRestaurants] = await db.query(`
            SELECT r.*, 
            COALESCE(AVG(rev.rating), 0) as avg_rating,
            COUNT(rev.review_id) as review_count
            FROM restaurants r
            LEFT JOIN reviews rev ON r.restaurant_id = rev.restaurant_id
            WHERE r.cuisine_type IN (${placeholders})
            AND r.restaurant_id NOT IN (
                SELECT DISTINCT restaurant_id 
                FROM orders 
                WHERE user_id = ?
            )
            GROUP BY r.restaurant_id
            ORDER BY 
                CASE 
                    WHEN r.cuisine_type = ? THEN 1
                    WHEN r.cuisine_type = ? THEN 2
                    ELSE 3
                END,
                avg_rating DESC
            LIMIT 5
        `, [...cuisineTypes, user_id, cuisineTypes[0], cuisineTypes[1] || cuisineTypes[0]]);
        
        res.json({
            type: 'personalized',
            message: 'Suggestions based on your preferences',
            restaurants: suggestedRestaurants,
            preferences: cuisinePreferences
        });
    } catch (err) {
        console.error('Error loading suggestions:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ERROR HANDLING ---

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    if (db) {
        await db.end();
        console.log('Database connection closed');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down server...');
    if (db) {
        await db.end();
        console.log('Database connection closed');
    }
    process.exit(0);
});