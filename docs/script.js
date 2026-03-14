async function handlePayment() {
    const phone = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const status = document.getElementById('status');
    const btn = document.getElementById('payBtn');

    if(!phone || !amount) return alert("Please fill all fields");

    btn.disabled = true;
    status.innerText = "Requesting payment...";

    try {
        const response = await fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, amount })
        });

        const data = await response.json();
        
        if (response.ok) {
            status.innerText = "Check your phone for the M-Pesa PIN prompt!";
        } else {
            status.innerText = "Error: " + data.error;
        }
    } catch (err) {
        status.innerText = "Server error. Is the backend running?";
    } finally {
        btn.disabled = false;
    }
}
