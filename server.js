require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('docs')); // Points to your renamed folder

// --- Helper: Get OAuth Token ---
async function getAccessToken() {
    const data = qs.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'client_credentials'
    });
    
    const response = await axios.post('https://sandbox.kopokopo.com', data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
}

// --- Route: Initiate Payment ---
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        const token = await getAccessToken();

        const paymentPayload = {
            payment_channel: "M-PESA STK Push",
            till_number: `K${process.env.MERCHANT_NUMBER.replace(/\D/g, '')}`, // Ensures 'K' prefix
            subscriber: {
                first_name: "Customer",
                last_name: "User",
                phone_number: phone,
                email: "customer@example.com"
            },
            amount: { currency: "KES", value: amount },
            _links: { callback_url: process.env.CALLBACK_URL }
        };

        const response = await axios.post(
            'https://sandbox.kopokopo.com',
            paymentPayload,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
        );

        res.status(201).json({ message: "Check your phone!", location: response.headers.location });
    } catch (error) {
        console.error("Payment Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to trigger STK Push" });
    }
});

// --- Route: Callback (Status updates) ---
app.post('/callback', (req, res) => {
    console.log("Kopo Kopo Notification:", JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
