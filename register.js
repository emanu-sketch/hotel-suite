const form = document.getElementById("registerForm");
const btn = document.getElementById("registerBtn");
const errorDiv = document.getElementById("error");

form.addEventListener("submit", e => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    errorDiv.textContent = "";

    if (!username || !password) {
        errorDiv.textContent = "All fields are required";
        return;
    }

    if (password.length < 3) {
        errorDiv.textContent = "Password too short (min 3 characters)";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Registering...";

    fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(async res => {
        const data = await res.json();

        if (!res.ok) {
            errorDiv.textContent = data.error || "Registration failed";
            btn.disabled = false;
            btn.textContent = "Register";
            return;
        }

        alert("Account created! You can now login.");
        window.location.href = "login.html";
    })
    .catch(() => {
        errorDiv.textContent = "Server error";
        btn.disabled = false;
        btn.textContent = "Register";
    });
});