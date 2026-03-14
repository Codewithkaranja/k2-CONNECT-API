async function handlePayment() {
    const phoneInput = document.getElementById('phone').value.trim();
    const amount = document.getElementById('amount').value;
    const status = document.getElementById('status');
    const btn = document.getElementById('payBtn');

    // 1. Validation
    if (!phoneInput || !amount) {
        return alert("Please fill in both phone number and amount");
    }

    // Ensure phone starts with +254 (Kopo Kopo requirement)
    let phone = phoneInput;
    if (phone.startsWith('0')) {
        phone = '+254' + phone.slice(1);
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
        phone = '+254' + phone;
    }

    // 2. UI Feedback
    btn.disabled = true;
    btn.innerText = "Processing...";
    status.style.color = "blue";
    status.innerText = "Requesting M-Pesa prompt...";

    try {
        // Since frontend is hosted on the same server, '/api/pay' works perfectly
        const response = await fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, amount })
        });

        const data = await response.json();
        
        if (response.ok) {
            status.style.color = "green";
            status.innerText = "✅ Request sent! Check your phone for the M-Pesa PIN prompt.";
        } else {
            status.style.color = "red";
            status.innerText = "❌ Error: " + (data.error || "Payment failed");
            console.error("Backend Error:", data);
        }
    } catch (err) {
        status.style.color = "red";
        status.innerText = "❌ Connection error. Please check your internet.";
        console.error("Fetch Error:", err);
    } finally {
        btn.disabled = false;
        btn.innerText = "Pay Now";
    }
}
