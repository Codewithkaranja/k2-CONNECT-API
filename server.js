require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000;


/* -------------------------------
   1. MongoDB Connection
-------------------------------- */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("📦 MongoDB Connected"))
.catch(err => console.error("MongoDB Error:", err));


const transactionSchema = new mongoose.Schema({
    phone: String,
    amount: String,
    status: { type: String, default: "PENDING" },
    checkout_id: String,
    mpesa_receipt: String,
    createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model("Transaction", transactionSchema);



/* -------------------------------
   2. Middleware
-------------------------------- */

app.use(cors());
app.use(express.json());
app.use(express.static("docs"));


/* -------------------------------
   3. Root Route (for Render health)
-------------------------------- */

app.get("/", (req,res)=>{
    res.send("K2 Connect API Running");
});


/* -------------------------------
   4. Get OAuth Access Token
-------------------------------- */

async function getAccessToken() {

    try {

        const credentials = Buffer.from(
            `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
        ).toString("base64");

        const response = await axios.post(
            "https://sandbox.kopokopo.com/oauth/token",
            qs.stringify({ grant_type: "client_credentials" }),
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        return response.data.access_token;

    } catch(error){

        console.error("OAuth Error:", error.response?.data || error.message);
        throw new Error("Authentication failed");

    }
}



/* -------------------------------
   5. Initiate STK Push
-------------------------------- */

app.post("/api/pay", async (req,res)=>{

    try{

        const { phone, amount } = req.body;

        if(!phone || !amount){
            return res.status(400).json({error:"Phone and amount required"});
        }

        const token = await getAccessToken();

        let rawTill = process.env.MERCHANT_NUMBER.replace(/\D/g,'');
        let till = `K${rawTill}`;

        const payload = {

            payment_channel:"M-PESA STK Push",

            till_number:till,

            subscriber:{
                first_name:"Customer",
                last_name:"User",
                phone_number:phone,
                email:"customer@example.com"
            },

            amount:{
                currency:"KES",
                value:amount
            },

            metadata:{
                notes:"Website Purchase"
            },

            _links:{
                callback_url:process.env.CALLBACK_URL
            }

        };


        const response = await axios.post(
            "https://sandbox.kopokopo.com/api/v1/incoming_payments",
            payload,
            {
                headers:{
                    Authorization:`Bearer ${token}`,
                    Accept:"application/json",
                    "Content-Type":"application/json"
                }
            }
        );


        const checkoutId = response.headers.location.split("/").pop();

        const tx = new Transaction({
            phone,
            amount,
            checkout_id:checkoutId
        });

        await tx.save();

        res.status(201).json({
            message:"STK Push Sent",
            transactionId:tx._id
        });


    }catch(error){

        console.error("STK Push Error:", error.response?.data || error.message);

        res.status(500).json({
            error:"Failed to initiate payment",
            details:error.response?.data || error.message
        });

    }

});



/* -------------------------------
   6. Fetch Transactions
-------------------------------- */

app.get("/api/transactions", async(req,res)=>{

    try{

        const transactions = await Transaction
        .find()
        .sort({createdAt:-1});

        res.json(transactions);

    }catch(error){

        res.status(500).json({error:"Failed to fetch transactions"});

    }

});



/* -------------------------------
   7. Payment Callback
-------------------------------- */

app.post("/callback", async(req,res)=>{

    try{

        const payload = req.body.data;

        const checkoutId = payload.id;

        const status = payload.attributes.status;

        const resource = payload.attributes.event.resource;

        const receipt = resource?.reference || "N/A";


        await Transaction.findOneAndUpdate(
            { checkout_id:checkoutId },
            {
                status:status,
                mpesa_receipt:receipt
            }
        );

        console.log(`Payment Update: ${status} | Receipt: ${receipt}`);

        res.sendStatus(200);

    }catch(error){

        console.error("Callback Error:",error);

        res.status(500).send("Callback processing failed");

    }

});



/* -------------------------------
   8. Start Server
-------------------------------- */

app.listen(PORT,()=>{
    console.log(`🚀 Server running on port ${PORT}`);
});