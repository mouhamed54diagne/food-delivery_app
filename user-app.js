// API Configuration
const API_URL = 'http://localhost:3000/api';

// Global variables
let currentUser = null;
let token = '';
let cart = {
    restaurant_id: null,
    restaurant_name: '',
    items: []
};
let currentRestaurant = null;
let currentOrderForPayment = null;

// Application initialization
document.addEventListener('DOMContentLoaded', () => {
    // Authentication forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('profile-form').addEventListener('submit', updateProfile);
    
    // Initialize review system
    setupReviewSystem();
    
    // Initialize payment system
    setupPaymentSystem();
    
    // Create review modal
    createReviewModal();
    
    // Handle modal closing by clicking outside
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('review-modal');
        if (e.target === modal) {
            closeReviewModal();
        }
    });
    
    // Check if user is connected
    checkAuth();

    // Ensure Order button is properly linked
    const orderBtn = document.getElementById('place-order-btn');
    if (orderBtn) {
        // Remove old event handler if it exists
        const newOrderBtn = orderBtn.cloneNode(true);
        orderBtn.parentNode.replaceChild(newOrderBtn, orderBtn);
        
        // Add new event handler
        newOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Order button clicked");
            placeOrder();
        });
    } else {
        console.error("Order button not found in DOM");
        
        // If button doesn't exist in DOM, try to add it
        const cartContent = document.getElementById('cart-content');
        if (cartContent) {
            const cartTotal = cartContent.querySelector('.cart-total');
            if (cartTotal) {
                const orderBtn = document.createElement('button');
                orderBtn.id = 'place-order-btn';
                orderBtn.className = 'btn-order';
                orderBtn.textContent = 'Place Order';
                
                orderBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log("Order button clicked");
                    placeOrder();
                });
                
                cartTotal.after(orderBtn);
                console.log("Order button added dynamically");
            }
        }
    }
    
    // Initialize additional elements for order and tracking features
    initializeAdditionalElements();
});

// Add payment method form handler
document.addEventListener('DOMContentLoaded', () => {
    // Add this to existing initializations
    const paymentMethodForm = document.getElementById('payment-method-form');
    if (paymentMethodForm) {
        paymentMethodForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addPaymentMethod();
        });
    }
    
    // Same for profile payment form
    const profilePaymentForm = document.getElementById('profile-payment-form');
    if (profilePaymentForm) {
        profilePaymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addProfilePaymentMethod();
        });
    }
});

// Add payment method function
function addPaymentMethod() {
    const provider = document.getElementById('payment-provider').value;
    const cardNumber = document.getElementById('card-number').value;
    const cardExpiry = document.getElementById('card-expiry').value;
    const cardHolder = document.getElementById('card-holder').value;
    const isDefault = document.getElementById('card-default').checked;
    
    if (!provider || !cardNumber || !cardExpiry || !cardHolder) {
        alert('Please fill in all required fields');
        return;
    }

    // Disable button during submission to avoid multiple clicks
    const submitBtn = document.querySelector('#payment-method-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';
    }
    
    const paymentData = {
        provider,
        card_number: cardNumber,
        expiry_date: cardExpiry,
        card_holder: cardHolder,
        is_default: isDefault
    };
    
    console.log('Adding payment method:', paymentData);
    
    fetch(`${API_URL}/payment-methods`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Error adding payment method');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Payment method added:', data);
        
        // Reset form
        document.getElementById('payment-method-form').reset();
        
        // Show success message
        const messageElement = document.getElementById('payment-method-message');
        if (messageElement) {
            messageElement.textContent = 'Card added successfully';
            messageElement.className = 'message success';
            
            // Hide message after a few seconds
            setTimeout(() => {
                messageElement.textContent = '';
                messageElement.className = 'message';
            }, 3000);
        }
        
        // WARNING: Wait a bit before reloading to avoid conflicts
        setTimeout(() => {
            loadUserPaymentMethods();
        }, 500);
    })
    .catch(err => {
        console.error('Error adding payment method:', err);
        const messageElement = document.getElementById('payment-method-message');
        if (messageElement) {
            messageElement.textContent = err.message;
            messageElement.className = 'message error';
        }
    })
    .finally(() => {
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add this card';
        }
    });
}

// Similar function for profile payment form
function addProfilePaymentMethod() {
    const provider = document.getElementById('profile-payment-provider').value;
    const cardNumber = document.getElementById('profile-card-number').value;
    const cardExpiry = document.getElementById('profile-card-expiry').value;
    const cardHolder = document.getElementById('profile-card-holder').value;
    const isDefault = document.getElementById('profile-card-default').checked;
    
    // Same logic as above...
}

// Authentication functions
function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.auth-form').forEach(form => {
        form.style.display = 'none';
    });
    
    document.querySelector(`.tab-btn[onclick="showTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-tab`).style.display = 'block';
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    document.getElementById('login-error').textContent = '';
    
    fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Login error');
            });
        }
    })
    .then(data => {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        showUserInterface();
    })
    .catch(err => {
        document.getElementById('login-error').textContent = err.message;
    });
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const address = document.getElementById('register-address').value;
    const phone = document.getElementById('register-phone').value;
    
    document.getElementById('register-error').textContent = '';
    
    fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, address, phone })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Registration error');
            });
        }
    })
    .then(() => {
        // After successful registration, login automatically
        return fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
    })
    .then(response => response.json())
    .then(data => {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        showUserInterface();
    })
    .catch(err => {
        document.getElementById('register-error').textContent = err.message;
    });
}

function checkAuth() {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        
        // Check if token is valid
        fetch(`${API_URL}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                showUserInterface();
                return response.json();
            } else {
                // Token expired or invalid
                logout();
                throw new Error('Session expired');
            }
        })
        .then(data => {
            // Update user info
            currentUser = data;
            localStorage.setItem('user', JSON.stringify(currentUser));
        })
        .catch(() => {
            // Silent, already handled
        });
    }
}

function logout() {
    token = '';
    currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    cart = { restaurant_id: null, restaurant_name: '', items: [] };
    saveCart();
    
    // Return to login screen
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('app-section').style.display = 'none';
    
    // Reset forms
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

function showUserInterface() {
    // Display user name
    document.getElementById('header-username').textContent = currentUser.name;
    
    // Hide auth screen and show application
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    
    // Load initial content
    loadRestaurants();
    loadCuisineTypes();
    loadCart();
    loadOrders();
    loadProfile();
    loadDeliveryAgents();
    loadSuggestions();
    
    // Show restaurants page by default
    showPage('restaurants');
}

// Navigation
function showPage(pageId) {
    console.log(`Showing page: ${pageId}`);
    
    // If leaving payment page without paying, offer to cancel
    if (window.pendingOrderData && pageId !== 'payment') {
        const confirmCancel = confirm('Do you want to cancel the pending order?');
        if (confirmCancel) {
            delete window.pendingOrderData;
            console.log('Pending order cancelled by user');
        } else {
            // Stay on payment page
            return;
        }
    }
    
    // Update navigation
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
    });
    
    if (pageId !== 'restaurant-menu' && pageId !== 'payment') {
        const navLink = document.querySelector(`nav a[onclick="showPage('${pageId}')"]`);
        if (navLink) {
            navLink.classList.add('active');
        }
    }
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    // Show selected page
    if (pageId === 'restaurant-menu') {
        document.getElementById('restaurant-menu-page').style.display = 'block';
    } else if (pageId === 'payment') {
        document.getElementById('payment-page').style.display = 'block';
    } else {
        document.getElementById(`${pageId}-page`).style.display = 'block';
    }
    
    // Page-specific actions
    if (pageId === 'cart') {
        updateCartDisplay();
    } else if (pageId === 'orders') {
        loadOrders();
    } else if (pageId === 'suggestions') {
        loadSuggestions();
    }
}

// Rating and review system
function setupReviewSystem() {
    // Initialize event listeners for rating stars
    const starContainers = document.querySelectorAll('.star-rating');
    
    starContainers.forEach(container => {
        const stars = container.querySelectorAll('.star');
        const ratingInput = container.closest('form').querySelector('input[type="hidden"]');
        
        stars.forEach(star => {
            // Hover event
            star.addEventListener('mouseover', function() {
                const rating = this.getAttribute('data-rating');
                highlightStars(stars, rating);
            });
            
            // Mouse leave event
            container.addEventListener('mouseout', function() {
                const currentRating = ratingInput.value;
                if (currentRating > 0) {
                    highlightStars(stars, currentRating);
                } else {
                    resetStars(stars);
                }
            });
            
            // Click event
            star.addEventListener('click', function() {
                const rating = this.getAttribute('data-rating');
                ratingInput.value = rating;
                
                // Add 'selected' class for animation
                this.classList.add('selected');
                setTimeout(() => {
                    this.classList.remove('selected');
                }, 300);
                
                // Highlight permanently
                highlightStars(stars, rating);
                
                // Show visual feedback
                const ratingText = container.parentElement.querySelector('.rating-text');
                if (ratingText) {
                    ratingText.textContent = getRatingText(rating);
                    ratingText.style.display = 'block';
                }
            });
        });
    });
    
    // Review form submission
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitReview();
        });
    }
    
    // Load rating summaries if section exists
    const ratingSummary = document.getElementById('rating-summary');
    if (ratingSummary && currentRestaurant) {
        loadRatingSummary(currentRestaurant.id);
    }
}

// Helper functions for rating system
function highlightStars(stars, rating) {
    stars.forEach(star => {
        if (star.getAttribute('data-rating') <= rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function resetStars(stars) {
    stars.forEach(star => {
        star.classList.remove('active');
    });
}

function getRatingText(rating) {
    const texts = {
        '1': 'Poor',
        '2': 'Fair',
        '3': 'Good',
        '4': 'Very good',
        '5': 'Excellent'
    };
    return texts[rating] || '';
}

function loadRatingSummary(restaurantId) {
    fetch(`${API_URL}/restaurants/${restaurantId}/reviews`)
    .then(response => response.json())
    .then(data => {
        if (!data.reviews || data.reviews.length === 0) return;
        
        // Calculate rating counts
        const ratingCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
        data.reviews.forEach(review => {
            ratingCounts[review.rating] = (ratingCounts[review.rating] || 0) + 1;
        });
        
        // Convert avg_rating to number to avoid toFixed error
        const avgRating = parseFloat(data.avg_rating) || 0;
        
        // Update rating summary
        const summaryContainer = document.getElementById('rating-summary');
        if (!summaryContainer) return;
        
        let summaryHTML = `
            <div class="rating-summary">
                <div class="average-rating">${avgRating.toFixed(1)}</div>
                <div class="rating-breakdown">
        `;
        
        for (let i = 5; i >= 1; i--) {
            const count = ratingCounts[i] || 0;
            const percentage = data.reviews.length > 0 ? (count / data.reviews.length) * 100 : 0;
            
            summaryHTML += `
                <div class="rating-bar">
                    <div class="rating-label">${i} ★</div>
                    <div class="rating-progress">
                        <div class="rating-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="rating-count">${count}</div>
                </div>
            `;
        }
        
        summaryHTML += `
                </div>
            </div>
        `;
        
        summaryContainer.innerHTML = summaryHTML;
    })
    .catch(err => {
        console.error('Error loading rating summary:', err);
    });
}

// Enhanced function for star display
function renderStars(rating) {
    rating = parseFloat(rating);
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let starsHTML = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<span class="star filled">★</span>';
    }
    
    // Half star if needed
    if (halfStar) {
        starsHTML += '<span class="star half">★</span>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<span class="star">☆</span>';
    }
    
    return starsHTML;
}

function loadRestaurantReviews(restaurantId) {
    fetch(`${API_URL}/restaurants/${restaurantId}/reviews`)
    .then(response => response.json())
    .then(data => {
        const reviews = data.reviews;
        const avgRating = data.avg_rating;
        const totalReviews = data.total_reviews;
        
        // Update restaurant stars
        const starsContainer = document.getElementById('restaurant-stars');
        if (starsContainer) {
            starsContainer.innerHTML = renderStars(avgRating);
        }
        
        // Update review count
        const ratingCount = document.getElementById('restaurant-rating-count');
        if (ratingCount) {
            ratingCount.textContent = `(${totalReviews} reviews)`;
        }
        
        // Add rating summary
        const reviewsSection = document.querySelector('.reviews-section');
        if (reviewsSection && !document.getElementById('rating-summary')) {
            const summaryDiv = document.createElement('div');
            summaryDiv.id = 'rating-summary';
            reviewsSection.insertBefore(summaryDiv, reviewsSection.firstChild);
            loadRatingSummary(restaurantId);
        }
        
        // Display reviews
        const reviewsContainer = document.getElementById('reviews-container');
        if (!reviewsContainer) return;
        
        reviewsContainer.innerHTML = '';
        
        if (reviews.length === 0) {
            reviewsContainer.innerHTML = '<p class="review-empty">No reviews for this restaurant yet. Be the first to share your opinion!</p>';
            return;
        }
        
        reviews.forEach(review => {
            const reviewElement = document.createElement('div');
            reviewElement.className = 'review';
            
            // Date formatting
            const reviewDate = new Date(review.review_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Create initial for avatar
            const initial = review.user_name ? review.user_name.charAt(0).toUpperCase() : '?';
            
            reviewElement.innerHTML = `
                <div class="review-header">
                    <div class="reviewer-info">
                        <div class="reviewer-avatar">${initial}</div>
                        <div>
                            <div class="reviewer-name">${review.user_name}</div>
                            <div class="review-date">${reviewDate}</div>
                        </div>
                    </div>
                    <div class="review-rating">
                        ${renderStars(review.rating)}
                    </div>
                </div>
                <div class="review-content">
                    ${review.comment ? `<p>${review.comment}</p>` : '<p class="no-comment">No comment.</p>'}
                </div>
            `;
            
            reviewsContainer.appendChild(reviewElement);
        });
    })
    .catch(err => {
        console.error('Error loading reviews:', err);
        const reviewsContainer = document.getElementById('reviews-container');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = 
                '<p>An error occurred while loading reviews.</p>';
        }
    });
}

function submitReview() {
    const rating = document.getElementById('review-rating').value;
    const comment = document.getElementById('review-comment').value;
    const orderIdField = document.getElementById('review-order-id');
    const orderId = orderIdField ? orderIdField.value : null;
    
    if (!rating || rating === '0') {
        alert('Please give a rating before submitting.');
        return;
    }
    
    if (!currentRestaurant) {
        alert('An error occurred. Restaurant not identified.');
        return;
    }
    
    const reviewData = {
        restaurant_id: currentRestaurant.id,
        rating: parseInt(rating),
        comment: comment
    };
    
    // Add order ID if available
    if (orderId) {
        reviewData.order_id = orderId;
    }
    
    fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reviewData)
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Error adding review');
            });
        }
    })
    .then(() => {
        // Reset form
        document.getElementById('review-rating').value = '0';
        document.getElementById('review-comment').value = '';
        document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        
        // Remove order ID from form
        const orderIdField = document.getElementById('review-order-id');
        if (orderIdField) {
            orderIdField.value = '';
        }
        
        // Show success message
        const messageElement = document.getElementById('review-message');
        messageElement.textContent = 'Your review has been added successfully.';
        messageElement.className = 'message success';
        
        // Reload reviews
        loadRestaurantReviews(currentRestaurant.id);
        
        // Hide message after a few seconds
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'message';
        }, 3000);
    })
    .catch(err => {
        const messageElement = document.getElementById('review-message');
        messageElement.textContent = err.message;
        messageElement.className = 'message error';
    });
}

// Restaurants
function loadRestaurants() {
    console.log('Loading restaurants...');
    
    fetch(`${API_URL}/restaurants`)
    .then(response => response.json())
    .then(restaurants => {
        console.log('Restaurants received:', restaurants);
        
        const container = document.getElementById('restaurants-grid');
        container.innerHTML = '';
        
        if (restaurants.length === 0) {
            container.innerHTML = '<p>No restaurants available at the moment.</p>';
            return;
        }
        
        restaurants.forEach(restaurant => {
            const card = document.createElement('div');
            card.className = 'restaurant-card';
            
            // Random image for each restaurant (for example)
            const imgNum = Math.floor(Math.random() * 5) + 1;
            
            const safeAddress = restaurant.address ? restaurant.address.replace(/'/g, "\\'") : '';
            const safeCuisine = restaurant.cuisine_type ? restaurant.cuisine_type.replace(/'/g, "\\'") : '';
            const safeName = restaurant.name.replace(/'/g, "\\'");
            
            // CORRECTION: More robust verification of ratings
            const avgRating = parseFloat(restaurant.avg_rating) || 0;
            const reviewCount = parseInt(restaurant.review_count) || 0;
            
            console.log(`Restaurant ${restaurant.name}:`, {
                avg_rating: restaurant.avg_rating,
                review_count: restaurant.review_count,
                avgRating: avgRating,
                reviewCount: reviewCount
            });
            
            // Badges for new restaurants or top rated
            let badges = '';
            if (avgRating >= 4.5 && reviewCount >= 5) {
                badges = '<span class="top-rated-badge">Top Rated</span>';
            }
            
            // CORRECTION: Rating display logic
            let ratingDisplay = '';
            if (reviewCount > 0 && avgRating > 0) {
                // There are reviews
                ratingDisplay = `
                    <div class="restaurant-card-rating">
                        <div class="stars-container">
                            ${renderStars(avgRating)}
                        </div>
                        <span class="rating-value">${avgRating.toFixed(1)}</span>
                        <span class="rating-count">(${reviewCount} reviews)</span>
                    </div>
                `;
            } else {
                // No reviews yet
                ratingDisplay = '<span class="no-rating">No reviews yet</span>';
            }
            
            card.innerHTML = `
                <div class="restaurant-image" style="background-image: url('https://source.unsplash.com/random/300x180/?restaurant,food,${imgNum}')">
                    ${badges}
                </div>
                <div class="restaurant-info">
                    <h3>${restaurant.name}</h3>
                    <p>${restaurant.address || 'Address not available'}</p>
                    <div class="restaurant-meta-info">
                        ${restaurant.cuisine_type ? `<span class="cuisine-type">${restaurant.cuisine_type}</span>` : ''}
                        ${ratingDisplay}
                    </div>
                    <button class="btn-view" onclick="viewRestaurant(${restaurant.restaurant_id}, '${safeName}', '${safeAddress}', '${safeCuisine}')">View menu</button>
                </div>
            `;
            
            container.appendChild(card);
        });
    })
    .catch(err => {
        console.error('Error loading restaurants:', err);
        const container = document.getElementById('restaurants-grid');
        container.innerHTML = '<p>Error loading restaurants.</p>';
    });
}

// Utility function to safely format ratings
function formatRating(rating, decimals = 1) {
    const numericRating = parseFloat(rating);
    if (isNaN(numericRating)) return '0.0';
    return numericRating.toFixed(decimals);
}

function loadCuisineTypes() {
    fetch(`${API_URL}/cuisine-types`)
    .then(response => response.json())
    .then(cuisines => {
        const select = document.getElementById('cuisine-select');
        select.innerHTML = '<option value="">All cuisines</option>';
        
        cuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = cuisine;
            option.textContent = cuisine;
            select.appendChild(option);
        });
    })
    .catch(err => console.error('Error loading cuisine types:', err));
}

function filterRestaurants() {
    const cuisineType = document.getElementById('cuisine-select').value;
    let url = `${API_URL}/restaurants`;
    
    if (cuisineType) {
        url += `?cuisine_type=${encodeURIComponent(cuisineType)}`;
    }
    
    console.log('Filtering restaurants, URL:', url);
    
    fetch(url)
    .then(response => response.json())
    .then(restaurants => {
        console.log('Filtered restaurants received:', restaurants);
        
        const container = document.getElementById('restaurants-grid');
        container.innerHTML = '';
        
        if (restaurants.length === 0) {
            container.innerHTML = '<p>No restaurants match this filter.</p>';
            return;
        }
        
        restaurants.forEach(restaurant => {
            const card = document.createElement('div');
            card.className = 'restaurant-card';
            
            const imgNum = Math.floor(Math.random() * 5) + 1;
            
            const safeAddress = restaurant.address ? restaurant.address.replace(/'/g, "\\'") : '';
            const safeCuisine = restaurant.cuisine_type ? restaurant.cuisine_type.replace(/'/g, "\\'") : '';
            const safeName = restaurant.name.replace(/'/g, "\\'");
            
            // SAME CORRECTION HERE
            const avgRating = parseFloat(restaurant.avg_rating) || 0;
            const reviewCount = parseInt(restaurant.review_count) || 0;
            
            console.log(`Filtered restaurant ${restaurant.name}:`, {
                avg_rating: restaurant.avg_rating,
                review_count: restaurant.review_count,
                avgRating: avgRating,
                reviewCount: reviewCount
            });
            
            let ratingDisplay = '';
            if (reviewCount > 0 && avgRating > 0) {
                ratingDisplay = `
                    <div class="restaurant-card-rating">
                        <div class="stars-container">
                            ${renderStars(avgRating)}
                        </div>
                        <span class="rating-value">${avgRating.toFixed(1)}</span>
                        <span class="rating-count">(${reviewCount} reviews)</span>
                    </div>
                `;
            } else {
                ratingDisplay = '<span class="no-rating">No reviews yet</span>';
            }
            
            card.innerHTML = `
                <div class="restaurant-image" style="background-image: url('https://source.unsplash.com/random/300x180/?restaurant,food,${imgNum}')"></div>
                <div class="restaurant-info">
                    <h3>${restaurant.name}</h3>
                    <p>${restaurant.address}</p>
                    <div class="restaurant-meta-info">
                        ${restaurant.cuisine_type ? `<span class="cuisine-type">${restaurant.cuisine_type}</span>` : ''}
                        ${ratingDisplay}
                    </div>
                    <button class="btn-view" onclick="viewRestaurant(${restaurant.restaurant_id}, '${safeName}', '${safeAddress}', '${safeCuisine}')">View menu</button>
                </div>
            `;
            
            container.appendChild(card);
        });
    })
    .catch(err => {
        console.error('Error filtering restaurants:', err);
        const container = document.getElementById('restaurants-grid');
        container.innerHTML = '<p>Error loading filtered restaurants.</p>';
    });
}

// ADD this function to force restaurant data update:
function refreshRestaurantData() {
    console.log('Refreshing restaurant data...');
    
    // Clear cache if any
    if ('caches' in window) {
        caches.delete('restaurants-cache').then(() => {
            console.log('Restaurant cache cleared');
        });
    }
    
    // Reload restaurants
    loadRestaurants();
}

// ADD this function to call after review publication:
function refreshAfterReview() {
    console.log('Refreshing after review publication...');
    
    // Wait a bit for database to update
    setTimeout(() => {
        refreshRestaurantData();
    }, 1000);
}

function loadSuggestions() {
    console.log('Loading suggestions...');
    
    // Show loading indicator
    const container = document.getElementById('suggested-restaurants-grid');
    if (container) {
        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Personalizing your suggestions...</p>
            </div>
        `;
    }
    
    // Sections for different types of suggestions
    const sectionsContainer = document.getElementById('suggestions-sections');
    if (sectionsContainer) {
        sectionsContainer.innerHTML = '';
    }

    fetch(`${API_URL}/restaurants/suggestions`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                // Not authenticated, show login suggestion
                if (container) {
                    container.innerHTML = `
                        <div class="login-suggestion">
                            <div class="login-icon">📝</div>
                            <h3>Discover personalized recommendations</h3>
                            <p>Sign in to see suggestions tailored to your tastes and ordering habits.</p>
                        </div>
                    `;
                }
                return null;
            }
            throw new Error(`HTTP Error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data) return;
        
        console.log('Suggestion data received:', data);
        
        // If we have a sections container, use it to organize suggestions
        if (sectionsContainer) {
            // Clear main suggestions container
            if (container) container.innerHTML = '';
            
            // Organize suggestions into sections
            createSuggestionSections(data, sectionsContainer);
        } else {
            // Old mode (simple grid)
            renderSuggestedRestaurants(data, container);
        }
    })
    .catch(err => {
        console.error('Error loading suggestions:', err);
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <div class="error-icon">⚠️</div>
                    <h3>Oops! We encountered a problem</h3>
                    <p>Unable to load your suggestions at the moment. Please try again later.</p>
                    <button class="btn-retry" onclick="loadSuggestions()">Retry</button>
                </div>
            `;
        }
    });
}

function viewRestaurant(id, name, address, cuisineType) {
    console.log(`Viewing restaurant: ${id}, ${name}`);
    
    currentRestaurant = {
        id,
        name, 
        address,
        cuisineType
    };
    
    // Update restaurant information
    document.getElementById('restaurant-name').textContent = name;
    document.getElementById('restaurant-address').textContent = address;
    document.getElementById('restaurant-cuisine').textContent = cuisineType;
    
    // Load restaurant reviews
    loadRestaurantReviews(id);
    
    // Load restaurant menu
    fetch(`${API_URL}/menu-items?restaurant_id=${id}`)
    .then(response => {
        console.log('Menu fetch response status:', response.status);
        return response.json();
    })
    .then(menuItems => {
        console.log('Menu items received:', menuItems);
        
        const container = document.getElementById('menu-items-container');
        container.innerHTML = '';
        
        if (!menuItems || menuItems.length === 0) {
            container.innerHTML = '<p>No dishes available for this restaurant.</p>';
            return;
        }
        
        menuItems.forEach(item => {
            console.log('Processing menu item:', item);
            
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            
            // Check if necessary properties exist
            const itemName = item.name || 'Unnamed item';
            const itemPrice = item.price || 0;
            const itemId = item.item_id || 0;
            
            menuItem.innerHTML = `
                <div class="menu-item-info">
                    <h4>${itemName}</h4>
                </div>
                <div class="menu-item-actions">
                    <div class="menu-item-price">${Number(itemPrice).toFixed(2)} €</div>
                    <button class="btn-add" onclick="addToCart(${itemId}, '${itemName.replace(/'/g, "\\'")}', ${itemPrice}, ${id}, '${name.replace(/'/g, "\\'")}')">+</button>
                </div>
            `;
            
            container.appendChild(menuItem);
        });
    })
    .catch(err => {
        console.error('Error loading menu:', err);
        const container = document.getElementById('menu-items-container');
        container.innerHTML = '<p>An error occurred while loading the menu. Please try again later.</p>';
    });
    
    // Show menu page
    console.log('Switching to restaurant-menu page');
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById('restaurant-menu-page').style.display = 'block';
}

// Cart
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(itemId, name, price, restaurantId, restaurantName) {
    // Check if cart already contains items from another restaurant
    if (cart.restaurant_id !== null && cart.restaurant_id !== restaurantId) {
        if (!confirm(`Your cart contains items from ${cart.restaurant_name}. Do you want to empty your cart to order from ${restaurantName}?`)) {
            return;
        }
        // Empty cart
        cart.items = [];
    }
    
    // Update cart restaurant
    cart.restaurant_id = restaurantId;
    cart.restaurant_name = restaurantName;
    
    // Check if item is already in cart
    const existingItem = cart.items.find(item => item.item_id === itemId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.items.push({
            item_id: itemId,
            name,
            price,
            quantity: 1
        });
    }
    
    saveCart();
    
    // Show notification
    alert(`${name} has been added to your cart`);
}

// FIXED updateCartDisplay function
function updateCartDisplay() {
    const container = document.getElementById('cart-items-container');
    const emptyMessage = document.getElementById('cart-empty-message');
    const cartContent = document.getElementById('cart-content');
    
    if (cart.items.length === 0) {
        emptyMessage.style.display = 'block';
        cartContent.style.display = 'none';
        return;
    }
    
    emptyMessage.style.display = 'none';
    cartContent.style.display = 'block';
    
    container.innerHTML = '';
    let total = 0;
    
    cart.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price.toFixed(2)} € x ${item.quantity}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateCartItemQuantity(${item.item_id}, -1)">-</button>
                <span class="quantity-value">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartItemQuantity(${item.item_id}, 1)">+</button>
            </div>
            <button class="cart-remove" onclick="removeFromCart(${item.item_id})">×</button>
        `;
        
        container.appendChild(cartItem);
    });
    
    document.getElementById('cart-total-amount').textContent = `${total.toFixed(2)} €`;
    
    // Create delivery address form if needed
    createDeliveryAddressForm();
}

// ADD CODE TO INITIALIZE MISSING ELEMENTS
function initializeAdditionalElements() {
    // Create tracking modal
    createTrackingModal();
    
    // Ensure closeTrackingModal function exists
    window.closeTrackingModal = function() {
        const modal = document.getElementById('tracking-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
}

function updateCartItemQuantity(itemId, change) {
    const item = cart.items.find(item => item.item_id === itemId);
    
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            saveCart();
            updateCartDisplay();
        }
    }
}

function removeFromCart(itemId) {
    cart.items = cart.items.filter(item => item.item_id !== itemId);
    
    if (cart.items.length === 0) {
        cart.restaurant_id = null;
        cart.restaurant_name = '';
    }
    
    saveCart();
    updateCartDisplay();
}

function loadDeliveryAgents() {
    fetch(`${API_URL}/delivery-agents/available`)
    .then(response => response.json())
    .then(agents => {
        const select = document.getElementById('delivery-agent-select');
        select.innerHTML = '<option value="">Choose a delivery agent (Optional)</option>';
        
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.agent_id;
            option.textContent = `${agent.name} - ${agent.current_location || 'Location not specified'}`;
            select.appendChild(option);
        });
    })
    .catch(err => console.error('Error loading delivery agents:', err));
}

// Place order - redirect to payment after order
function placeOrder() {
    console.log('placeOrder function called');
    
    if (cart.items.length === 0) {
        alert('Your cart is empty');
        return;
    }
    
    // DON'T create the order now!
    // We'll just prepare the data and go to payment page
    
    // Calculate total
    const totalAmount = calculateCartTotal();
    
    // Prepare order data (but don't send to server)
    const orderData = {
        restaurant_id: cart.restaurant_id,
        items: cart.items.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity
        })),
        total_amount: totalAmount
    };
    
    // Add delivery agent ID if selected
    const deliveryAgentSelect = document.getElementById('delivery-agent-select');
    if (deliveryAgentSelect && deliveryAgentSelect.value) {
        orderData.agent_id = deliveryAgentSelect.value;
    }
    
    // Add delivery address
    const deliveryAddressInput = document.getElementById('delivery-address');
    if (deliveryAddressInput && deliveryAddressInput.value) {
        orderData.delivery_address = deliveryAddressInput.value;
    } else {
        orderData.delivery_address = currentUser.address || '';
    }
    
    // Add delivery notes
    const deliveryNotesInput = document.getElementById('delivery-notes');
    if (deliveryNotesInput && deliveryNotesInput.value) {
        orderData.delivery_notes = deliveryNotesInput.value;
    }
    
    console.log('Order data prepared (not yet sent):', orderData);
    
    // Store order data for later
    window.pendingOrderData = orderData;
    
    // Go directly to payment page
    preparePaymentPage({
        total_amount: totalAmount,
        restaurant_name: cart.restaurant_name
    });
}

// Function to calculate cart total
function calculateCartTotal() {
    return cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Prepare payment page
function preparePaymentPage(orderInfo) {
    console.log('Preparing payment page:', orderInfo);
    
    // Create or update order details container
    const detailsContainer = document.getElementById('payment-order-details');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="payment-order-info">
                <p><strong>New order</strong></p>
                <p><strong>Restaurant:</strong> ${orderInfo.restaurant_name}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
            </div>
            <div class="payment-order-items">
                <h4>Items to order:</h4>
                <div id="order-items-list">
                    ${generateOrderItemsHTML()}
                </div>
            </div>
        `;
    }
    
    // Update total amount
    const totalAmountElement = document.getElementById('payment-amount');
    if (totalAmountElement) {
        totalAmountElement.textContent = `${orderInfo.total_amount.toFixed(2)} €`;
    }
    
    // Load user payment methods
    loadUserPaymentMethods();
    
    // Show payment page
    showPage('payment');
}

function createOrderAfterPayment(paymentData) {
    console.log('Creating order after successful payment...');
    
    if (!window.pendingOrderData) {
        throw new Error('No pending order data');
    }
    
    // Get delivery address from form
    const deliveryAddressInput = document.getElementById('delivery-address');
    const deliveryNotesInput = document.getElementById('delivery-notes');
    
    // Add address and notes to order
    const orderDataWithAddress = {
        ...window.pendingOrderData,
        delivery_address: deliveryAddressInput ? deliveryAddressInput.value : currentUser.address,
        delivery_notes: deliveryNotesInput ? deliveryNotesInput.value : null
    };
    
    console.log('Order data with address:', orderDataWithAddress);
    
    return fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderDataWithAddress)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Error creating order');
            });
        }
        return response.json();
    })
    .then(orderResult => {
        console.log('Order created successfully:', orderResult);
        
        // Now associate payment with this order
        const finalPaymentData = {
            ...paymentData,
            order_id: orderResult.order_id
        };
        
        return fetch(`${API_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(finalPaymentData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Payment error');
                });
            }
            return response.json();
        })
        .then(paymentResult => {
            console.log('Payment successful:', paymentResult);
            return {
                order: orderResult,
                payment: paymentResult
            };
        });
    });
}

// Generate HTML for order items
function generateOrderItemsHTML() {
    return cart.items.map(item => `
        <div class="order-item">
            <span class="item-name">${item.name}</span>
            <span class="item-quantity">x${item.quantity}</span>
            <span class="item-price">${(item.price * item.quantity).toFixed(2)} €</span>
        </div>
    `).join('');
}

// Load user payment methods
let isLoadingPaymentMethods = false; // Variable to avoid multiple calls

function loadUserPaymentMethods() {
    // Avoid simultaneous multiple calls
    if (isLoadingPaymentMethods) {
        console.log('Payment methods loading already in progress, aborting...');
        return;
    }
    
    isLoadingPaymentMethods = true;
    console.log('Loading payment methods...');
    
    fetch(`${API_URL}/payment-methods`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }
        return response.json();
    })
    .then(methods => {
        console.log('Payment methods loaded:', methods);
        
        const container = document.getElementById('payment-methods-container');
        if (!container) {
            console.log('payment-methods-container not found');
            return;
        }
        
        // COMPLETELY EMPTY the container
        container.innerHTML = '';
        console.log('Container emptied, adding', methods.length, 'methods');
        
        if (methods.length === 0) {
            container.innerHTML = `
                <p class="no-payment-methods">You haven't saved any payment methods yet.</p>
                <p>Please add a new payment method below.</p>
            `;
        } else {
            // Create fragment to avoid multiple reflows
            const fragment = document.createDocumentFragment();
            
            // Add each payment method
            methods.forEach((method, index) => {
                console.log(`Adding method ${index + 1}:`, method);
                
                const methodElement = document.createElement('div');
                methodElement.className = 'payment-method';
                methodElement.innerHTML = `
                    <input type="radio" name="payment_method" id="method-${method.payment_method_id}" value="${method.payment_method_id}" ${method.is_default ? 'checked' : ''}>
                    <label for="method-${method.payment_method_id}">
                        <div class="payment-method-info">
                            <div class="payment-method-icon ${method.provider.toLowerCase()}">
                                ${getCardIcon(method.provider)}
                            </div>
                            <div class="payment-method-details">
                                <h4>${method.provider}</h4>
                                <div class="payment-method-number">${method.masked_card_number || 'XXXX-XXXX-XXXX-' + method.card_number.slice(-4)}</div>
                                <div class="payment-method-expiry">Expires: ${method.expiry_date}</div>
                            </div>
                        </div>
                        ${method.is_default ? '<div class="payment-method-default">Default</div>' : ''}
                    </label>
                `;
                fragment.appendChild(methodElement);
            });
            
            // Add option for new card
            const newCardOption = document.createElement('div');
            newCardOption.className = 'payment-method';
            newCardOption.innerHTML = `
                <input type="radio" name="payment_method" id="method-new" value="new" ${methods.length === 0 ? 'checked' : ''}>
                <label for="method-new">
                    <div class="payment-method-info">
                        <div class="payment-method-icon">+</div>
                        <div class="payment-method-details">
                            <h4>Use a new card</h4>
                        </div>
                    </div>
                </label>
            `;
            fragment.appendChild(newCardOption);
            
            // Add entire fragment at once
            container.appendChild(fragment);
        }
        
        // Update profile page if it exists
        updateProfilePaymentMethods(methods);
    })
    .catch(err => {
        console.error('Error loading payment methods:', err);
        const container = document.getElementById('payment-methods-container');
        if (container) {
            container.innerHTML = '<p>An error occurred while loading payment methods.</p>';
        }
    })
    .finally(() => {
        isLoadingPaymentMethods = false;
        console.log('Payment methods loading completed');
    });
}

// Function to update payment methods in profile page
function updateProfilePaymentMethods(methods) {
    const container = document.getElementById('profile-payment-methods');
    if (!container) return;
    
    // COMPLETELY EMPTY the container
    container.innerHTML = '';
    
    if (methods.length === 0) {
        container.innerHTML = '<p>You haven\'t saved any payment methods yet.</p>';
        return;
    }
    
    // Create fragment to avoid multiple reflows
    const fragment = document.createDocumentFragment();
    
    methods.forEach(method => {
        const methodElement = document.createElement('div');
        methodElement.className = 'payment-method';
        methodElement.innerHTML = `
            <div class="payment-method-info">
                <div class="payment-method-icon ${method.provider.toLowerCase()}">
                    ${getCardIcon(method.provider)}
                </div>
                <div class="payment-method-details">
                    <h4>${method.provider}</h4>
                    <div class="payment-method-number">${method.masked_card_number || 'XXXX-XXXX-XXXX-' + method.card_number.slice(-4)}</div>
                    <div class="payment-method-expiry">Expires: ${method.expiry_date}</div>
                    ${method.is_default ? '<div class="payment-method-default">Default</div>' : ''}
                </div>
            </div>
            <button class="payment-method-delete" onclick="deletePaymentMethod(${method.payment_method_id})">×</button>
        `;
        fragment.appendChild(methodElement);
    });
    
    // Add entire fragment at once
    container.appendChild(fragment);
}

function setupPaymentSystem() {
    // Initialize payment forms
    const paymentMethodForm = document.getElementById('payment-method-form');
    if (paymentMethodForm) {
        paymentMethodForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addPaymentMethod();
        });
    }
    
    const profilePaymentForm = document.getElementById('profile-payment-form');
    if (profilePaymentForm) {
        profilePaymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addProfilePaymentMethod();
        });
    }
    
    // Add listener for split type selection
    const splitTypeRadios = document.querySelectorAll('input[name="split-type"]');
    splitTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const customAmountsContainer = document.getElementById('split-custom-amounts');
            if (this.value === 'custom' && customAmountsContainer) {
                customAmountsContainer.style.display = 'block';
            } else if (customAmountsContainer) {
                customAmountsContainer.style.display = 'none';
            }
        });
    });
}

function deletePaymentMethod(paymentMethodId) {
    if (!confirm('Are you sure you want to delete this payment method?')) {
        return;
    }
    
    fetch(`${API_URL}/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Error deleting payment method');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Payment method deleted:', data);
        
        // Reload payment methods
        loadUserPaymentMethods();
        
        // Show message
        alert('Payment method deleted successfully');
    })
    .catch(err => {
        console.error('Error deleting payment method:', err);
        alert('Error: ' + err.message);
    });
}

// Get icon for card type
function getCardIcon(provider) {
    switch(provider.toLowerCase()) {
        case 'visa': return '<span>🟦</span>';
        case 'mastercard': return '<span>🔴🟡</span>';
        case 'amex': return '<span>🟩</span>';
        default: return '<span>💳</span>';
    }
}

// Payment processing
// Modified processPayment function
function processPayment() {
    console.log('Processing payment...');
    
    if (!window.pendingOrderData) {
        alert('Error: No pending order');
        return;
    }

    // ✅ PROTECTION CONTRE LES DOUBLES CLICS
    if (window.isProcessingPayment) {
        console.log('Payment already in progress, ignoring...');
        return;
    }
    window.isProcessingPayment = true;
    
    // Get selected payment method
    const selectedMethod = document.querySelector('input[name="payment_method"]:checked');
    console.log('Selected method:', selectedMethod);
    
    if (!selectedMethod) {
        alert('Please select a payment method');
        return;
    }
    
    const paymentMethodId = selectedMethod.value;
    console.log('Payment method ID:', paymentMethodId);
    
    // Prepare payment data (without order_id for now)
    let paymentData = {
        amount: window.pendingOrderData.total_amount
    };
    
    // Show loading indicator
    const paymentBtn = document.querySelector('.payment-actions .btn-primary');
    if (paymentBtn) {
        paymentBtn.disabled = true;
        paymentBtn.textContent = 'Processing...';
    }
    
    if (paymentMethodId === 'new') {
        // New card - get information from form
        const provider = document.getElementById('payment-provider').value;
        const cardNumber = document.getElementById('card-number').value;
        const cardHolder = document.getElementById('card-holder').value;
        const cardExpiry = document.getElementById('card-expiry').value;
        
        if (!provider || !cardNumber || !cardHolder || !cardExpiry) {
            alert('Please fill in all card fields');
            if (paymentBtn) {
                paymentBtn.disabled = false;
                paymentBtn.textContent = 'Pay now';
            }
            return;
        }
        
        // First add card as payment method
        const cardData = {
            provider,
            card_number: cardNumber,
            expiry_date: cardExpiry,
            card_holder: cardHolder,
            is_default: document.getElementById('card-default')?.checked || false
        };
        
        fetch(`${API_URL}/payment-methods`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(cardData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Error adding card');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('New card added:', data);
            paymentData.payment_method_id = data.payment_method_id;
            
            // Now create order AND process payment
            return createOrderAfterPayment(paymentData);
        })
        .then(result => {
            handleSuccessfulPayment(result);
        })
        .catch(err => {
            console.error('Error:', err);
            alert('Error: ' + err.message);
        })
        .finally(() => {
            window.isProcessingPayment = false;
            if (paymentBtn) {
                paymentBtn.disabled = false;
                paymentBtn.textContent = 'Pay now';
            }
        });
    } else {
        // Existing card
        paymentData.payment_method_id = paymentMethodId;
        
        // Create order AND process payment
        createOrderAfterPayment(paymentData)
        .then(result => {
            handleSuccessfulPayment(result);
        })
        .catch(err => {
            console.error('Error:', err);
            alert('Error: ' + err.message);
        })
        .finally(() => {
            if (paymentBtn) {
                paymentBtn.disabled = false;
                paymentBtn.textContent = 'Pay now';
            }
        });
    }
}

function handleSuccessfulPayment(result) {
    console.log('Payment and order successful:', result);
    
    // ✅ PROTECTION CONTRE LES APPELS MULTIPLES
    if (window.hasHandledPaymentSuccess) {
        console.log('Payment success already handled, ignoring...');
        return;
    }
    window.hasHandledPaymentSuccess = true;
    
    // Empty cart
    cart = { restaurant_id: null, restaurant_name: '', items: [] };
    saveCart();
    
    // Clean pending order data
    delete window.pendingOrderData;
    
    // Show success message
    alert(`Order #${result.order.order_id} placed and paid successfully!`);
    
    // ✅ ATTENDRE UN PEU AVANT DE RECHARGER
    setTimeout(() => {
        loadOrders();
        showPage('orders');
        
        // Reset flag après délai
        setTimeout(() => {
            window.hasHandledPaymentSuccess = false;
        }, 2000);
    }, 500);
}
// Function to continue payment process
function continueWithPayment(paymentData) {
    console.log('Sending payment with data:', paymentData);
    
    // Add splitting information if needed
    const splitEmails = getSplitEmails();
    if (splitEmails.length > 0) {
        paymentData.split_with = splitEmails;
    }
    
    // Show loading indicator
    const paymentBtn = document.querySelector('.payment-actions .btn-primary');
    if (paymentBtn) {
        paymentBtn.disabled = true;
        paymentBtn.textContent = 'Processing...';
    }
    
    fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Payment error');
            });
        }
    })
    .then(data => {
        console.log('Payment successful:', data);
        
        // Empty cart now that payment is successful
        cart = { restaurant_id: null, restaurant_name: '', items: [] };
        saveCart();
        
        // Show success message
        alert('Payment completed successfully!');
        
        // Reset state
        currentOrderForPayment = null;
        
        // Redirect to orders page
        loadOrders();
        showPage('orders');
    })
    .catch(err => {
        console.error('Payment error:', err);
        alert('Payment error: ' + err.message);
    })
    .finally(() => {
        // Re-enable payment button
        if (paymentBtn) {
            paymentBtn.disabled = false;
            paymentBtn.textContent = 'Pay now';
        }
    });
}

// Get emails for bill splitting
function getSplitEmails() {
    const emails = [];
    const emailInputs = document.querySelectorAll('[id^="split-email-"]');
    
    emailInputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
            emails.push(input.value.trim());
        }
    });
    
    return emails;
}

// Add email field for bill splitting
function addEmailField() {
    const container = document.getElementById('split-emails-container');
    const emailFields = container.querySelectorAll('.split-email-row');
    const newIndex = emailFields.length + 1;
    
    const emailField = document.createElement('div');
    emailField.className = 'form-group';
    emailField.innerHTML = `
        <label for="split-email-${newIndex}">Your friend's email</label>
        <div class="split-email-row">
            <input type="email" id="split-email-${newIndex}" placeholder="email@example.com">
            <button type="button" class="btn-remove-email" onclick="removeEmailField(${newIndex})">×</button>
        </div>
    `;
    
    container.appendChild(emailField);
    
    // Show all remove buttons
    container.querySelectorAll('.btn-remove-email').forEach(btn => {
        btn.style.display = 'block';
    });
}

// Remove email field for bill splitting
function removeEmailField(index) {
    const container = document.getElementById('split-emails-container');
    const emailFields = container.querySelectorAll('.form-group');
    
    if (emailFields.length <= 1) return;
    
    const fieldToRemove = document.querySelector(`.form-group:has(#split-email-${index})`);
    if (fieldToRemove) {
        fieldToRemove.remove();
    }
    
    // Hide remove button if only one field remains
    const remainingFields = container.querySelectorAll('.form-group');
    if (remainingFields.length === 1) {
        remainingFields[0].querySelector('.btn-remove-email').style.display = 'none';
    }
}

function showPaymentPage(order) {
    // Update order information
    document.getElementById('order-id').textContent = order.order_id;
    document.getElementById('order-restaurant').textContent = cart.restaurant_name;
    document.getElementById('order-date').textContent = new Date().toLocaleDateString('en-US');
    
    // Update total amount
    const total = order.total_amount;
    document.getElementById('payment-amount').textContent = `${total.toFixed(2)} €`;
    
    // Show order items
    const itemsContainer = document.getElementById('order-items-list');
    itemsContainer.innerHTML = '';
    
    cart.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'order-item';
        itemElement.innerHTML = `
            <span class="item-name">${item.name}</span>
            <span class="item-quantity">x${item.quantity}</span>
            <span class="item-price">${(item.price * item.quantity).toFixed(2)} €</span>
        `;
        itemsContainer.appendChild(itemElement);
    });
    
    // Show payment page
    showPage('payment');
}

// Orders
function loadOrders() {
    // ✅ PROTECTION CONTRE LES APPELS MULTIPLES
    if (window.isLoadingOrders) {
        console.log('Orders already loading, ignoring...');
        return;
    }
    window.isLoadingOrders = true;

    fetch(`${API_URL}/orders`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(orders => {
        const container = document.getElementById('orders-container');
        
        // ✅ VIDER COMPLÈTEMENT LE CONTENEUR
        container.innerHTML = '';
        
        if (orders.length === 0) {
            container.innerHTML = '<p>You haven\'t placed any orders yet.</p>';
            return;
        }
        
        orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
        
        // ✅ ÉVITER LES DOUBLONS
        const processedOrderIds = new Set();
        
        orders.forEach(order => {
            if (!processedOrderIds.has(order.order_id)) {
                processedOrderIds.add(order.order_id);
                loadOrderDetails(order, container);
            }
        });
    })
    .catch(err => {
        console.error('Error loading orders:', err);
        document.getElementById('orders-container').innerHTML = 
            '<p>An error occurred while loading your orders.</p>';
    })
    .finally(() => {
        // ✅ RESET LE FLAG
        window.isLoadingOrders = false;
    });
}

function loadOrderDetails(order, container) {
    // Load order item details
    fetch(`${API_URL}/order-details?order_id=${order.order_id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(orderDetails => {
        console.log(`Details for order ${order.order_id}:`, orderDetails);
        
        const orderDate = new Date(order.order_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const orderElement = document.createElement('div');
        orderElement.className = `order-card ${getOrderStatusClass(order.status)}`;
        
        let orderItems = '';
        if (orderDetails && orderDetails.length > 0) {
            orderItems = orderDetails.map(item => 
                `<div class="order-item">
                    <span class="item-name">${item.item_name || item.name}</span>
                    <span class="item-quantity">x${item.quantity}</span>
                    <span class="item-price">${(item.price * item.quantity).toFixed(2)} €</span>
                </div>`
            ).join('');
        } else {
            orderItems = '<p>No details available</p>';
        }
        
        let deliveryAgentInfo = '';
        if (order.agent_name) {
            deliveryAgentInfo = `
                <div class="delivery-agent-info">
                    <h4>Delivery agent:</h4>
                    <p>
                        <strong>Name:</strong> ${order.agent_name}<br>
                        ${order.agent_phone ? `<strong>Phone:</strong> ${order.agent_phone}` : ''}
                    </p>
                </div>
            `;
        }
        
        // IMPROVED LOGIC FOR BUTTONS WITH REVIEW VERIFICATION
        let actionButtons = '';
        
        // Define statuses that allow tracking
        const trackableStatuses = ['pending', 'preparing', 'ready_for_delivery', 'out_for_delivery'];
        // Define final statuses
        const finalStatuses = ['delivered', 'cancelled'];
        
        // Normalize status for comparison
        const normalizedStatus = order.status.toLowerCase().trim();
        
        // Track button: only for orders in progress
        if (trackableStatuses.some(status => normalizedStatus.includes(status) || status.includes(normalizedStatus))) {
            actionButtons += `
                <button class="btn-track" onclick="trackOrder(${order.order_id})">
                    🚚 Track order
                </button>
            `;
        }
        
        // Review button: only for delivered orders
        if (finalStatuses.some(status => normalizedStatus.includes(status) || status.includes(normalizedStatus))) {
            if (normalizedStatus.includes('delivered')) {
                // Check if user has already reviewed this order
                // For now, always show button (you can add server-side verification)
                actionButtons += `
                    <button class="btn-review" onclick="showReviewForm(${order.restaurant_id}, '${order.restaurant_name.replace(/'/g, "\\'")}', ${order.order_id})">
                        ⭐ Leave a review
                    </button>
                `;
            }
        }
        
        // If no buttons available, show status message
        if (!actionButtons) {
            if (normalizedStatus.includes('cancelled')) {
                actionButtons = '<p class="order-status-message">Order cancelled</p>';
            } else {
                actionButtons = '<p class="order-status-message">No actions available</p>';
            }
        }
        
        // Handle delivery address
        const deliveryAddress = order.delivery_address || currentUser.address || 'Address not specified';
        
        orderElement.innerHTML = `
            <div class="order-header">
                <div class="order-info">
                    <h3>${order.restaurant_name}</h3>
                    <div class="order-date">${orderDate}</div>
                    <div class="order-status ${getOrderStatusClass(order.status)}">${getOrderStatusText(order.status)}</div>
                </div>
                <div class="order-total">
                    <span class="total-amount">${Number(order.total_amount).toFixed(2)} €</span>
                </div>
            </div>
            <div class="order-details">
                <div class="items-section">
                    <h4>Ordered items:</h4>
                    <div class="order-items">
                        ${orderItems}
                    </div>
                </div>
                <div class="delivery-section">
                    <h4>Delivery:</h4>
                    <p>
                        <strong>Address:</strong> ${deliveryAddress}<br>
                        ${order.delivery_notes ? `<strong>Instructions:</strong> ${order.delivery_notes}` : ''}
                    </p>
                    ${deliveryAgentInfo}
                </div>
            </div>
            <div class="order-actions">
                ${actionButtons}
            </div>
        `;
        
        container.appendChild(orderElement);
    })
    .catch(err => {
        console.error(`Error loading details for order ${order.order_id}:`, err);
        
        // Show order even without details
        const orderElement = document.createElement('div');
        orderElement.className = `order-card ${getOrderStatusClass(order.status)}`;
        orderElement.innerHTML = `
            <div class="order-header">
                <div class="order-info">
                    <h3>${order.restaurant_name}</h3>
                    <div class="order-date">${new Date(order.order_date).toLocaleDateString('en-US')}</div>
                    <div class="order-status ${getOrderStatusClass(order.status)}">${getOrderStatusText(order.status)}</div>
                </div>
                <div class="order-total">
                    <span class="total-amount">${Number(order.total_amount).toFixed(2)} €</span>
                </div>
            </div>
            <div class="order-details">
                <p>Error loading details for this order.</p>
            </div>
        `;
        container.appendChild(orderElement);
    });
}

function getOrderStatusClass(status) {
    const normalizedStatus = status.toLowerCase().trim();
    
    if (normalizedStatus.includes('pending')) {
        return 'status-pending';
    }
    if (normalizedStatus.includes('preparing')) {
        return 'status-preparing';
    }
    if (normalizedStatus.includes('ready')) {
        return 'status-ready';
    }
    if (normalizedStatus.includes('out') || normalizedStatus.includes('delivery')) {
        return 'status-out';
    }
    if (normalizedStatus.includes('delivered')) {
        return 'status-delivered';
    }
    if (normalizedStatus.includes('cancelled')) {
        return 'status-cancelled';
    }
    
    return 'status-pending'; // Default
}

function getOrderStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'preparing': 'Preparing',
        'ready_for_delivery': 'Ready for delivery',
        'out_for_delivery': 'Out for delivery',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'paid': 'Paid',
        'partially paid': 'Partially paid'
    };
    
    const normalizedStatus = status.toLowerCase().trim();
    return statusMap[normalizedStatus] || status;
}

// FIXED trackOrder function
function trackOrder(orderId) {
    console.log('Order tracking requested for:', orderId);
    
    // Use user order details route instead
    fetch(`${API_URL}/orders?order_id=${orderId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Find specific order in results
        const order = Array.isArray(data) ? data.find(order => order.order_id === orderId) : data;
        
        if (order) {
            // Show current status
            alert(`Order status: ${getOrderStatusText(order.status)}`);
            
            // If you have a modal, you could use it here
            // updateTrackingSteps(order.status);
            // document.getElementById('tracking-modal').style.display = 'flex';
        } else {
            throw new Error('Order not found');
        }
    })
    .catch(err => {
        console.error('Error tracking order:', err);
        alert('An error occurred while tracking your order.');
    });
}

function updateTrackingSteps(status) {
    const steps = [
        { id: 'step-pending', status: 'pending' },
        { id: 'step-preparing', status: 'preparing' },
        { id: 'step-ready', status: 'ready_for_delivery' },
        { id: 'step-out', status: 'out_for_delivery' },
        { id: 'step-delivered', status: 'delivered' }
    ];
    
    const statusIndex = steps.findIndex(step => step.status === status);
    
    if (statusIndex === -1) return; // Unrecognized status
    
    steps.forEach((step, index) => {
        const element = document.getElementById(step.id);
        if (index < statusIndex) {
            // Completed steps
            element.className = 'tracking-step completed';
        } else if (index === statusIndex) {
            // Current step
            element.className = 'tracking-step current';
        } else {
            // Future steps
            element.className = 'tracking-step';
        }
    });
}

function closeTrackingModal() {
    document.getElementById('tracking-modal').style.display = 'none';
}

function showReviewForm(restaurantId, restaurantName, orderId) {
    console.log('Opening review form:', { restaurantId, restaurantName, orderId });
    
    // Create modal if it doesn't exist
    createReviewModal();
    
    // Set current restaurant
    currentRestaurant = {
        id: restaurantId,
        name: restaurantName
    };
    
    // Fill information
    document.getElementById('review-restaurant-name').textContent = restaurantName;
    document.getElementById('modal-review-restaurant-id').value = restaurantId;
    document.getElementById('modal-review-order-id').value = orderId;
    
    // Reset form
    document.getElementById('modal-review-rating').value = '0';
    document.getElementById('modal-review-comment').value = '';
    
    // Reset stars
    const stars = document.querySelectorAll('#modal-star-rating .star');
    resetModalStars(stars);
    
    // Clear messages
    const messageElement = document.getElementById('modal-review-message');
    messageElement.textContent = '';
    messageElement.className = 'message';
    
    // Show modal
    const modal = document.getElementById('review-modal');
    modal.style.display = 'flex';
    
    // Add opening animation
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// User profile
function loadProfile() {
    // Fill form with user data
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-email').value = currentUser.email;
    document.getElementById('profile-address').value = currentUser.address || '';
    document.getElementById('profile-phone').value = currentUser.phone || '';
    
    // Load user statistics
    loadUserStats();
}

// New function to load user statistics
function loadUserStats() {
    console.log('Attempting to load statistics...', `${API_URL}/user/stats`);
    console.log('Token used:', token ? 'Token present' : 'No token');
    
    fetch(`${API_URL}/user/stats`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        console.log('Response received, status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }
        return response.json();
    })
    .then(stats => {
        console.log('User statistics loaded:', stats);
        
        // Update stats display elements
        const totalOrdersElement = document.getElementById('total-orders');
        const totalSpentElement = document.getElementById('total-spent');
        const favoriteRestaurantElement = document.getElementById('favorite-restaurant');
        const favoriteCuisineElement = document.getElementById('favorite-cuisine');
        const averageOrderElement = document.getElementById('average-order');
        
        if (totalOrdersElement) {
            totalOrdersElement.textContent = stats.totalOrders || 0;
        }
        
        if (totalSpentElement) {
            totalSpentElement.textContent = `${(stats.totalSpent || 0).toFixed(2)} €`;
        }
        
        if (favoriteRestaurantElement) {
            favoriteRestaurantElement.textContent = stats.favoriteRestaurant || 'None';
        }
        
        if (favoriteCuisineElement) {
            let cuisineText = stats.favoriteCuisine;
            console.log('Cuisine received client-side:', JSON.stringify(cuisineText));
            
            if (cuisineText) {
                // Clean text client-side too
                cuisineText = cuisineText
                    .replace(/^\||\|$/g, '') // Remove pipes
                    .trim(); // Remove spaces
                
                console.log('Cuisine after client-side cleaning:', JSON.stringify(cuisineText));
                
                // If empty after cleaning, show "None"
                favoriteCuisineElement.textContent = cuisineText || 'None';
            } else {
                favoriteCuisineElement.textContent = 'None';
            }
            
            console.log('Final text displayed:', favoriteCuisineElement.textContent);
        }
        
        if (averageOrderElement) {
            averageOrderElement.textContent = `${(stats.averageOrder || 0).toFixed(2)} €`;
        }
    })
    .catch(err => {
        console.error('Error loading user statistics:', err);
        console.error('URL called:', `${API_URL}/user/stats`);
        console.error('Headers:', { 'Authorization': `Bearer ${token}` });
        
        // Show default values on error
        const totalOrdersElement = document.getElementById('total-orders');
        const totalSpentElement = document.getElementById('total-spent');
        const favoriteRestaurantElement = document.getElementById('favorite-restaurant');
        const favoriteCuisineElement = document.getElementById('favorite-cuisine');
        const averageOrderElement = document.getElementById('average-order');
        
        if (totalOrdersElement) totalOrdersElement.textContent = '0';
        if (totalSpentElement) totalSpentElement.textContent = '0.00 €';
        if (favoriteRestaurantElement) favoriteRestaurantElement.textContent = 'None';
        if (favoriteCuisineElement) favoriteCuisineElement.textContent = 'None';
        if (averageOrderElement) averageOrderElement.textContent = '0.00 €';
    });
}

function updateProfile(e) {
    e.preventDefault();
    
    const name = document.getElementById('profile-name').value;
    const email = document.getElementById('profile-email').value;
    const address = document.getElementById('profile-address').value;
    const phone = document.getElementById('profile-phone').value;
    const currentPassword = document.getElementById('profile-current-password')?.value;
    const newPassword = document.getElementById('profile-password').value;
    
    if (!name || !email) {
        document.getElementById('profile-error').textContent = 'Name and email are required';
        return;
    }
    
    const profileData = { name, email, address, phone };
    
    // Add password only if new one is provided
    if (newPassword) {
        if (!currentPassword) {
            document.getElementById('profile-error').textContent = 'Current password required to change password';
            return;
        }
        profileData.current_password = currentPassword;
        profileData.new_password = newPassword;
    }
    
    document.getElementById('profile-error').textContent = '';
    
    fetch(`${API_URL}/user/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Error updating profile');
            });
        }
    })
    .then(data => {
        // Update user info
        currentUser = data.user || currentUser;
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Reset password fields
        if (document.getElementById('profile-current-password')) {
            document.getElementById('profile-current-password').value = '';
        }
        document.getElementById('profile-password').value = '';
        
        // Show success message
        const messageElement = document.getElementById('profile-message');
        if (messageElement) {
            messageElement.textContent = 'Profile updated successfully';
            messageElement.className = 'message success';
            
            setTimeout(() => {
                messageElement.textContent = '';
                messageElement.className = 'message';
            }, 3000);
        }
        
        // Update header username
        document.getElementById('header-username').textContent = currentUser.name;
    })
    .catch(err => {
        const errorElement = document.getElementById('profile-error') || document.getElementById('profile-message');
        if (errorElement) {
            errorElement.textContent = err.message;
            errorElement.className = 'message error';
        }
    });
}

// Create tracking modal
function createTrackingModal() {
    // Create modal element if it doesn't already exist
    if (!document.getElementById('tracking-modal')) {
        const trackingModal = document.createElement('div');
        trackingModal.id = 'tracking-modal';
        trackingModal.className = 'modal';
        trackingModal.style.display = 'none';
        
        trackingModal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeTrackingModal()">&times;</span>
                <h2>Track your order</h2>
                <div id="tracking-loader" class="loader" style="display: none;">Loading...</div>
                <div id="tracking-content">
                    <div class="tracking-header">
                        <div>Order #<span id="tracking-order-id"></span></div>
                        <div>Status: <span id="tracking-status"></span></div>
                    </div>
                    <div class="tracking-steps">
                        <div id="step-pending" class="tracking-step">Pending</div>
                        <div id="step-preparing" class="tracking-step">Preparing</div>
                        <div id="step-ready" class="tracking-step">Ready for delivery</div>
                        <div id="step-out" class="tracking-step">Out for delivery</div>
                        <div id="step-delivered" class="tracking-step">Delivered</div>
                    </div>
                    <div id="estimated-delivery" style="display: none;">
                        <p>Estimated delivery: <span id="estimated-time"></span></p>
                    </div>
                    <div id="tracking-map" style="display: none;">
                        <h3>Your delivery agent:</h3>
                        <p>Name: <span id="agent-name"></span></p>
                        <p>Phone: <span id="agent-phone"></span></p>
                        <div id="tracking-map-placeholder" style="display: none; height: 200px; background-color: #f0f0f0; align-items: center; justify-content: center;">
                            Real-time tracking map (in development)
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(trackingModal);
        
        // Add CSS for modal
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.7);
                justify-content: center;
                align-items: center;
            }
            .modal-content {
                background-color: #fff;
                padding: 20px;
                border-radius: 5px;
                width: 80%;
                max-width: 600px;
                position: relative;
            }
            .close {
                position: absolute;
                right: 15px;
                top: 10px;
                font-size: 24px;
                cursor: pointer;
            }
            .tracking-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
            }
            .tracking-steps {
                display: flex;
                justify-content: space-between;
                margin: 30px 0;
            }
            .tracking-step {
                text-align: center;
                position: relative;
                flex: 1;
                padding-bottom: 20px;
            }
            .tracking-step::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background-color: #ddd;
            }
            .tracking-step::before {
                content: '';
                position: absolute;
                bottom: 7px;
                width: 100%;
                height: 2px;
                background-color: #ddd;
                left: -50%;
            }
            .tracking-step:first-child::before {
                display: none;
            }
            .tracking-step.completed::after {
                background-color: #4CAF50;
            }
            .tracking-step.completed::before {
                background-color: #4CAF50;
            }
            .tracking-step.current::after {
                background-color: #2196F3;
                box-shadow: 0 0 5px #2196F3;
            }
            .loader {
                text-align: center;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
    }
}

// FIXED function to create missing delivery address form in cart
function createDeliveryAddressForm() {
    // Create delivery address form if it doesn't exist
    const cartSummary = document.querySelector('.cart-summary');
    if (cartSummary && !document.getElementById('delivery-address-form')) {
        const deliveryForm = document.createElement('div');
        deliveryForm.id = 'delivery-address-form';
        deliveryForm.className = 'delivery-form';
        deliveryForm.innerHTML = `
            <h4>Delivery address</h4>
            <div class="form-group">
                <label for="delivery-address">Address</label>
                <input type="text" id="delivery-address" placeholder="Delivery address" value="${currentUser.address || ''}">
            </div>
            <div class="form-group">
                <label for="delivery-notes">Special instructions</label>
                <textarea id="delivery-notes" placeholder="Instructions for delivery agent..."></textarea>
            </div>
        `;
        
        // Insert form before delivery options
        const deliveryOptions = document.getElementById('delivery-options');
        if (deliveryOptions) {
            deliveryOptions.before(deliveryForm);
        } else {
            cartSummary.prepend(deliveryForm);
        }
    }
}

// REVIEW MODAL SYSTEM

// Create review modal
function createReviewModal() {
    // Check if modal already exists
    if (document.getElementById('review-modal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'review-modal';
    modal.className = 'modal review-modal';
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="modal-content review-modal-content">
            <div class="modal-header">
                <h2>Leave your review</h2>
                <span class="close review-close" onclick="closeReviewModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="restaurant-info-review">
                    <h3 id="review-restaurant-name">Restaurant</h3>
                    <p>Share your experience with this restaurant</p>
                </div>
                
                <form id="review-form-modal">
                    <div class="rating-selector">
                        <label>Your rating:</label>
                        <div class="star-rating" id="modal-star-rating">
                            <span class="star" data-rating="1">★</span>
                            <span class="star" data-rating="2">★</span>
                            <span class="star" data-rating="3">★</span>
                            <span class="star" data-rating="4">★</span>
                            <span class="star" data-rating="5">★</span>
                        </div>
                        <input type="hidden" id="modal-review-rating" value="0">
                    </div>
                    
                    <div class="form-group">
                        <label for="modal-review-comment">Your comment:</label>
                        <textarea id="modal-review-comment" rows="4" placeholder="Share your experience..."></textarea>
                    </div>
                    
                    <input type="hidden" id="modal-review-restaurant-id" value="">
                    <input type="hidden" id="modal-review-order-id" value="">
                    
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeReviewModal()">Cancel</button>
                        <button type="submit" class="btn-primary">Publish review</button>
                    </div>
                </form>
                
                <div id="modal-review-message" class="message"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Initialize star rating system for this modal
    setupModalStarRating();
    
    // Add form listener
    document.getElementById('review-form-modal').addEventListener('submit', function(e) {
        e.preventDefault();
        submitModalReview();
    });
}

// Function to set up star rating in modal
function setupModalStarRating() {
    const stars = document.querySelectorAll('#modal-star-rating .star');
    const ratingInput = document.getElementById('modal-review-rating');
    
    stars.forEach(star => {
        // Hover event
        star.addEventListener('mouseover', function() {
            const rating = this.getAttribute('data-rating');
            highlightModalStars(stars, rating);
        });
        
        // Mouse leave event
        star.addEventListener('mouseout', function() {
            const currentRating = ratingInput.value;
            if (currentRating > 0) {
                highlightModalStars(stars, currentRating);
            } else {
                resetModalStars(stars);
            }
        });
        
        // Click event
        star.addEventListener('click', function() {
            const rating = this.getAttribute('data-rating');
            ratingInput.value = rating;
            
            // Selection animation
            this.classList.add('selected');
            setTimeout(() => {
                this.classList.remove('selected');
            }, 300);
            
            highlightModalStars(stars, rating);
        });
    });
}

// Helper functions for modal stars
function highlightModalStars(stars, rating) {
    stars.forEach(star => {
        if (star.getAttribute('data-rating') <= rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function resetModalStars(stars) {
    stars.forEach(star => {
        star.classList.remove('active');
    });
}

// Submit review from modal
function submitModalReview() {
    const rating = document.getElementById('modal-review-rating').value;
    const comment = document.getElementById('modal-review-comment').value;
    const restaurantId = document.getElementById('modal-review-restaurant-id').value;
    const orderId = document.getElementById('modal-review-order-id').value;
    
    console.log('Submitting review:', { rating, comment, restaurantId, orderId });
    
    if (!rating || rating === '0') {
        showModalMessage('Please give a rating before submitting.', 'error');
        return;
    }
    
    const reviewData = {
        restaurant_id: parseInt(restaurantId),
        rating: parseInt(rating),
        comment: comment.trim(),
        order_id: parseInt(orderId)
    };
    
    // Disable button during submission
    const submitBtn = document.querySelector('#review-form-modal .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';
    
    fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reviewData)
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Error adding review');
            });
        }
    })
    .then(data => {
        console.log('Review added successfully:', data);
        showModalMessage('Your review has been published successfully!', 'success');
        
        // ADDITION: Refresh restaurant data
        refreshAfterReview();
        
        // Close modal after delay
        setTimeout(() => {
            closeReviewModal();
            loadOrders();
        }, 2000);
    })
    .catch(err => {
        console.error('Error adding review:', err);
        showModalMessage(err.message, 'error');
    })
    .finally(() => {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });
}

// Show message in modal
function showModalMessage(message, type = 'info') {
    const messageElement = document.getElementById('modal-review-message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    
    // Scroll to message if needed
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// SUGGESTION SYSTEM FUNCTIONS

// Function to create suggestion sections
function createSuggestionSections(data, container) {
    container.innerHTML = '';
    
    // Function to create restaurant card
    const createRestaurantCard = (restaurant, isCompact = false) => {
        const safeAddress = restaurant.address ? restaurant.address.replace(/'/g, "\\'") : '';
        const safeCuisine = restaurant.cuisine_type ? restaurant.cuisine_type.replace(/'/g, "\\'") : '';
        const safeName = restaurant.name.replace(/'/g, "\\'");
        
        const avgRating = parseFloat(restaurant.avg_rating) || 0;
        const reviewCount = parseInt(restaurant.review_count) || 0;
        
        // Random image for each restaurant
        const imgNum = Math.floor(Math.random() * 10) + 1;
        
        // Different class depending on mode (compact or normal)
        const cardClass = isCompact ? 'restaurant-card compact' : 'restaurant-card';
        
        const card = document.createElement('div');
        card.className = cardClass;
        
        card.innerHTML = `
            <div class="restaurant-image" style="background-image: url('https://source.unsplash.com/random/300x180/?restaurant,food,${imgNum}')">
                ${avgRating >= 4.5 ? '<span class="top-rated-badge">Top Rated</span>' : ''}
            </div>
            <div class="restaurant-info">
                <h3>${restaurant.name}</h3>
                ${!isCompact ? `<p class="restaurant-address">${restaurant.address || 'Address not available'}</p>` : ''}
                <div class="restaurant-meta-info">
                    ${restaurant.cuisine_type ? `<span class="cuisine-type">${restaurant.cuisine_type}</span>` : ''}
                    ${avgRating > 0 ? `
                        <div class="restaurant-card-rating">
                            <div class="stars-container">
                                ${renderStars(avgRating)}
                            </div>
                            <span class="rating-value">${formatRating(avgRating)}</span>
                            <span class="rating-count">(${reviewCount})</span>
                        </div>
                    ` : '<span class="no-rating">No reviews yet</span>'}
                </div>
                <button class="btn-view" onclick="viewRestaurant(${restaurant.restaurant_id}, '${safeName}', '${safeAddress}', '${safeCuisine}')">View menu</button>
            </div>
        `;
        
        return card;
    };
    
    // 1. Section based on your preferences
    if (data.type === 'personalized' && data.restaurants.length > 0) {
        const preferenceSection = document.createElement('div');
        preferenceSection.className = 'suggestion-section';
        
        // Create personalized message based on preferences
        let preferenceMessage = 'These restaurants might appeal to you';
        if (data.preferences && data.preferences.length > 0) {
            const cuisines = data.preferences.map(p => p.cuisine_type).slice(0, 2);
            preferenceMessage = `Suggestions based on your taste for ${cuisines.join(' and ')} cuisine`;
        }
        
        preferenceSection.innerHTML = `
            <div class="suggestion-header">
                <h3>For You</h3>
                <p>${preferenceMessage}</p>
            </div>
            <div class="suggestion-carousel" id="preference-carousel"></div>
        `;
        
        container.appendChild(preferenceSection);
        
        // Add restaurants to this section
        const carousel = preferenceSection.querySelector('#preference-carousel');
        data.restaurants.slice(0, 5).forEach(restaurant => {
            carousel.appendChild(createRestaurantCard(restaurant));
        });
    }
    
    // 2. Add "Top Rated Restaurants" section
    fetch(`${API_URL}/restaurants`)
    .then(response => response.json())
    .then(allRestaurants => {
        // Filter restaurants with ratings and sort
        const topRated = allRestaurants
            .filter(r => r.avg_rating && parseFloat(r.avg_rating) > 0)
            .sort((a, b) => parseFloat(b.avg_rating) - parseFloat(a.avg_rating))
            .slice(0, 5);
            
        if (topRated.length > 0) {
            const topRatedSection = document.createElement('div');
            topRatedSection.className = 'suggestion-section';
            
            topRatedSection.innerHTML = `
                <div class="suggestion-header">
                    <h3>Top Rated</h3>
                    <p>Community favorites</p>
                </div>
                <div class="suggestion-carousel" id="top-rated-carousel"></div>
            `;
            
            container.appendChild(topRatedSection);
            
            // Add restaurants to this section
            const carousel = topRatedSection.querySelector('#top-rated-carousel');
            topRated.forEach(restaurant => {
                carousel.appendChild(createRestaurantCard(restaurant));
            });
        }
    })
    .catch(err => {
        console.error('Error loading top rated restaurants:', err);
    });
    
    // 3. Add "Explore Different Cuisines" section
    fetch(`${API_URL}/cuisine-types`)
    .then(response => response.json())
    .then(cuisines => {
        if (cuisines.length > 0) {
            const cuisineSection = document.createElement('div');
            cuisineSection.className = 'suggestion-section';
            
            cuisineSection.innerHTML = `
                <div class="suggestion-header">
                    <h3>Explore by Cuisine</h3>
                    <p>Discover new flavors</p>
                </div>
                <div class="cuisine-tags" id="cuisine-tags"></div>
            `;
            
            container.appendChild(cuisineSection);
            
            // Add cuisine types
            const tagsContainer = cuisineSection.querySelector('#cuisine-tags');
            cuisines.forEach(cuisine => {
                const tag = document.createElement('div');
                tag.className = 'cuisine-tag';
                tag.textContent = cuisine;
                tag.addEventListener('click', () => {
                    // Redirect to restaurants page with this filter
                    document.getElementById('cuisine-select').value = cuisine;
                    filterRestaurants();
                    showPage('restaurants');
                });
                tagsContainer.appendChild(tag);
            });
        }
    })
    .catch(err => {
        console.error('Error loading cuisine types:', err);
    });
    
    // 4. Add "New" section (simulated for this example)
    // In reality, you would need to add a creation date to restaurants
    fetch(`${API_URL}/restaurants`)
    .then(response => response.json())
    .then(allRestaurants => {
        // Simulate new restaurants (in a real system, filter by creation date)
        const newRestaurants = allRestaurants
            .sort(() => 0.5 - Math.random()) // Random sort
            .slice(0, 3);
            
        if (newRestaurants.length > 0) {
            const newSection = document.createElement('div');
            newSection.className = 'suggestion-section';
            
            newSection.innerHTML = `
                <div class="suggestion-header">
                    <h3>New</h3>
                    <p>Discover the latest added restaurants</p>
                </div>
                <div class="suggestion-grid" id="new-restaurants-grid"></div>
            `;
            
            container.appendChild(newSection);
            
            // Add restaurants to this section
            const grid = newSection.querySelector('#new-restaurants-grid');
            newRestaurants.forEach(restaurant => {
                grid.appendChild(createRestaurantCard(restaurant, true));
            });
        }
    })
    .catch(err => {
        console.error('Error loading new restaurants:', err);
    });
}

// Function for simple rendering of suggested restaurants (old mode)
function renderSuggestedRestaurants(data, container) {
    container.innerHTML = '';
    
    // Update intro message
    const introElement = document.getElementById('suggestion-intro');
    if (introElement) {
        introElement.textContent = data.message || 'Personalized suggestions for you';
    }
    
    if (!data.restaurants || data.restaurants.length === 0) {
        container.innerHTML = `
            <div class="empty-suggestions">
                <div class="empty-icon">🍽️</div>
                <h3>No suggestions available</h3>
                <p>Order and rate restaurants to get personalized suggestions.</p>
                <button class="btn-primary" onclick="showPage('restaurants')">Explore restaurants</button>
            </div>
        `;
        return;
    }
    
    // Old mode - simple grid display
    data.restaurants.forEach(restaurant => {
        const imgNum = Math.floor(Math.random() * 5) + 1;
        
        const safeAddress = restaurant.address ? restaurant.address.replace(/'/g, "\\'") : '';
        const safeCuisine = restaurant.cuisine_type ? restaurant.cuisine_type.replace(/'/g, "\\'") : '';
        const safeName = restaurant.name.replace(/'/g, "\\'");
        
        const avgRating = parseFloat(restaurant.avg_rating) || 0;
        const reviewCount = parseInt(restaurant.review_count) || 0;
        
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        
        card.innerHTML = `
            <div class="restaurant-image" style="background-image: url('https://source.unsplash.com/random/300x180/?restaurant,food,${imgNum}')"></div>
            <div class="restaurant-info">
                <h3>${restaurant.name}</h3>
                <p>${restaurant.address || 'Address not available'}</p>
                <div class="restaurant-meta-info">
                    ${restaurant.cuisine_type ? `<span class="cuisine-type">${restaurant.cuisine_type}</span>` : ''}
                    ${avgRating > 0 ? `
                        <div class="restaurant-card-rating">
                            <div class="stars-container">
                                ${renderStars(avgRating)}
                            </div>
                            <span class="rating-value">${formatRating(avgRating)}</span>
                            <span class="rating-count">(${reviewCount})</span>
                        </div>
                    ` : '<span class="no-rating">No reviews yet</span>'}
                </div>
                <button class="btn-view" onclick="viewRestaurant(${restaurant.restaurant_id}, '${safeName}', '${safeAddress}', '${safeCuisine}')">View menu</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// DEBUG FUNCTIONS

// Add this debugging function to user-app.js for testing:
function debugRestaurantRatings() {
    console.log('=== DEBUGGING RESTAURANT RATINGS ===');
    
    fetch(`${API_URL}/restaurants`)
    .then(response => response.json())
    .then(restaurants => {
        console.log('Number of restaurants:', restaurants.length);
        
        restaurants.forEach((restaurant, index) => {
            console.log(`\n--- Restaurant ${index + 1}: ${restaurant.name} ---`);
            console.log('ID:', restaurant.restaurant_id);
            console.log('avg_rating (raw):', restaurant.avg_rating, typeof restaurant.avg_rating);
            console.log('review_count (raw):', restaurant.review_count, typeof restaurant.review_count);
            console.log('avg_rating (parsed):', parseFloat(restaurant.avg_rating));
            console.log('review_count (parsed):', parseInt(restaurant.review_count));
            console.log('Condition (review_count > 0):', parseInt(restaurant.review_count) > 0);
            console.log('Condition (avg_rating > 0):', parseFloat(restaurant.avg_rating) > 0);
            
            // Also test reviews API directly
            fetch(`${API_URL}/restaurants/${restaurant.restaurant_id}/reviews`)
            .then(response => response.json())
            .then(reviewData => {
                console.log(`Direct reviews for ${restaurant.name}:`, {
                    total_reviews: reviewData.total_reviews,
                    avg_rating: reviewData.avg_rating,
                    reviews_count: reviewData.reviews ? reviewData.reviews.length : 0
                });
            })
            .catch(err => console.error(`Review error for ${restaurant.name}:`, err));
        });
    })
    .catch(err => console.error('Debug error:', err));
}

// For testing, open browser console (F12) and type:
// debugRestaurantRatings()

// Also, add this function to force server-side recalculation if needed:
function forceRecalculateRatings() {
    fetch(`${API_URL}/admin/recalculate-ratings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Rating recalculation completed:', data);
        refreshRestaurantData();
    })
    .catch(err => console.error('Recalculation error:', err));
}

// Export functions to make them globally accessible
window.showTab = showTab;
window.viewRestaurant = viewRestaurant;
window.showPage = showPage;
window.filterRestaurants = filterRestaurants;
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.placeOrder = placeOrder;
window.processPayment = processPayment;
window.trackOrder = trackOrder;
window.closeTrackingModal = closeTrackingModal;
window.showReviewForm = showReviewForm;
window.processPayment = processPayment;
window.addEmailField = addEmailField;
window.removeEmailField = removeEmailField;
window.deletePaymentMethod = deletePaymentMethod;
window.addPaymentMethod = addPaymentMethod;
window.addProfilePaymentMethod = addProfilePaymentMethod;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;
window.createSuggestionSections = createSuggestionSections;
window.renderSuggestedRestaurants = renderSuggestedRestaurants;
window.logout = logout;
window.debugRestaurantRatings = debugRestaurantRatings;