require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'frontend')));

// API Routes
app.use('/auth', require('./backend/routes/auth'));
app.use('/orders', require('./backend/routes/orders'));
app.use('/requests', require('./backend/routes/requests'));
app.use('/quotations', require('./backend/routes/quotations'));
app.use('/payments', require('./backend/routes/payments'));

// Catch-all route to serve the main app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
