const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Process Payment (Customer only)
router.post('/', verifyToken, requireRole(['Customer']), async (req, res) => {
    try {
        const { quote_id, card_number, expiry, cvv, payment_method } = req.body;

        if (!quote_id) {
            return res.status(400).json({ message: 'Quote ID is required' });
        }

        // Verify quote exists, is accepted, and belongs to a request owned by the customer
        const [quotes] = await db.execute(`
            SELECT q.*, r.User_ID 
            FROM Quotations q
            JOIN Requests r ON q.Request_ID = r.Request_ID
            WHERE q.Quote_ID = ? AND q.Status = 'Accepted'
        `, [quote_id]);

        if (quotes.length === 0) {
            return res.status(400).json({ message: 'Invalid or unaccepted quotation' });
        }

        if (quotes[0].User_ID !== req.user.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const quote = quotes[0];
        
        // Check if an order already exists for this quote
        const [orders] = await db.execute('SELECT Order_ID FROM Orders WHERE Quote_ID = ?', [quote_id]);
        if (orders.length > 0) {
            return res.status(400).json({ message: 'Order already exists for this quotation' });
        }

        // Simulating a mock payment gateway
        // In a real app, this is where Stripe/PayPal would be called
        const isPaymentSuccessful = true; // Mocking success

        if (!isPaymentSuccessful) {
            // Log failed payment
            await db.execute(
                'INSERT INTO Payments (Request_ID, Quote_ID, Amount, Payment_Status) VALUES (?, ?, ?, ?)',
                [quote.Request_ID, quote.Quote_ID, quote.Price, 'Failed']
            );
            return res.status(400).json({ message: 'Payment failed' });
        }

        // 1. Log successful payment
        const [paymentResult] = await db.execute(
            'INSERT INTO Payments (Request_ID, Quote_ID, Amount, Payment_Status) VALUES (?, ?, ?, ?)',
            [quote.Request_ID, quote.Quote_ID, quote.Price, 'Success']
        );

        // 2. Create the order ONLY after successful payment
        await db.execute(
            'INSERT INTO Orders (Request_ID, Quote_ID, Seller_ID, Order_Status) VALUES (?, ?, ?, ?)',
            [quote.Request_ID, quote.Quote_ID, quote.Seller_ID, 'Pending']
        );

        res.status(201).json({ message: 'Payment successful and Order placed', paymentId: paymentResult.insertId });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Admin monitor all payments
router.get('/', verifyToken, requireRole(['Admin']), async (req, res) => {
    try {
        const [payments] = await db.execute(`
            SELECT p.*, r.Item_Name, c.Name as CustomerName, s.Name as SellerName
            FROM Payments p
            JOIN Requests r ON p.Request_ID = r.Request_ID
            JOIN Quotations q ON p.Quote_ID = q.Quote_ID
            JOIN Users c ON r.User_ID = c.User_ID
            JOIN Users s ON q.Seller_ID = s.User_ID
            ORDER BY p.Payment_Date DESC
        `);
        res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
