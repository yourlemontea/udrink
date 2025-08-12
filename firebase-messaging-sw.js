// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCgJYCKOeHmh57ro5vQ4JWJX-szldH-UeA",
    authDomain: "pdlvt-9aae7.firebaseapp.com",
    projectId: "pdlvt-9aae7",
    storageBucket: "pdlvt-9aae7.firebasestorage.app",
    messagingSenderId: "373888053638",
    appId: "1:373888053638:web:e50174ab1ab789bfe53c07",
    measurementId: "G-25P00B0M3Q"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification?.title || 'Đơn hàng mới';
    const notificationOptions = {
        body: payload.notification?.body || 'Có đơn hàng mới cần xử lý',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'order-notification',
        requireInteraction: true,
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    
    event.notification.close();
    
    // Open admin page when notification is clicked
    event.waitUntil(
        clients.openWindow('/admin.html')
    );
});
