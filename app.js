// 🔐 AUTH & ROLE CHECK - Must be admin or manager
fetch("/me", { credentials: "include" })
.then(res => {
    if (res.status === 401) {
        window.location.href = "login.html";
        return;
    }
    return res.json();
})
.then(user => {
    if (user && user.role !== "admin" && user.role !== "manager") {
        window.location.href = "user.html";
    }
});

document.addEventListener("DOMContentLoaded", () => {

    /* ================= ROOMS ================= */
    function loadRoomTable() {
        fetch("/rooms", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("roomTable");
            if (!table) return;

            table.innerHTML = "";
            data.forEach(r => {
                table.innerHTML += `
                    <tr>
                        <td>${r.number}</td>
                        <td>${r.type}</td>
                        <td>$${r.price}</td>
                        <td><button class="btn-danger" style="padding: 0.25rem 0.75rem;" onclick="deleteRoom(${r.id})">Delete</button></td>
                    </tr>`;
            });
        })
        .catch(err => console.error("Error loading rooms:", err));
    }

    /* ================= CUSTOMERS ================= */
    function loadCustomers() {
        fetch("/customers", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("customerTable");
            if (!table) return;

            table.innerHTML = "";
            if (data.length === 0) {
                table.innerHTML = '<tr><td colspan="3">No customers yet</td></tr>';
            }
            data.forEach(c => {
                table.innerHTML += `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.phone}</td>
                        <td>${c.username || 'User #' + c.user_id || 'N/A'}</td>
                    </tr>`;
            });
        })
        .catch(err => console.error("Error loading customers:", err));
    }

    function loadCustomerSelect() {
        fetch("/customers", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById("customerSelect");
            if (!select) return;
            window.allCustomers = data;
            updateCustomerDropdown(data);
        });
    }
    
    function updateCustomerDropdown(customers) {
        const select = document.getElementById("customerSelect");
        if (!select) return;
        select.innerHTML = '<option value="">-- Select Customer --</option>';
        customers.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name} (${c.phone})</option>`;
        });
    }
    
    function searchCustomers() {
        const searchTerm = document.getElementById("customerSearch")?.value.toLowerCase() || "";
        if (window.allCustomers) {
            const filtered = window.allCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm) || 
                c.phone.includes(searchTerm)
            );
            updateCustomerDropdown(filtered);
        }
    }

    /* ================= ROOMS DROPDOWN with Availability ================= */
    let allRooms = [];
    let currentBookings = [];
    
    function loadRoomsWithAvailability() {
        Promise.all([
            fetch("/rooms", { credentials: "include" }).then(r => r.json()),
            fetch("/bookings", { credentials: "include" }).then(r => r.json())
        ]).then(([rooms, bookings]) => {
            allRooms = rooms;
            currentBookings = bookings;
            updateRoomDropdown(allRooms);
        });
    }
    
    function updateRoomDropdown(rooms) {
        const select = document.getElementById("bookingRoom");
        if (!select) return;
        
        const checkIn = document.getElementById("checkIn")?.value;
        const checkOut = document.getElementById("checkOut")?.value;
        
        select.innerHTML = '<option value="">-- Select Room --</option>';
        
        rooms.forEach(room => {
            let isAvailable = true;
            let statusText = "";
            
            if (checkIn && checkOut) {
                const conflicting = currentBookings.some(booking => 
                    booking.room_id === room.id && 
                    booking.status === 'active' &&
                    ((checkIn >= booking.check_in && checkIn < booking.check_out) ||
                     (checkOut > booking.check_in && checkOut <= booking.check_out) ||
                     (checkIn <= booking.check_in && checkOut >= booking.check_out))
                );
                isAvailable = !conflicting;
                statusText = isAvailable ? "✅ Available" : "❌ Booked";
            }
            
            select.innerHTML += `<option value="${room.id}" ${!isAvailable ? 'disabled style="opacity:0.5;"' : ''}>
                Room ${room.number} - ${room.type} ($${room.price}/night) ${statusText}
            </option>`;
        });
    }
    
    function searchRooms() {
        const searchTerm = document.getElementById("roomSearch")?.value.toLowerCase() || "";
        const filtered = allRooms.filter(r => 
            r.number.toLowerCase().includes(searchTerm) || 
            r.type.toLowerCase().includes(searchTerm)
        );
        updateRoomDropdown(filtered);
    }
    
    function checkAvailability() {
        updateRoomDropdown(allRooms);
    }

    /* ================= BOOKINGS ================= */
    function loadBookings() {
        fetch("/bookings", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("bookingTable");
            if (!table) return;

            table.innerHTML = "";
            if (data.length === 0) {
                table.innerHTML = '<tr><td colspan="6">No bookings yet</td></tr>';
            }
            data.forEach(b => {
                const days = Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24));
                table.innerHTML += `
                    <tr>
                        <td>${b.room_number}</td>
                        <td>${b.customer_name}</td>
                        <td>${b.check_in}</td>
                        <td>${b.check_out}</td>
                        <td>$${b.total_price || (b.room_price * days)}</td>
                        <td><button class="btn-danger" style="padding: 0.25rem 0.75rem;" onclick="deleteBooking(${b.id})">Cancel</button></td>
                    </tr>`;
            });
        });
    }

    /* ================= FORMS ================= */

    // ROOMS - Close modal after adding
    const roomForm = document.getElementById("roomForm");
    if (roomForm) {
        roomForm.onsubmit = e => {
            e.preventDefault();

            const number = document.getElementById("roomNumber").value;
            const type = document.getElementById("roomType").value;
            const price = document.getElementById("roomPrice").value;

            fetch("/rooms", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                credentials: "include",
                body: JSON.stringify({ number, type, price })
            }).then(() => {
                roomForm.reset();
                loadRoomTable();
                loadRoomsWithAvailability();
                loadDashboard();
                // Close modal
                const modal = document.getElementById('addModal');
                if (modal) modal.style.display = 'none';
         
            }).catch(err => console.error("Error adding room:", err));
        };
    }

    // CUSTOMERS - Close modal after adding with phone validation
    const customerForm = document.getElementById("customerForm");
    if (customerForm) {
        customerForm.onsubmit = e => {
            e.preventDefault();

            const name = document.getElementById("customerNameInput").value.trim();
            let phone = document.getElementById("customerPhoneInput").value.trim();
            
            // Phone validation with country code
            const phoneRegex = /^[\+\d\s\-\(\)]{10,20}$/;
            if (!phoneRegex.test(phone)) {
                alert('Please enter a valid phone number with country code (e.g., +1 234 567 8900)');
                return;
            }

            fetch("/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name, phone })
            })
            .then(res => {
                if (res.status === 401) {
                    window.location.href = "login.html";
                    return;
                }
                return res.json();
            })
            .then(() => {
                customerForm.reset();
                loadCustomers();
                loadCustomerSelect();
                loadDashboard();
                // Close modal
                const modal = document.getElementById('addModal');
                if (modal) modal.style.display = 'none';
           
            }).catch(err => console.error("Error adding customer:", err));
        };
    }

    // BOOKINGS - With availability check
    const bookingForm = document.getElementById("bookingForm");
    if (bookingForm) {
        bookingForm.onsubmit = e => {
            e.preventDefault();

            const roomId = document.getElementById("bookingRoom").value;
            const customerId = document.getElementById("customerSelect").value;
            const checkIn = document.getElementById("checkIn").value;
            const checkOut = document.getElementById("checkOut").value;

            if (!roomId || !customerId || !checkIn || !checkOut) {
                alert("Fill all fields");
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
                    customer_id: customerId,
                    room_id: roomId,
                    check_in: checkIn,
                    check_out: checkOut
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.total_price) {
                                       bookingForm.reset();
                    document.getElementById('checkIn').value = '';
                    document.getElementById('checkOut').value = '';
                    // Close modal
                    const modal = document.getElementById('addModal');
                    if (modal) modal.style.display = 'none';
                    loadBookings();
                    loadDashboard();
                    loadRoomsWithAvailability();
                } else if (data.error) {
                    alert(data.error);
                }
            }).catch(err => console.error("Error creating booking:", err));
        };
    }

    // Add event listeners for date inputs to check availability
    const checkInInput = document.getElementById("checkIn");
    const checkOutInput = document.getElementById("checkOut");
    if (checkInInput && checkOutInput) {
        checkInInput.addEventListener('change', checkAvailability);
        checkOutInput.addEventListener('change', checkAvailability);
    }

    /* ================= INIT ================= */
    if (document.getElementById("roomTable")) loadRoomTable();
    if (document.getElementById("customerTable")) loadCustomers();
    if (document.getElementById("customerSelect")) loadCustomerSelect();
    if (document.getElementById("bookingRoom")) loadRoomsWithAvailability();
    if (document.getElementById("bookingTable")) loadBookings();
    if (document.getElementById("totalRooms")) loadDashboard();
    
    // Auto-refresh customers every 5 seconds
    if (document.getElementById("customerTable")) {
        setInterval(() => {
            loadCustomers();
            loadDashboard();
        }, 5000);
    }
});

/* ================= DELETE ================= */
function deleteRoom(id) {
  {
        fetch(`/rooms/${id}`, {
            method: "DELETE",
            credentials: "include"
        }).then(() => location.reload());
    }
}

function deleteBooking(id) {
     {
        fetch(`/bookings/${id}`, {
            method: "DELETE",
            credentials: "include"
        }).then(() => location.reload());
    }
}

/* ================= DASHBOARD ================= */
function loadDashboard() {
    fetch("/rooms", { credentials: "include" })
    .then(res => res.json())
    .then(d => {
        const totalRooms = document.getElementById("totalRooms");
        if (totalRooms) totalRooms.innerText = d.length;
    });

    fetch("/customers", { credentials: "include" })
    .then(res => res.json())
    .then(d => {
        const totalCustomers = document.getElementById("totalCustomers");
        if (totalCustomers) totalCustomers.innerText = d.length;
    });

    fetch("/bookings", { credentials: "include" })
    .then(res => res.json())
    .then(d => {
        const totalBookings = document.getElementById("totalBookings");
        if (totalBookings) totalBookings.innerText = d.length;
    });
}

/* ================= LOGOUT ================= */
function logout() {
    fetch("/logout", {
        method: "POST",
        credentials: "include"
    }).then(() => {
        window.location.href = "login.html";
    });
}