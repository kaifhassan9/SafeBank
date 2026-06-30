const BASE_URL = "http://localhost:5000/api";

// --- AUTHENTICATION ---
async function register() {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!name || !email || !password) return alert("Please fill all fields");

    try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Registration failed");

        alert("Registration successful ! Please login.");
        window.location.href = "login.html";
    } catch (err) {
        alert(err.message);
    }
}

async function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) return alert("Please fill all fields");

    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Login failed");

        localStorage.setItem("token", data.token);
        window.location.href = "dashboard.html";
    } catch (err) {
        alert(err.message);
    }
}

// --- API HELPER ---
async function apiFetch(endpoint, method = "GET", body = null) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return null;
    }

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: body ? JSON.stringify(body) : null,
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
            }
            throw new Error(data.message || "Request failed");
        }

        return data;
    } catch (err) {
        console.error("API ERROR:", err.message);
        alert(err.message);
        return null;
    }
}

// --- ACCOUNT ACTIONS ---
async function getBalance() {
    const data = await apiFetch("/account/balance");

    if (!data) return;

    document.getElementById("balanceText").innerText =
        `₹${Number(data.balance).toLocaleString('en-IN', {
            minimumFractionDigits: 2
        })}`;
}

async function deposit() {
    const input = document.getElementById("depositAmount");
    const amount = parseFloat(input.value);

    if (!amount || amount <= 0) return alert("Enter valid amount");

    const data = await apiFetch("/account/deposit", "POST", { amount });

    if (!data) return;

    alert("Deposit Successful ");
    input.value = "";
    getBalance();
    getTransactions();
}

async function withdraw() {
    const input = document.getElementById("withdrawAmount");
    const amount = parseFloat(input.value);

    if (!amount || amount <= 0) return alert("Enter valid amount");

    const data = await apiFetch("/account/withdraw", "POST", { amount });

    if (!data) return;

    alert("Withdrawal Successful ");
    input.value = "";
    getBalance();
    getTransactions();
}

async function transfer() {
    const receiverId = document.getElementById("receiverId").value;
    const amount = parseFloat(document.getElementById("transferAmount").value);

    if (!receiverId || !amount || amount <= 0)
        return alert("Check inputs");

    const data = await apiFetch("/account/transfer", "POST", {
        receiverId,
        amount,
    });

    if (!data) return;

    alert("Transfer Successful ");

    document.getElementById("receiverId").value = "";
    document.getElementById("transferAmount").value = "";

    getBalance();
    getTransactions();
}

async function getTransactions() {
    const data = await apiFetch("/account/transactions");

    if (!data) return;

    const tbody = document.getElementById("transactionsBody");
    tbody.innerHTML = "";

    data.forEach((t) => {
        let partner = "-";

        if (t.type === "transfer") {
            partner = `User ID: ${t.receiver_id || t.sender_id}`;
        }

        const row = `
            <tr>
                <td style="color:${
                    t.type === "deposit"
                        ? "green"
                        : t.type === "withdraw"
                        ? "red"
                        : "blue"
                }">
                    ${t.type.toUpperCase()}
                </td>
                <td>${partner}</td>
                <td>₹${Number(t.amount).toLocaleString()}</td>
                <td>${new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
        `;

        tbody.innerHTML += row;
    });
}
// Toggle Chat Window
function toggleChat() {
    const chat = document.getElementById("chatbot-container");
    chat.classList.toggle("chatbot-collapsed");
}

// Handle User Input
async function handleChat() {
    const inputField = document.getElementById("chat-input");
    const chatBox = document.getElementById("chat-box");
    const userText = inputField.value.toLowerCase().trim();

    if (!userText) return;

    chatBox.innerHTML += `<div class="user-msg">${inputField.value}</div>`;
    inputField.value = "";

    let botResponse = "I'm sorry, I don't understand. Try 'show balance', 'send 100 to 2', or 'help'.";

    // 1. --- NEW FEATURE: SEND MONEY VIA CHAT ---
    const transferMatch = userText.match(/send (\d+) to (?:id )?(\d+)/);
    
    if (transferMatch) {
        const amount = transferMatch[1];
        const receiverId = transferMatch[2];
        botResponse = `Processing transfer of ₹${amount} to User ID ${receiverId}...`;
        
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${BASE_URL}/account/transfer`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({ receiverId, amount })
            });
            const data = await res.json();
            if (res.ok) {
                botResponse = `✅ Transfer Successful! ₹${amount} sent to ID ${receiverId}.`;
                getBalance();       // This refreshes the hidden data
                getTransactions();  
            } else {
                botResponse = `❌ Transfer Failed: ${data.message}`;
            }
        } catch (err) {
            botResponse = "❌ Error connecting to banking server.";
        }
    } 

    // 2. --- NEW FEATURE: SHOW / REVEAL BALANCE ---
    else if (userText.includes("balance") || userText.includes("show")) {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${BASE_URL}/account/balance`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();

            // REVEAL THE HIDDEN CARD
            const balanceCard = document.getElementById("main-balance-card");
            const balanceText = document.getElementById("balanceText");
            
            if (balanceCard && balanceText) {
                balanceText.innerText = `₹${data.balance}`;
                balanceCard.style.display = "flex"; // This makes the hidden card appear
                botResponse = `🔓 I have revealed your balance. You have **₹${data.balance}** available.`;
            } else {
                botResponse = `Your current balance is **₹${data.balance}**.`;
            }
        } catch (err) {
            botResponse = "I couldn't retrieve your balance right now.";
        }
    }

    // 3. --- FEATURE: HIDE BALANCE ---
    else if (userText.includes("hide") || userText.includes("private")) {
        const balanceCard = document.getElementById("main-balance-card");
        if (balanceCard) {
            balanceCard.style.display = "none";
            botResponse = "🙈 Your balance has been hidden for privacy.";
        }
    }

    // 4. --- FEATURE: RECENT INSIGHTS ---
    else if (userText.includes("last") || userText.includes("recent")) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE_URL}/account/transactions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.length > 0) {
            const last = data[0];
            botResponse = `Your last activity was a ${last.type} of ₹${last.amount} on ${new Date(last.created_at).toLocaleDateString()}.`;
        } else {
            botResponse = "You have no recent transactions.";
        }
    }

    // 5. --- HELP ---
    else if (userText.includes("help")) {
        botResponse = "Commands:<br>• <b>show balance</b><br>• <b>hide balance</b><br>• <b>send [amount] to [id]</b><br>• <b>last transaction</b>";
    }

    setTimeout(() => {
        chatBox.innerHTML += `<div class="bot-msg">${botResponse}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 600);
}
   


// Allow "Enter" key to send message
document.getElementById("chat-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleChat();
});

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// --- INIT ---
window.onload = () => {
    if (window.location.pathname.includes("dashboard.html")) {
        getBalance();
        getTransactions();
    }
};