// script.js - Customer ordering page functionality
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// Menu data
const menuItems = {
    'tra-da': {
        name: 'Trà Đá',
        price: 15000,
        hasCustomization: false
    },
    'bim-bim': {
        name: 'Bim Bim',
        price: 20000,
        hasCustomization: false
    },
    'tra-chanh': {
        name: 'Trà Chanh',
        price: 25000,
        hasCustomization: true
    },
    'tra-quat': {
        name: 'Trà Quất',
        price: 30000,
        hasCustomization: true
    }
};

// Global variables
let currentItem = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentQuantity = 1;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    updateCartDisplay();
    setupPercentageButtons();
});

// Setup percentage button event listeners
function setupPercentageButtons() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('percentage-btn')) {
            // Remove active class from siblings
            const buttons = e.target.parentElement.querySelectorAll('.percentage-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            e.target.classList.add('active');
        }
    });
}

// Open customization modal
function openCustomizationModal(itemId) {
    currentItem = itemId;
    const item = menuItems[itemId];
    
    // Set modal title
    document.getElementById('modalTitle').textContent = `Tùy Chỉnh ${item.name}`;
    
    // Show/hide customization options based on item type
    const hasCustomization = item.hasCustomization;
    document.getElementById('sugarOptions').style.display = hasCustomization ? 'block' : 'none';
    document.getElementById('iceOptions').style.display = hasCustomization ? 'block' : 'none';
    document.getElementById('toppingOptions').style.display = hasCustomization ? 'block' : 'none';
    
    // Reset form
    resetModalForm();
    
    // Show modal
    document.getElementById('customizationModal').style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('customizationModal').style.display = 'none';
    currentItem = null;
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('customizationModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Reset modal form
function resetModalForm() {
    // Reset quantity
    currentQuantity = 1;
    document.getElementById('quantityDisplay').textContent = '1';
    
    // Reset percentage buttons
    document.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.value === '50') {
            btn.classList.add('active');
        }
    });
    
    // Reset topping checkbox
    document.getElementById('aloeTopping').checked = false;
}

// Change quantity
function changeQuantity(delta) {
    currentQuantity = Math.max(1, currentQuantity + delta);
    document.getElementById('quantityDisplay').textContent = currentQuantity;
}

// Get selected sugar percentage
function getSelectedSugar() {
    const activeBtn = document.querySelector('#sugarOptions .percentage-btn.active');
    return activeBtn ? parseInt(activeBtn.dataset.value) : 50;
}

// Get selected ice percentage
function getSelectedIce() {
    const activeBtn = document.querySelector('#iceOptions .percentage-btn.active');
    return activeBtn ? parseInt(activeBtn.dataset.value) : 50;
}

// Get topping selection
function hasAloeTopping() {
    return document.getElementById('aloeTopping').checked;
}

// Add item to cart
function addToCart() {
    if (!currentItem) return;
    
    const item = menuItems[currentItem];
    const cartItem = {
        id: Date.now() + Math.random(), // Unique ID
        itemId: currentItem,
        name: item.name,
        basePrice: item.price,
        quantity: currentQuantity,
        sugar: item.hasCustomization ? getSelectedSugar() : null,
        ice: item.hasCustomization ? getSelectedIce() : null,
        aloe: item.hasCustomization ? hasAloeTopping() : false,
        totalPrice: calculateItemPrice(item, currentQuantity, hasAloeTopping())
    };
    
    cart.push(cartItem);
    saveCart();
    updateCartDisplay();
    
    // Show success message
    showToast('Đã thêm vào giỏ hàng!', 'success');
    
    // Close modal
    closeModal();
}

// Calculate item price including toppings
function calculateItemPrice(item, quantity, hasAloe) {
    let price = item.basePrice * quantity;
    if (hasAloe) {
        price += 5000 * quantity; // 5,000 VND per aloe topping
    }
    return price;
}

// Remove item from cart
function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
    updateCartDisplay();
    showToast('Đã xóa khỏi giỏ hàng', 'warning');
}

// Update item quantity in cart
function updateCartItemQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(itemId);
        return;
    }
    
    const cartItem = cart.find(item => item.id === itemId);
    if (cartItem) {
        cartItem.quantity = newQuantity;
        cartItem.totalPrice = calculateItemPrice(
            { basePrice: cartItem.basePrice }, 
            newQuantity, 
            cartItem.aloe
        );
        saveCart();
        updateCartDisplay();
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Update cart display
function updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalElement = document.getElementById('cartTotal');
    const orderBtn = document.getElementById('orderBtn');
    
    // Clear current display
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Giỏ hàng trống</p>
                <small>Hãy chọn món để thêm vào giỏ hàng</small>
            </div>
        `;
        cartTotalElement.textContent = '0 VNĐ';
        orderBtn.disabled = true;
        return;
    }
    
    // Display cart items
    let total = 0;
    cart.forEach(item => {
        total += item.totalPrice;
        
        const itemDetails = [];
        if (item.sugar !== null) itemDetails.push(`Đường: ${item.sugar}%`);
        if (item.ice !== null) itemDetails.push(`Đá: ${item.ice}%`);
        if (item.aloe) itemDetails.push('Nha đam');
        
        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-details">${itemDetails.join(', ')}</div>
                    <div class="cart-item-price">${formatPrice(item.totalPrice)}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="btn-quantity" onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <input type="number" class="cart-item-quantity" value="${item.quantity}" 
                           onchange="updateCartItemQuantity(${item.id}, parseInt(this.value))" min="1">
                    <button class="btn-quantity" onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    <button class="btn-remove" onclick="removeFromCart(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    cartTotalElement.textContent = formatPrice(total);
    orderBtn.disabled = false;
}

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
}

// Place order
async function placeOrder() {
    if (cart.length === 0) {
        showToast('Giỏ hàng trống!', 'error');
        return;
    }
    
    try {
        // Disable order button to prevent double submission
        const orderBtn = document.getElementById('orderBtn');
        orderBtn.disabled = true;
        orderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        
        // Prepare order data
        const orderData = {
            items: cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                basePrice: item.basePrice,
                totalPrice: item.totalPrice,
                sugar: item.sugar,
                ice: item.ice,
                aloe: item.aloe
            })),
            totalAmount: cart.reduce((sum, item) => sum + item.totalPrice, 0),
            orderTime: new Date().toISOString(),
            status: 'new'
        };
        
        // Add order to Firestore
        const docRef = await addDoc(collection(window.firebaseDb, 'orders'), orderData);
        
        console.log('Order placed with ID:', docRef.id);
        
        // Clear cart
        cart = [];
        saveCart();
        updateCartDisplay();
        
        // Show success message
        showToast('Đặt hàng thành công! Mã đơn hàng: ' + docRef.id.substring(0, 8), 'success');
        
    } catch (error) {
        console.error('Error placing order:', error);
        showToast('Lỗi khi đặt hàng. Vui lòng thử lại!', 'error');
    } finally {
        // Re-enable order button
        const orderBtn = document.getElementById('orderBtn');
        orderBtn.disabled = cart.length === 0;
        orderBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Đặt Hàng';
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Handle keyboard events
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});
