// firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

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

// VAPID key for Firebase Cloud Messaging
const vapidKey = "BJXPaiZL-lYNsbU_u59EnHXFq4o6eb2QvaNpNGVzY9NxhUNhLJmMFN46iuXPJNyFIfWOroXYblJ4HiClDoUA6ic";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging = null;
try {
    messaging = getMessaging(app);
} catch (error) {
    console.log('Firebase Messaging not supported in this environment:', error);
}

// Function to request notification permission and get FCM token
async function requestNotificationPermission() {
    if (!messaging) {
        console.log('Firebase Messaging not available');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            
            const currentToken = await getToken(messaging, { vapidKey: vapidKey });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                return currentToken;
            } else {
                console.log('No registration token available.');
                return null;
            }
        } else {
            console.log('Unable to get permission to notify.');
            return null;
        }
    } catch (error) {
        console.error('An error occurred while retrieving token:', error);
        return null;
    }
}

// Function to handle foreground messages
function setupForegroundMessageHandling() {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
        console.log('Message received in foreground:', payload);
        
        // Show notification manually since we're in foreground
        if (payload.notification) {
            const notificationTitle = payload.notification.title || 'Đơn hàng mới';
            const notificationOptions = {
                body: payload.notification.body || 'Có đơn hàng mới cần xử lý',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'order-notification',
                requireInteraction: true
            };

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(notificationTitle, notificationOptions);
                });
            } else {
                new Notification(notificationTitle, notificationOptions);
            }
        }
        
        // Update UI if on admin page
        if (window.location.pathname.includes('admin.html')) {
            window.location.reload(); // Simple refresh for real-time update
        }
    });
}

// Export for use in other files
window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseMessaging = messaging;
window.requestNotificationPermission = requestNotificationPermission;
window.setupForegroundMessageHandling = setupForegroundMessageHandling;

// Export as ES6 modules for other scripts
export { app, db, messaging, requestNotificationPermission, setupForegroundMessageHandling };
