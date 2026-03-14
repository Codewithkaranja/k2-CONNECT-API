require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('docs')); 

// --- Helper: Get OAuth Token ---
async function getAccessToken() {
    try {
        const data = qs.stringify({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'client_credentials'
        });
        
        // FIXED: Added full path /oauth/token
        const response = await axios.post('https://sandbox.kopokopo.com', data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Token Error Details:", error.response?.data || error.message);
        throw new Error("Authentication failed");
    }
}

// --- Route: Initiate Payment ---
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        const token = await getAccessToken();

        // Ensure MERCHANT_NUMBER starts with K
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
            metadata: {
                customer_id: "12345",
                notes: "Website Purchase"
            },
            _links: { 
                callback_url: process.env.CALLBACK_URL 
            }
        };

        // FIXED: Added full path /api/v1/incoming_payments
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

        res.status(201).json({ 
            message: "Check your phone for the PIN prompt!", 
            location: response.headers.location 
        });

    } catch (error) {
        console.error("STK Push Error:", error.response?.data || error.message);
        res.status(500).json({ 
            error: "Failed to trigger STK Push", 
            details: error.response?.data || error.message 
        });
    }
});

// --- Route: Callback ---
app.post('/callback', (req, res) => {
    console.log("✅ Kopo Kopo Notification Received:");
    console.log(JSON.stringify(req.body, null, 2));
    res.sendStatus(200); 
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
