// admin.js - Admin panel functionality
import { 
    collection, 
    getDocs, 
    orderBy, 
    query, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// Global variables
let orders = [];
let currentFilter = 'all';
let currentEditingOrder = null;
let unsubscribeListener = null;
let notificationsEnabled = false;

// Available menu items for adding to orders
const menuItems = {
    'tra-da': { name: 'Trà Đá', price: 15000, hasCustomization: false },
    'bim-bim': { name: 'Bim Bim', price: 20000, hasCustomization: false },
    'tra-chanh': { name: 'Trà Chanh', price: 25000, hasCustomization: true },
    'tra-quat': { name: 'Trà Quất', price: 30000, hasCustomization: true }
};

// Initialize admin functionality
async function initializeAdmin() {
    try {
        await loadOrders();
        setupRealtimeListener();
        
        // Request notification permission on load
        await requestNotificationPermission();
        
        console.log('Admin panel initialized successfully');
    } catch (error) {
        console.error('Error initializing admin panel:', error);
        showToast('Lỗi khởi tạo trang quản trị', 'error');
    }
}

// Load orders from Firestore
async function loadOrders() {
    try {
        const ordersQuery = query(
            collection(window.firebaseDb, 'orders'),
            orderBy('orderTime', 'desc')
        );
        
        const querySnapshot = await getDocs(ordersQuery);
        orders = [];
        
        querySnapshot.forEach((doc) => {
            orders.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayOrders();
        updatePendingCount();
        
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Lỗi tải đơn hàng', 'error');
    }
}

// Setup real-time listener for orders
async function setupRealtimeListener() {
    try {
        const ordersQuery = query(
            collection(window.firebaseDb, 'orders'),
            orderBy('orderTime', 'desc')
        );
        
        unsubscribeListener = onSnapshot(ordersQuery, (snapshot) => {
            const newOrders = [];
            
            snapshot.forEach((doc) => {
                newOrders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Check for new orders
            const previousOrderIds = orders.map(order => order.id);
            const newOrderIds = newOrders.map(order => order.id);
            const hasNewOrders = newOrderIds.some(id => !previousOrderIds.includes(id));
            
            if (hasNewOrders && orders.length > 0) {
                showNewOrderNotification();
            }
            
            orders = newOrders;
            displayOrders();
            updatePendingCount();
            
        }, (error) => {
            console.error('Error in real-time listener:', error);
            showToast('Lỗi kết nối real-time', 'error');
        });
        
    } catch (error) {
        console.error('Error setting up real-time listener:', error);
    }
}

// Display orders
function displayOrders() {
    const container = document.getElementById('ordersContainer');
    const emptyState = document.getElementById('emptyState');
    
    // Filter orders based on current filter
    const filteredOrders = currentFilter === 'all' 
        ? orders 
        : orders.filter(order => order.status === currentFilter);
    
    if (filteredOrders.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    
    container.innerHTML = '';
    
    filteredOrders.forEach(order => {
        const orderCard = createOrderCard(order);
        container.appendChild(orderCard);
    });
}

// Create order card element
function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = `order-card ${order.status}`;
    
    const orderTime = new Date(order.orderTime).toLocaleString('vi-VN');
    const orderItems = order.items.map(item => {
        const details = [];
        if (item.sugar !== null && item.sugar !== undefined) details.push(`Đường: ${item.sugar}%`);
        if (item.ice !== null && item.ice !== undefined) details.push(`Đá: ${item.ice}%`);
        if (item.aloe) details.push('Nha đam');
        
        return `
            <div class="order-item">
                <div class="item-details">
                    <div class="item-name">${item.name} x${item.quantity}</div>
                    <div class="item-options">${details.join(', ')}</div>
                    <div class="item-price">${formatPrice(item.totalPrice)}</div>
                </div>
                <div class="item-controls">
                    <button class="btn btn-small btn-primary" onclick="editItemQuantity('${order.id}', ${order.items.indexOf(item)}, ${item.quantity - 1})">-</button>
                    <span>${item.quantity}</span>
                    <button class="btn btn-small btn-primary" onclick="editItemQuantity('${order.id}', ${order.items.indexOf(item)}, ${item.quantity + 1})">+</button>
                    <button class="btn btn-small btn-danger" onclick="removeItemFromOrder('${order.id}', ${order.items.indexOf(item)})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    div.innerHTML = `
        <div class="order-header">
            <div>
                <span class="order-id">Đơn #${order.id.substring(0, 8)}</span>
                <span class="order-time">${orderTime}</span>
            </div>
            <span class="order-status status-${order.status}">
                ${getStatusText(order.status)}
            </span>
        </div>
        
        <div class="order-items">
            ${orderItems}
        </div>
        
        <div class="cart-total">
            <i class="fas fa-calculator"></i> Tổng: ${formatPrice(order.totalAmount)}
        </div>
        
        <div class="order-actions">
            <button class="btn btn-primary" onclick="editOrder('${order.id}')">
                <i class="fas fa-edit"></i> Sửa
            </button>
            ${order.status === 'new' ? `
                <button class="btn btn-warning" onclick="updateOrderStatus('${order.id}', 'processing')">
                    <i class="fas fa-clock"></i> Đang Xử Lý
                </button>
            ` : ''}
            ${order.status === 'processing' ? `
                <button class="btn btn-success" onclick="updateOrderStatus('${order.id}', 'completed')">
                    <i class="fas fa-check"></i> Hoàn Thành
                </button>
            ` : ''}
            ${order.status === 'completed' ? `
                <button class="btn btn-warning" onclick="updateOrderStatus('${order.id}', 'processing')">
                    <i class="fas fa-undo"></i> Hoàn Tác
                </button>
            ` : ''}
            <button class="btn btn-danger" onclick="deleteOrder('${order.id}')">
                <i class="fas fa-trash"></i> Xóa
            </button>
        </div>
    `;
    
    return div;
}

// Get status text in Vietnamese
function getStatusText(status) {
    const statusMap = {
        'new': 'Mới',
        'processing': 'Đang Xử Lý',
        'completed': 'Hoàn Thành'
    };
    return statusMap[status] || status;
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        await updateDoc(doc(window.firebaseDb, 'orders', orderId), {
            status: newStatus
        });
        
        showToast(`Đã cập nhật trạng thái thành "${getStatusText(newStatus)}"`, 'success');
        
    } catch (error) {
        console.error('Error updating order status:', error);
        showToast('Lỗi cập nhật trạng thái', 'error');
    }
}

// Edit item quantity
async function editItemQuantity(orderId, itemIndex, newQuantity) {
    if (newQuantity <= 0) {
        removeItemFromOrder(orderId, itemIndex);
        return;
    }
    
    try {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        
        const item = order.items[itemIndex];
        item.quantity = newQuantity;
        
        // Recalculate item total price
        let itemPrice = item.basePrice * newQuantity;
        if (item.aloe) {
            itemPrice += 5000 * newQuantity; // Aloe topping
        }
        item.totalPrice = itemPrice;
        
        // Recalculate order total
        order.totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
        
        await updateDoc(doc(window.firebaseDb, 'orders', orderId), {
            items: order.items,
            totalAmount: order.totalAmount
        });
        
        showToast('Đã cập nhật số lượng', 'success');
        
    } catch (error) {
        console.error('Error updating item quantity:', error);
        showToast('Lỗi cập nhật số lượng', 'error');
    }
}

// Remove item from order
async function removeItemFromOrder(orderId, itemIndex) {
    if (!confirm('Bạn có chắc muốn xóa món này khỏi đơn hàng?')) return;
    
    try {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        
        // Remove item
        order.items.splice(itemIndex, 1);
        
        // If no items left, delete the order
        if (order.items.length === 0) {
            deleteOrder(orderId);
            return;
        }
        
        // Recalculate total
        order.totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
        
        await updateDoc(doc(window.firebaseDb, 'orders', orderId), {
            items: order.items,
            totalAmount: order.totalAmount
        });
        
        showToast('Đã xóa món khỏi đơn hàng', 'success');
        
    } catch (error) {
        console.error('Error removing item:', error);
        showToast('Lỗi xóa món', 'error');
    }
}

// Delete entire order
async function deleteOrder(orderId) {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ đơn hàng này?')) return;
    
    try {
        await deleteDoc(doc(window.firebaseDb, 'orders', orderId));
        
        showToast('Đã xóa đơn hàng', 'success');
        
    } catch (error) {
        console.error('Error deleting order:', error);
        showToast('Lỗi xóa đơn hàng', 'error');
    }
}

// Edit order (open modal)
function editOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    currentEditingOrder = { ...order };
    
    // Populate edit modal
    const editItemsContainer = document.getElementById('editOrderItems');
    editItemsContainer.innerHTML = `
        <h3>Món trong đơn hàng:</h3>
        <div id="currentOrderItems">
            ${order.items.map((item, index) => `
                <div class="order-item">
                    <div class="item-details">
                        <div class="item-name">${item.name}</div>
                        <div class="item-options">
                            ${item.sugar !== null ? `Đường: ${item.sugar}%, ` : ''}
                            ${item.ice !== null ? `Đá: ${item.ice}%, ` : ''}
                            ${item.aloe ? 'Nha đam' : ''}
                        </div>
                    </div>
                    <div class="item-controls">
                        <button class="btn btn-small btn-primary" onclick="editModalItemQuantity(${index}, ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" onchange="editModalItemQuantity(${index}, parseInt(this.value))" style="width: 60px; text-align: center;">
                        <button class="btn btn-small btn-primary" onclick="editModalItemQuantity(${index}, ${item.quantity + 1})">+</button>
                        <button class="btn btn-small btn-danger" onclick="removeModalItem(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <h3 style="margin-top: 2rem;">Thêm món mới:</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            ${Object.entries(menuItems).map(([id, item]) => `
                <button class="btn btn-primary" onclick="addItemToEditOrder('${id}')">
                    ${item.name} - ${formatPrice(item.price)}
                </button>
            `).join('')}
        </div>
    `;
    
    document.getElementById('editOrderModal').style.display = 'block';
}

// Edit item quantity in modal
function editModalItemQuantity(itemIndex, newQuantity) {
    if (newQuantity <= 0) {
        removeModalItem(itemIndex);
        return;
    }
    
    currentEditingOrder.items[itemIndex].quantity = newQuantity;
    
    // Recalculate item price
    const item = currentEditingOrder.items[itemIndex];
    let itemPrice = item.basePrice * newQuantity;
    if (item.aloe) {
        itemPrice += 5000 * newQuantity;
    }
    item.totalPrice = itemPrice;
    
    // Update display
    editOrder(currentEditingOrder.id);
}

// Remove item from modal
function removeModalItem(itemIndex) {
    currentEditingOrder.items.splice(itemIndex, 1);
    editOrder(currentEditingOrder.id);
}

// Add item to order being edited
function addItemToEditOrder(itemId) {
    const menuItem = menuItems[itemId];
    const newItem = {
        name: menuItem.name,
        quantity: 1,
        basePrice: menuItem.price,
        totalPrice: menuItem.price,
        sugar: menuItem.hasCustomization ? 50 : null,
        ice: menuItem.hasCustomization ? 50 : null,
        aloe: false
    };
    
    currentEditingOrder.items.push(newItem);
    editOrder(currentEditingOrder.id);
}

// Save order changes
async function saveOrderChanges() {
    if (!currentEditingOrder || currentEditingOrder.items.length === 0) {
        showToast('Đơn hàng phải có ít nhất 1 món', 'error');
        return;
    }
    
    try {
        // Recalculate total
        currentEditingOrder.totalAmount = currentEditingOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
        
        await updateDoc(doc(window.firebaseDb, 'orders', currentEditingOrder.id), {
            items: currentEditingOrder.items,
            totalAmount: currentEditingOrder.totalAmount
        });
        
        showToast('Đã lưu thay đổi đơn hàng', 'success');
        closeEditModal();
        
    } catch (error) {
        console.error('Error saving order changes:', error);
        showToast('Lỗi lưu thay đổi', 'error');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editOrderModal').style.display = 'none';
    currentEditingOrder = null;
}

// Filter orders
function filterOrders(status) {
    currentFilter = status;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${status}"]`).classList.add('active');
    
    displayOrders();
}

// Update pending count
function updatePendingCount() {
    const pendingOrders = orders.filter(order => order.status === 'new').length;
    document.getElementById('pendingCount').textContent = pendingOrders;
}

// Refresh orders manually
function refreshOrders() {
    loadOrders();
    showToast('Đã làm mới danh sách đơn hàng', 'success');
}

// Toggle notifications
async function toggleNotifications() {
    const btn = document.getElementById('notificationBtn');
    
    if (!notificationsEnabled) {
        try {
            const token = await window.requestNotificationPermission();
            if (token) {
                notificationsEnabled = true;
                btn.innerHTML = '<i class="fas fa-bell-slash"></i> Tắt Thông Báo';
                btn.className = 'btn btn-danger';
                showToast('Đã bật thông báo push', 'success');
            } else {
                showToast('Không thể bật thông báo', 'error');
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            showToast('Lỗi bật thông báo', 'error');
        }
    } else {
        notificationsEnabled = false;
        btn.innerHTML = '<i class="fas fa-bell"></i> Bật Thông Báo';
        btn.className = 'btn btn-warning';
        showToast('Đã tắt thông báo push', 'warning');
    }
}

// Show new order notification
function showNewOrderNotification() {
    if (notificationsEnabled) {
        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Đơn hàng mới!', {
                body: 'Có đơn hàng mới cần xử lý',
                icon: '/favicon.ico',
                tag: 'new-order'
            });
        }
    }
    
    // Show toast notification
    showToast('Có đơn hàng mới!', 'warning');
    
    // Play notification sound (optional)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAaATqO1O/ReSnbM/LNQAoUXrTpVFApGn+DyvmAaATqOVSNwgZaLvt1VFApGnhVFApGn+DyvmAaATqOVSNwgZaLvtVFApGnhVFA');
        audio.play().catch(() => {}); // Ignore errors if audio can't play
    } catch (error) {
        // Ignore audio errors
    }
}

// Request notification permission
async function requestNotificationPermission() {
    if (!window.requestNotificationPermission) {
        console.log('FCM not available');
        return null;
    }
    
    try {
        const token = await window.requestNotificationPermission();
        return token;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return null;
    }
}

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
}

// Show toast notification
function showToast(message, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editOrderModal');
    if (event.target === modal) {
        closeEditModal();
    }
}

// Handle keyboard events
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEditModal();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeListener) {
        unsubscribeListener();
    }
});

// Make functions available globally
window.initializeAdmin = initializeAdmin;
window.filterOrders = filterOrders;
window.refreshOrders = refreshOrders;
window.toggleNotifications = toggleNotifications;
window.updateOrderStatus = updateOrderStatus;
window.editItemQuantity = editItemQuantity;
window.removeItemFromOrder = removeItemFromOrder;
window.deleteOrder = deleteOrder;
window.editOrder = editOrder;
window.closeEditModal = closeEditModal;
window.saveOrderChanges = saveOrderChanges;
window.editModalItemQuantity = editModalItemQuantity;
window.removeModalItem = removeModalItem;
window.addItemToEditOrder = addItemToEditOrder;
