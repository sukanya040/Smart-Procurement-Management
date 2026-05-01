const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get all quotations for a specific request
router.get('/request/:requestId', verifyToken, async (req, res) => {
    try {
        const [quotes] = await db.execute(`
            SELECT q.*, u.Name as SellerName 
            FROM Quotations q
            JOIN Users u ON q.Seller_ID = u.User_ID
            WHERE q.Request_ID = ?
        `, [req.params.requestId]);
        
        res.json(quotes);
    } catch (error) {
        console.error('Error fetching quotations:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Seller submits a quotation
router.post('/', verifyToken, requireRole(['Seller']), async (req, res) => {
    try {
        const { request_id, price, delivery_time, proposal } = req.body;

        if (!request_id || !price) {
            return res.status(400).json({ message: 'Request ID and Price are required' });
        }

        // Ensure the request exists and is Approved
        const [requests] = await db.execute('SELECT Status FROM Requests WHERE Request_ID = ?', [request_id]);
        if (requests.length === 0 || requests[0].Status !== 'Approved') {
            return res.status(400).json({ message: 'Request is not available for quoting' });
        }

        const [result] = await db.execute(
            'INSERT INTO Quotations (Request_ID, Seller_ID, Price, Delivery_Time, Proposal, Status) VALUES (?, ?, ?, ?, ?, ?)',
            [request_id, req.user.userId, price, delivery_time || '', proposal || '', 'Pending']
        );

        res.status(201).json({ message: 'Quotation submitted successfully', quoteId: result.insertId });
    } catch (error) {
        console.error('Error submitting quotation:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Customer accepts a quotation
router.put('/:id/accept', verifyToken, requireRole(['Customer']), async (req, res) => {
    try {
        const quoteId = req.params.id;

        // Verify quote exists and belongs to a request owned by the customer
        const [quotes] = await db.execute(`
            SELECT q.*, r.User_ID 
            FROM Quotations q
            JOIN Requests r ON q.Request_ID = r.Request_ID
            WHERE q.Quote_ID = ?
        `, [quoteId]);

        if (quotes.length === 0) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        if (quotes[0].User_ID !== req.user.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Accept this quote and reject others
        await db.execute('UPDATE Quotations SET Status = "Accepted" WHERE Quote_ID = ?', [quoteId]);
        await db.execute('UPDATE Quotations SET Status = "Rejected" WHERE Request_ID = ? AND Quote_ID != ?', [quotes[0].Request_ID, quoteId]);
        
        res.json({ message: 'Quotation accepted successfully. Please proceed to payment.' });
    } catch (error) {
        console.error('Error accepting quotation:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
