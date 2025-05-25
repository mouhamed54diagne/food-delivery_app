// Show a section
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = section.id === sectionId ? 'block' : 'none';
    });
}

// Load dashboard stats
function loadDashboard() {
    fetch('http://localhost:3000/api/admin/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-orders').textContent = data.totalOrders;
            document.getElementById('total-restaurants').textContent = data.totalRestaurants;
            
            const tbody = document.querySelector('#recent-orders tbody');
            tbody.innerHTML = '';
            data.recentOrders.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.order_id}</td>
                    <td>${new Date(order.order_date).toLocaleString()}</td>
                    <td>$${order.total_amount}</td>
                    <td>${order.status}</td>
                    <td>${order.restaurant_id}</td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(err => console.error('Error loading dashboard:', err));
}

// Load restaurants
function loadRestaurants() {
    fetch('http://localhost:3000/api/admin/restaurants')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Restaurant data received:', data);
            const tbody = document.querySelector('#restaurant-list tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No restaurants found</td></tr>';
            } else {
                data.forEach(restaurant => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${restaurant.restaurant_id}</td>
                        <td>${restaurant.name}</td>
                        <td>${restaurant.address}</td>
                        <td>${restaurant.cuisine_type}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
            // Update selects for menus
            const restaurantSelect = document.getElementById('menu-restaurant');
            const filterSelect = document.getElementById('filter-restaurant');
            restaurantSelect.innerHTML = '<option value="">Choose a restaurant</option>';
            filterSelect.innerHTML = '<option value="">All restaurants</option>';
            data.forEach(restaurant => {
                restaurantSelect.innerHTML += `<option value="${restaurant.restaurant_id}">${restaurant.name}</option>`;
                filterSelect.innerHTML += `<option value="${restaurant.restaurant_id}">${restaurant.name}</option>`;
            });
        })
        .catch(err => console.error('Error loading restaurants:', err));
}

// Load menus
function loadMenus(restaurantId = '') {
    const url = restaurantId ? `http://localhost:3000/api/admin/menu-items?restaurant_id=${restaurantId}` : 'http://localhost:3000/api/admin/menu-items';
    console.log('Loading menus with URL:', url);
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Menu data received:', data);
            const tbody = document.querySelector('#menu-list tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No dishes found</td></tr>';
            } else {
                data.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.item_id}</td>
                        <td>${item.restaurant_name}</td>
                        <td>${item.name}</td>
                        <td>$${item.price}</td>
                        <td>
                            <button onclick="editMenu(${item.item_id}, ${item.restaurant_id}, '${item.name}', ${item.price})">Edit</button>
                            <button onclick="deleteMenu(${item.item_id})">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        })
        .catch(err => console.error('Error loading menus:', err));
}

// Load orders
function loadOrders(status = '') {
    const url = status ? `http://localhost:3000/api/admin/orders?status=${status}` : 'http://localhost:3000/api/admin/orders';
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const tbody = document.querySelector('#order-list tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8">No orders found</td></tr>';
            } else {
                data.forEach(order => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${order.order_id}</td>
                        <td>${new Date(order.order_date).toLocaleString()}</td>
                        <td>$${order.total_amount}</td>
                        <td>${order.status}</td>
                        <td>${order.restaurant_name}</td>
                        <td>${order.user_name || 'N/A'}</td>
                        <td>${order.agent_name || 'Not assigned'}</td>
                        <td>
                            <button onclick="editOrder(${order.order_id}, '${order.status}')">Edit Status</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
            // Update select for order details
            const orderSelect = document.getElementById('filter-order-id');
            orderSelect.innerHTML = '<option value="">Choose an order</option>';
            data.forEach(order => {
                orderSelect.innerHTML += `<option value="${order.order_id}">Order ${order.order_id}</option>`;
            });
        })
        .catch(err => console.error('Error loading orders:', err));
}

// Load users
function loadUsers() {
    fetch('http://localhost:3000/api/admin/users')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const tbody = document.querySelector('#user-list tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
            } else {
                data.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.user_id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.address}</td>
                        <td>${user.phone}</td>
                        <td>
                            <button onclick="editUser(${user.user_id}, '${user.name}', '${user.email}', '${user.address}', '${user.phone}')">Edit</button>
                            <button onclick="deleteUser(${user.user_id})">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        })
        .catch(err => console.error('Error loading users:', err));
}

// Load delivery agents
function loadAgents() {
    fetch('http://localhost:3000/api/admin/delivery-agents')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const tbody = document.querySelector('#agent-list tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No agents found</td></tr>';
            } else {
                data.forEach(agent => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${agent.agent_id}</td>
                        <td>${agent.name}</td>
                        <td>${agent.phone}</td>
                        <td>${agent.current_location || 'N/A'}</td>
                        <td>${agent.is_available ? 'Available' : 'Not available'}</td>
                        <td>
                            <button onclick="editAgent(${agent.agent_id}, '${agent.name}', '${agent.phone}', '${agent.current_location || ''}', ${agent.is_available})">Edit</button>
                            <button onclick="deleteAgent(${agent.agent_id})">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        })
        .catch(err => console.error('Error loading agents:', err));
}

// Load order details
function loadOrderDetails(orderId = '') {
    const url = orderId ? `http://localhost:3000/api/admin/order-details?order_id=${orderId}` : 'http://localhost:3000/api/admin/order-details';
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const tbody = document.querySelector('#order-details-list tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No order details found</td></tr>';
            } else {
                data.forEach(detail => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${detail.order_detail_id}</td>
                        <td>${detail.order_id}</td>
                        <td>${detail.item_name}</td>
                        <td>${detail.quantity}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        })
        .catch(err => console.error('Error loading order details:', err));
}

// Add a restaurant
document.getElementById('restaurant-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('restaurant-name').value;
    const address = document.getElementById('restaurant-address').value;
    const cuisine = document.getElementById('restaurant-cuisine').value;
    
    fetch('http://localhost:3000/api/admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, cuisine_type: cuisine })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
    })
    .then(() => {
        document.getElementById('restaurant-form').reset();
        loadRestaurants();
    })
    .catch(err => console.error('Error adding restaurant:', err));
});

// Add/Modify a menu
document.getElementById('menu-form').addEventListener('submit', e => {
    e.preventDefault();
    const restaurantId = document.getElementById('menu-restaurant').value;
    const name = document.getElementById('menu-name').value;
    const price = document.getElementById('menu-price').value;
    const itemId = document.getElementById('menu-id').value;
    
    const url = itemId ? `http://localhost:3000/api/admin/menu-items/${itemId}` : 'http://localhost:3000/api/admin/menu-items';
    const method = itemId ? 'PUT' : 'POST';
    
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, name, price })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
    })
    .then(() => {
        document.getElementById('menu-form').reset();
        document.getElementById('menu-id').value = '';
        const currentFilter = document.getElementById('filter-restaurant').value;
        loadMenus(currentFilter || restaurantId);
    })
    .catch(err => console.error('Error adding/modifying menu:', err));
});

// Add/Modify a user
document.getElementById('user-form').addEventListener('submit', e => {
    e.preventDefault();
    const userId = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const address = document.getElementById('user-address').value;
    const phone = document.getElementById('user-phone').value;
    
    const url = userId ? `http://localhost:3000/api/admin/users/${userId}` : 'http://localhost:3000/api/admin/users';
    const method = userId ? 'PUT' : 'POST';
    
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, address, phone })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
    })
    .then(() => {
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = '';
        loadUsers();
    })
    .catch(err => console.error('Error adding/modifying user:', err));
});

// Add/Modify a delivery agent
document.getElementById('agent-form').addEventListener('submit', e => {
    e.preventDefault();
    const agentId = document.getElementById('agent-id').value;
    const name = document.getElementById('agent-name').value;
    const phone = document.getElementById('agent-phone').value;
    const location = document.getElementById('agent-location').value;
    const isAvailable = document.getElementById('agent-availability').value === '1';
    
    const url = agentId ? `http://localhost:3000/api/admin/delivery-agents/${agentId}` : 'http://localhost:3000/api/admin/delivery-agents';
    const method = agentId ? 'PUT' : 'POST';
    
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, current_location: location, is_available: isAvailable })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
    })
    .then(() => {
        document.getElementById('agent-form').reset();
        document.getElementById('agent-id').value = '';
        loadAgents();
    })
    .catch(err => console.error('Error adding/modifying agent:', err));
});

// Edit a menu
function editMenu(id, restaurantId, name, price) {
    document.getElementById('menu-id').value = id;
    document.getElementById('menu-restaurant').value = restaurantId;
    document.getElementById('menu-name').value = name;
    document.getElementById('menu-price').value = price;
}

// Delete a menu
function deleteMenu(id) {
    if (confirm('Do you want to delete this dish?')) {
        fetch(`http://localhost:3000/api/admin/menu-items/${id}`, { method: 'DELETE' })
            .then(() => loadMenus(document.getElementById('filter-restaurant').value))
            .catch(err => console.error('Error deleting menu:', err));
    }
}

// Edit a user
function editUser(id, name, email, address, phone) {
    document.getElementById('user-id').value = id;
    document.getElementById('user-name').value = name;
    document.getElementById('user-email').value = email;
    document.getElementById('user-address').value = address;
    document.getElementById('user-phone').value = phone;
}

// Delete a user
function deleteUser(id) {
    if (confirm('Do you want to delete this user?')) {
        fetch(`http://localhost:3000/api/admin/users/${id}`, { method: 'DELETE' })
            .then(() => loadUsers())
            .catch(err => console.error('Error deleting user:', err));
    }
}

// Edit an agent
function editAgent(id, name, phone, location, isAvailable) {
    document.getElementById('agent-id').value = id;
    document.getElementById('agent-name').value = name;
    document.getElementById('agent-phone').value = phone;
    document.getElementById('agent-location').value = location;
    document.getElementById('agent-availability').value = isAvailable ? '1' : '0';
}

// Delete an agent
function deleteAgent(id) {
    if (confirm('Do you want to delete this agent?')) {
        fetch(`http://localhost:3000/api/admin/delivery-agents/${id}`, { method: 'DELETE' })
            .then(() => loadAgents())
            .catch(err => console.error('Error deleting agent:', err));
    }
}

// Edit order status
function editOrder(id, currentStatus) {
    const newStatus = prompt('New status (pending, in delivery, delivered, canceled):', currentStatus);
    if (newStatus && ['pending', 'in delivery', 'delivered', 'canceled'].includes(newStatus)) {
        fetch(`http://localhost:3000/api/admin/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(() => {
            loadOrders(document.getElementById('filter-order-status').value);
        })
        .catch(err => console.error('Error modifying status:', err));
    }
}

// Filter menus
document.getElementById('filter-restaurant').addEventListener('change', e => {
    loadMenus(e.target.value);
});

// Filter orders
document.getElementById('filter-order-status').addEventListener('change', e => {
    loadOrders(e.target.value);
});

// Filter order details
document.getElementById('filter-order-id').addEventListener('change', e => {
    loadOrderDetails(e.target.value);
});

// Initialization
loadDashboard();
loadRestaurants();
loadMenus();
loadOrders();
loadUsers();
loadAgents();
loadOrderDetails();
showSection('dashboard');