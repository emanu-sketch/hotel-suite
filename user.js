// Global variables
let currentUser = null;
let currentCustomer = null;
let phoneInputInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
    loadDashboard();
    initPhoneInput();
    loadRealReviews();
    loadWeather();
    loadStats();
});

/* ================= INIT PHONE INPUT (NEW) ================= */
function initPhoneInput() {
    const phoneField = document.getElementById("profilePhone");
    if (phoneField && typeof intlTelInput !== 'undefined' && !phoneInputInstance) {
        phoneInputInstance = intlTelInput(phoneField, {
            initialCountry: "us",
            separateDialCode: true,
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
        });
    }
}

/* ================= AUTH ================= */
function checkLogin() {
    // Reset all data first
    resetUserData();
    
    fetch("/me", { credentials: "include" })
    .then(res => {
        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }
        return res.json();
    })
    .then(user => {
        if (user) {
            currentUser = user;
            document.getElementById("usernameWelcome").innerText = `Welcome Back, ${user.username}`;
            loadCustomerProfile();
        }
    })
    .catch(err => {
        console.error("Auth check failed:", err);
        window.location.href = "login.html";
    });
}

/* ================= RESET USER DATA ================= */
function resetUserData() {
    currentUser = null;
    currentCustomer = null;
    
    // Clear profile form
    const profileName = document.getElementById("profileName");
    const profilePhone = document.getElementById("profilePhone");
    if (profileName) profileName.value = "";
    if (profilePhone) profilePhone.value = "";
    
    // Clear booking form
    const bookingRoom = document.getElementById("bookingRoom");
    const checkIn = document.getElementById("checkIn");
    const checkOut = document.getElementById("checkOut");
    if (bookingRoom) bookingRoom.value = "";
    if (checkIn) checkIn.value = "";
    if (checkOut) checkOut.value = "";
    
    // Clear room lists
    const roomList = document.getElementById("roomList");
    const allRoomsList = document.getElementById("allRoomsList");
    const myBookingsList = document.getElementById("myBookingsList");
    if (roomList) roomList.innerHTML = "";
    if (allRoomsList) allRoomsList.innerHTML = "";
    if (myBookingsList) myBookingsList.innerHTML = "";
    
    console.log("User data reset");
}

/* ================= LOAD CUSTOMER PROFILE ================= */
function loadCustomerProfile() {
    fetch(`/customers?user_id=${currentUser?.id}`, { credentials: "include" })
    .then(res => res.json())
    .then(customers => {
        if (customers && customers.length > 0) {
            currentCustomer = customers[0];
            document.getElementById("profileName").value = currentCustomer.name || "";
            document.getElementById("profilePhone").value = currentCustomer.phone || "";
            if (phoneInputInstance && currentCustomer.phone) {
                phoneInputInstance.setNumber(currentCustomer.phone);
            }
        } else {
            // No profile found - clear the form
            currentCustomer = null;
            document.getElementById("profileName").value = "";
            document.getElementById("profilePhone").value = "";
        }
    })
    .catch(err => console.error("Error loading profile:", err));
}

/* ================= SAVE PROFILE with Phone Validation ================= */
function saveProfile() {
    const name = document.getElementById("profileName").value.trim();
    let phone = document.getElementById("profilePhone").value.trim();
    
    // Get full international number from intl-tel-input
    if (phoneInputInstance && typeof phoneInputInstance.getNumber === 'function') {
        phone = phoneInputInstance.getNumber();
    }
    
    // Name validation
    if (!name || name.length < 3) {
        document.getElementById("profileStatus").innerHTML = '<span style="color: red;">Please enter your full name (min 3 characters)</span>';
        return;
    }
    
    // Phone validation
    if (!phone || phone.length < 8) {
        document.getElementById("profileStatus").innerHTML = '<span style="color: red;">Please enter a valid phone number with country code</span>';
        return;
    }
    
    const method = currentCustomer ? "PUT" : "POST";
    const url = currentCustomer ? `/customers/${currentCustomer.id}` : "/customers";
    
    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, phone, user_id: currentUser.id })
    })
    .then(res => res.json())
    .then(data => {
        if (data.id || data.success) {
            currentCustomer = { id: data.id || currentCustomer.id, name, phone };
            document.getElementById("profileStatus").innerHTML = '<span style="color: green;">Profile saved! Redirecting to booking...</span>';
            
            // Redirect to dashboard after 1.5 seconds
            setTimeout(() => {
                switchPage('dashboard');
                document.querySelector('.booking-widget')?.scrollIntoView({ behavior: 'smooth' });
                document.getElementById("profileStatus").innerHTML = '';
            }, 1500);
        }
    })
    .catch(err => {
        console.error("Error saving profile:", err);
        document.getElementById("profileStatus").innerHTML = '<span style="color: red;">Error saving profile</span>';
    });
}

function loadProfile() {
    loadCustomerProfile();
    setTimeout(initPhoneInput, 100);
}

/* ================= DASHBOARD ================= */
function loadDashboard() {
    loadRooms();
    loadBookingSelect();
}

function loadRooms() {
    fetch("/rooms", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById("roomList");
        if (list) {
            list.innerHTML = "";
            data.slice(0, 3).forEach(r => {
                list.innerHTML += `
                    <div class="room-card">
                        <img src="https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400" alt="Room">
                        <div style="padding: 15px;">
                            <h5>Room ${r.number}</h5>
                            <p>${r.type} - $${r.price}/night</p>
                            <button class="save-btn" onclick="quickBook(${r.id})">Book Now</button>
                        </div>
                    </div>`;
            });
        }
    })
    .catch(err => console.error("Failed to load rooms:", err));
}

function loadBookingSelect() {
    fetch("/rooms", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
        const select = document.getElementById("bookingRoom");
        if (select) {
            select.innerHTML = '<option value="">Select a Room</option>';
            data.forEach(r => {
                select.innerHTML += `<option value="${r.id}">Room ${r.number} - ${r.type} ($${r.price}/night)</option>`;
            });
        }
    });
}

function loadAllRooms() {
    fetch("/rooms", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById("allRoomsList");
        if (list) {
            list.innerHTML = "";
            data.forEach(r => {
                list.innerHTML += `
                    <div class="room-card">
                        <img src="https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400" alt="Room">
                        <div style="padding: 15px;">
                            <h5>Room ${r.number}</h5>
                            <p>${r.type} - $${r.price}/night</p>
                            <button class="save-btn" onclick="quickBook(${r.id})">Book Now</button>
                        </div>
                    </div>`;
            });
        }
    });
}

function quickBook(roomId) {
    if (!currentCustomer) {
        alert("Please complete your profile first! Go to My Profile page.");
        switchPage('profile');
        return;
    }
    
    document.getElementById("bookingRoom").value = roomId;
    switchPage('dashboard');
    document.querySelector('.booking-widget')?.scrollIntoView({ behavior: 'smooth' });
}

/* ================= BOOK ROOM with Availability Check ================= */
function bookRoom() {
    if (!currentCustomer) {
        alert("Please complete your profile first! Go to My Profile page.");
        switchPage('profile');
        return;
    }
    
    const roomId = document.getElementById("bookingRoom").value;
    const checkIn = document.getElementById("checkIn").value;
    const checkOut = document.getElementById("checkOut").value;
    
    if (!roomId || !checkIn || !checkOut) {
        alert("Please select a room and dates!");
        return;
    }
    
    if (new Date(checkIn) >= new Date(checkOut)) {
        alert("Check-out must be after check-in");
        return;
    }
    
    fetch("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            customer_id: currentCustomer.id,
            room_id: roomId,
            check_in: checkIn,
            check_out: checkOut
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.total_price) {
            alert(`Reservation Confirmed! Total: $${data.total_price}`);
            document.getElementById("bookingRoom").value = "";
            document.getElementById("checkIn").value = "";
            document.getElementById("checkOut").value = "";
            loadMyBookings();
        } else {
            alert("Booking failed: " + (data.error || "Room may be already booked for these dates"));
        }
    })
    .catch(err => console.error("Booking error:", err));
}

/* ================= MY BOOKINGS ================= */
function loadMyBookings() {
    if (!currentCustomer) {
        const list = document.getElementById("myBookingsList");
        if (list) list.innerHTML = '<p>Complete your profile to see bookings</p>';
        return;
    }
    
    fetch(`/bookings?customer_id=${currentCustomer.id}`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById("myBookingsList");
        if (!list) return;
        
        if (data.length === 0) {
            list.innerHTML = '<p style="color: var(--text-dim);">No bookings yet</p>';
            return;
        }
        
        list.innerHTML = "";
        data.forEach(b => {
            const days = Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24));
            list.innerHTML += `
                <div class="booking-item">
                    <div class="booking-details">
                        <strong>Room ${b.room_number}</strong><br>
                        ${b.check_in} to ${b.check_out} (${days} nights)<br>
                        Total: $${b.total_price}
                    </div>
                    <button class="cancel-btn" onclick="cancelBooking(${b.id})">Cancel</button>
                </div>`;
        });
    })
    .catch(err => console.error("Failed to load bookings:", err));
}

function cancelBooking(bookingId) {
    if (confirm("Cancel this booking?")) {
        fetch(`/bookings/${bookingId}`, {
            method: "DELETE",
            credentials: "include"
        })
        .then(() => {
            alert("Booking cancelled");
            loadMyBookings();
        });
    }
}

/* ================= REAL REVIEWS FROM DATABASE (NEW) ================= */
function loadRealReviews() {
    fetch("/feedback", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('reviewsList');
        if (!container) return;
        if (data.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No reviews yet. Be the first!</p>';
            return;
        }
        container.innerHTML = '';
        data.forEach(review => {
            const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            container.innerHTML += `
                <div class="review-item">
                    <div class="review-stars">${stars}</div>
                    <div class="review-text">"${review.comment}"</div>
                    <div class="review-user">— ${review.username} • ${new Date(review.created_at).toLocaleDateString()}</div>
                </div>
            `;
        });
    });
}

function submitFeedback() {
    const rating = document.getElementById('feedbackRating')?.value;
    const comment = document.getElementById('feedbackComment')?.value;
    if (!comment) {
        alert('Please write your feedback');
        return;
    }
    fetch("/feedback", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, comment })
    }).then(() => {
        alert('Thank you for your feedback!');
        document.getElementById('feedbackComment').value = '';
        loadRealReviews();
    });
}

/* ================= WEATHER & STATS (NEW) ================= */
function loadWeather() {
    fetch("/hotel-settings", { credentials: "include" })
    .then(res => res.json())
    .then(settings => {
        const city = settings.hotel_city || 'Hotel Location';
        const weatherCityEl = document.getElementById('weatherCity');
        if (weatherCityEl) weatherCityEl.innerText = city;
        
        const weatherTempEl = document.getElementById('weatherTemp');
        if (weatherTempEl) weatherTempEl.innerText = '26°C';
        
        const weatherDescEl = document.getElementById('weatherDesc');
        if (weatherDescEl) weatherDescEl.innerText = 'Sunny';
    });
}

function loadStats() {
    fetch("/rooms", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
        const totalRoomsEl = document.getElementById('totalRooms');
        if (totalRoomsEl) totalRoomsEl.innerText = data.length;
    });
}

/* ================= PAGE SWITCHING (FIXED) ================= */
function switchPage(pageName) {
    // Hide all pages
    const pages = ['dashboard', 'rooms', 'feedback', 'my-bookings', 'profile'];
    pages.forEach(page => {
        const el = document.getElementById(`${page}-page`);
        if (el) el.style.display = 'none';
    });
    
    // Show selected page
    const selectedPage = document.getElementById(`${pageName}-page`);
    if (selectedPage) selectedPage.style.display = 'block';
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) activeNav.classList.add('active');
    
    // Load page-specific data
    if (pageName === 'rooms') loadAllRooms();
    if (pageName === 'feedback') loadRealReviews();
    if (pageName === 'my-bookings') loadMyBookings();
    if (pageName === 'profile') { loadProfile(); setTimeout(initPhoneInput, 100); }
}

/* ================= LOGOUT ================= */
function logout() {
    // Reset all data before logging out
    resetUserData();
    
    fetch("/logout", { 
        method: "POST", 
        credentials: "include" 
    })
    .then(() => {
        window.location.href = "login.html";
    });
}

/* ================= TOGGLE FUNCTIONS ================= */
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
}

function toggleTheme() {
    document.body.classList.toggle("dark-theme");
    const icon = document.getElementById('themeIcon');
    if (document.body.classList.contains('dark-theme')) {
        icon.classList.remove('bi-moon-stars-fill');
        icon.classList.add('bi-sun-fill');
    } else {
        icon.classList.remove('bi-sun-fill');
        icon.classList.add('bi-moon-stars-fill');
    }
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.classList.remove('bi-moon-stars-fill');
        icon.classList.add('bi-sun-fill');
    }
}

// Make all functions global for HTML onclick
window.quickBook = quickBook;
window.bookRoom = bookRoom;
window.saveProfile = saveProfile;
window.cancelBooking = cancelBooking;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.submitFeedback = submitFeedback;
window.switchPage = switchPage;
window.loadAllRooms = loadAllRooms;
window.loadMyBookings = loadMyBookings;
window.loadProfile = loadProfile;
window.loadRealReviews = loadRealReviews;
window.initPhoneInput = initPhoneInput;