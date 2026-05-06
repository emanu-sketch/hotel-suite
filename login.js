const form = document.getElementById("loginForm");
const btn = document.getElementById("loginBtn");
const errorDiv = document.getElementById("error");

form.addEventListener("submit", e => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    errorDiv.textContent = "";

    if (!username || !password) {
        errorDiv.textContent = "Fill all fields";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Logging in...";

    fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({ username, password })
    })
    .then(async res => {
        const data = await res.json();

        if (!res.ok) {
            errorDiv.textContent = data.error || "Login failed";
            btn.disabled = false;
            btn.textContent = "Login";
            return;
        }

        console.log("User role:", data.role);
        const urlParams = new URLSearchParams(window.location.search);
const redirect = urlParams.get('redirect');
        // ✅ Fix: Redirect based on role
        if (data.role === "admin") {
            window.location.href = "index.html";
        } else if (data.role === "manager") {
            window.location.href = "manager.html";
        } else {
            window.location.href = "user.html";
        }
    })
    .catch(err => {
        console.error(err);
        errorDiv.textContent = "Login failed";
        btn.disabled = false;
        btn.textContent = "Login";
    });
});