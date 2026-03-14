require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000;

// --- 1. MongoDB Connection ---
// Use the MONGO_URI from your Render Environment variables
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("📦 Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Define a Transaction Schema to track payments
const transactionSchema = new mongoose.Schema({
    phone: String,
    amount: String,
    status: { type: String, default: 'PENDING' },
    checkout_id: String, // The unique ID from Kopo Kopo
    mpesa_receipt: String,
    createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

app.use(cors());
app.use(express.json());
app.use(express.static('docs')); 

// --- 2. Helper: Get OAuth Token ---
async function getAccessToken() {
    try {
        const data = qs.stringify({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'client_credentials'
        });
        
        const response = await axios.post('https://sandbox.kopokopo.com', data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Token Error:", error.response?.data || error.message);
        throw new Error("Authentication failed");
    }
}

// --- 3. Route: Initiate Payment ---
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        const token = await getAccessToken();

        let rawTill = process.env.MERCHANT_NUMBER.toString().replace(/\D/g, '');
        let till = rawTill.startsWith('K') ? rawTill : `K${rawTill}`;

        const paymentPayload = {
            payment_channel: "M-PESA STK Push",
            till_number: till,
            subscriber: {
                first_name: "Customer",
                last_name: "User",
                phone_number: phone, 
                email: "customer@example.com"
            },
            amount: { currency: "KES", value: amount },
            metadata: { notes: "Website Purchase" },
            _links: { 
                callback_url: process.env.CALLBACK_URL 
            }
        };

        const response = await axios.post(
            'https://sandbox.kopokopo.com',
            paymentPayload,
            { 
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                } 
            }
        );

        // Extract ID from the location header (e.g., .../incoming_payments/ID)
        const checkoutId = response.headers.location.split('/').pop();

        // Save the PENDING transaction to MongoDB
        const newTx = new Transaction({
            phone,
            amount,
            checkout_id: checkoutId
        });
        await newTx.save();

        res.status(201).json({ 
            message: "Check your phone for the PIN prompt!", 
            transactionId: newTx._id 
        });

    } catch (error) {
        console.error("STK Push Error:", error.response?.data || error.message);
        res.status(500).json({ 
            error: "Failed to trigger STK Push", 
            details: error.response?.data || error.message 
        });
    }
});

// --- 4. Route: Callback (Updates MongoDB) ---
app.post('/callback', async (req, res) => {
    try {
        const payload = req.body.data;
        const attributes = payload.attributes;
        
        const status = attributes.status; // e.g., "Success" or "Failed"
        const checkoutId = payload.id;
        const receipt = attributes.event.resource.reference || "N/A";

        // Find the transaction in MongoDB and update it
        const updatedTx = await Transaction.findOneAndUpdate(
            { checkout_id: checkoutId },
            { status: status, mpesa_receipt: receipt },
            { new: true }
        );

        console.log(`✅ Payment Processed: ${status} | Receipt: ${receipt}`);
        res.sendStatus(200); 
    } catch (err) {
        console.error("Callback Processing Error:", err);
        res.status(500).send("Error updating transaction");
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
