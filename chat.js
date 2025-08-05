// js/chat.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const chatHeaderName = document.getElementById('chat-header-name');
const chatMessagesContainer = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

let currentUser = null;
let otherUserId = null;
let chatId = null;
let unsubscribeMessages = null;

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const urlParams = new URLSearchParams(window.location.search);
        otherUserId = urlParams.get('with');

        if (otherUserId) {
            initializeChat();
        } else {
            chatHeaderName.textContent = "No user selected";
        }
    } else {
        window.location.href = 'index.html';
    }
});

/**
 * Sets up the chat room.
 */
async function initializeChat() {
    chatId = [currentUser.uid, otherUserId].sort().join('_');

    const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
    if (otherUserDoc.exists()) {
        chatHeaderName.textContent = `Chat with ${otherUserDoc.data().name}`;
    }

    listenForMessages();
}

/**
 * Listens for real-time messages and handles marking them as read.
 */
function listenForMessages() {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatMessagesContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const messageData = { id: doc.id, ...doc.data() };
            displayMessage(messageData);
            
            // NEW: Logic for disappearing messages
            // If the message is from the other user and hasn't been read by me yet
            if (messageData.senderId === otherUserId && !(messageData.readBy?.includes(currentUser.uid))) {
                markAsReadAndDeleteAfterDelay(messageData.id);
            }
        });
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    });
}

/**
 * Marks a message as read by the current user and sets a timer to delete it.
 * @param {string} messageId - The ID of the message document.
 */
async function markAsReadAndDeleteAfterDelay(messageId) {
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    try {
        // Mark the message as read by adding the current user's ID to the 'readBy' array.
        await updateDoc(messageRef, {
            readBy: arrayUnion(currentUser.uid)
        });

        // Set a 5-minute timer to delete the message.
        // NOTE: This relies on the user keeping the tab open. For guaranteed deletion,
        // a server-side Cloud Function is the recommended approach.
        setTimeout(() => {
            deleteDoc(messageRef).then(() => {
                console.log(`Message ${messageId} deleted after 5 minutes.`);
            }).catch(error => {
                console.error("Error deleting message:", error);
            });
        }, 300000); // 300,000 milliseconds = 5 minutes

    } catch (error) {
        console.error("Error marking message as read:", error);
    }
}


/**
 * Displays a single message bubble.
 * @param {object} messageData - The data for a single message.
 */
function displayMessage(messageData) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'flex w-full';
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    messageBubble.textContent = messageData.text;

    if (messageData.senderId === currentUser.uid) {
        messageBubble.classList.add('sent');
        messageWrapper.classList.add('justify-end');
    } else {
        messageBubble.classList.add('received');
        messageWrapper.classList.add('justify-start');
    }
    
    messageWrapper.appendChild(messageBubble);
    chatMessagesContainer.appendChild(messageWrapper);
}

/**
 * Handles sending a new message.
 */
async function sendMessage(e) {
    e.preventDefault();
    const messageText = messageInput.value.trim();

    if (messageText && chatId) {
        const messagesRef = collection(db, "chats", chatId, "messages");
        try {
            await addDoc(messagesRef, {
                text: messageText,
                senderId: currentUser.uid,
                receiverId: otherUserId,
                timestamp: serverTimestamp(),
                readBy: [] // Initialize readBy as an empty array
            });
            messageInput.value = '';
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Could not send message.");
        }
    }
}

// --- EVENT LISTENERS ---
if (messageForm) {
    messageForm.addEventListener('submit', sendMessage);
}

window.addEventListener('beforeunload', () => {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
});
