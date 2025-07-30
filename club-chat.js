// js/club-chat.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentLoggedInUser = null;
let currentClubId = null;
let currentClubName = '';
let unsubscribeChat = null; // To unsubscribe from chat messages listener
let unsubscribeMembers = null; // To unsubscribe from members listener

const CLUB_MEMBER_LIMIT = 500; // Define the member limit

// --- DOM Elements ---
const logoutButton = document.getElementById('logout-btn');
const chatPageTitle = document.getElementById('chat-page-title');
const chatClubName = document.getElementById('chat-club-name');
const chatMessagesContainer = document.getElementById('chat-messages');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatMessageBtn = document.getElementById('send-chat-message-btn');
const memberListElement = document.getElementById('member-list');
const currentMemberCountHeader = document.getElementById('current-member-count-header');
const leaveClubChatBtn = document.getElementById('leave-club-chat-btn');

// Signup/Login Modal Elements (reused from other pages)
const signupModal = document.getElementById('signup-modal');
const modalSignupBtn = document.getElementById('modal-signup-btn');
const modalLoginBtn = document.getElementById('modal-login-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// --- Helper Functions ---

// Function to format timestamp to "X [unit] ago"
function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) {
        return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `${days}d ago`;
    }
    // Fallback for older posts: Month Day, Year
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Function to get initials from a name for an avatar placeholder
function getInitials(name) {
    if (!name) return '??';
    const parts = name.split(' ').filter(Boolean); // Split by space and remove empty strings
    if (parts.length === 1) {
        return parts[0][0].toUpperCase();
    }
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return '??';
}

// --- CUSTOM MESSAGE BOX (instead of alert) ---
function displayMessage(message, type = "info") {
    const messageBox = document.getElementById('message-box');
    messageBox.textContent = message;
    messageBox.className = `message-box show ${type}`; // Add type class for styling
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

// --- MODAL FUNCTIONS (reused from other pages) ---
function showSignupModal() {
    if (signupModal) {
        signupModal.classList.remove('hidden');
    }
}

function hideSignupModal() {
    if (signupModal) {
        signupModal.classList.add('hidden');
    }
}

// --- MODAL EVENT LISTENERS (reused from other pages) ---
if (modalSignupBtn) {
    modalSignupBtn.addEventListener('click', () => {
        window.location.href = 'index.html'; // Redirect to signup/login page
    });
}

if (modalLoginBtn) {
    modalLoginBtn.addEventListener('click', () => {
        window.location.href = 'index.html'; // Redirect to signup/login page
    });
}

if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', hideSignupModal);
}

// --- INITIALIZATION ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentClubId = urlParams.get('clubId');
    currentClubName = urlParams.get('clubName');

    if (!currentClubId) {
        displayMessage("No club selected. Redirecting to clubs page.", "error");
        setTimeout(() => { window.location.href = 'club.html'; }, 2000);
        return;
    }

    if (currentClubName) {
        chatPageTitle.textContent = `${decodeURIComponent(currentClubName)} Chat - TownBoat`;
        chatClubName.textContent = decodeURIComponent(currentClubName);
    } else {
        chatPageTitle.textContent = `Club Chat - TownBoat`;
        chatClubName.textContent = `Club Chat`;
    }

    // --- AUTHENTICATION CHECK ---
    onAuthStateChanged(auth, async (user) => {
        currentLoggedInUser = user;
        if (user) {
            console.log("User logged in:", user.uid, user.displayName || user.email);
            // Check if user is a member of this club
            const clubRef = doc(db, "clubs", currentClubId);
            try {
                const clubDoc = await getDoc(clubRef);
                if (clubDoc.exists() && clubDoc.data().members.includes(user.uid)) {
                    // User is a member, proceed with chat
                    fetchAndDisplayChatMessages(currentClubId);
                    fetchClubMembers(currentClubId);
                } else {
                    displayMessage("You are not a member of this club. Redirecting.", "error");
                    setTimeout(() => { window.location.href = 'club.html'; }, 2000);
                }
            } catch (error) {
                console.error("Error checking club membership:", error);
                displayMessage("Failed to verify club membership. Redirecting.", "error");
                setTimeout(() => { window.location.href = 'club.html'; }, 2000);
            }
        } else {
            console.log("No user logged in. Redirecting to login.");
            showSignupModal(); // Show login modal if not logged in
        }
    });

    // Send message on Enter key press
    if (chatMessageInput) {
        chatMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }

    if (sendChatMessageBtn) {
        sendChatMessageBtn.addEventListener('click', sendChatMessage);
    }

    if (leaveClubChatBtn) {
        leaveClubChatBtn.addEventListener('click', () => leaveClub(currentClubId));
    }

    // --- LOGOUT BUTTON ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log("User signed out.");
                window.location.href = 'index.html'; // Redirect to the main login page
            }).catch((error) => {
                console.error("Error signing out:", error);
                displayMessage("Failed to log out. Please try again.", "error");
            });
        });
    }
});

async function sendChatMessage() {
    if (!currentLoggedInUser || !currentClubId) {
        showSignupModal(); // Should not happen if logic is correct, but for safety
        return;
    }

    const messageContent = chatMessageInput.value.trim();
    if (!messageContent) {
        return; // Don't send empty messages
    }

    try {
        await addDoc(collection(db, `clubs/${currentClubId}/chats`), {
            senderId: currentLoggedInUser.uid,
            senderName: currentLoggedInUser.displayName || 'Anonymous User',
            content: messageContent,
            timestamp: serverTimestamp(),
        });
        chatMessageInput.value = ''; // Clear input
        // Messages will be displayed via onSnapshot
    } catch (error) {
        console.error("Error sending message:", error);
        displayMessage("Failed to send message. Please try again.", "error");
    }
}

function fetchAndDisplayChatMessages(clubId) {
    const chatQuery = query(collection(db, `clubs/${clubId}/chats`), orderBy("timestamp", "asc")); // Order by asc for chat flow

    // Unsubscribe from previous listener if any
    if (unsubscribeChat) {
        unsubscribeChat();
    }

    unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
        chatMessagesContainer.innerHTML = ''; // Clear existing messages
        if (snapshot.empty) {
            chatMessagesContainer.innerHTML = '<p class="text-gray-500 text-center">No messages yet. Say hello!</p>';
            return;
        }

        snapshot.forEach((messageDoc) => {
            const message = messageDoc.data();
            const messageElement = document.createElement('div');
            const isSelf = message.senderId === currentLoggedInUser.uid;
            messageElement.classList.add('chat-message-item', isSelf ? 'self' : 'other');

            const senderName = message.senderName || 'Anonymous User';
            const timeAgo = message.timestamp ? formatTimeAgo(message.timestamp) : 'Just now';

            messageElement.innerHTML = `
                <div class="chat-message-bubble ${isSelf ? 'self' : 'other'}">
                    ${message.content}
                </div>
                <div class="chat-message-info ${isSelf ? 'self' : 'other'}">
                    ${isSelf ? '' : `<span>${senderName}</span> - `}
                    <span>${timeAgo}</span>
                </div>
            `;
            chatMessagesContainer.appendChild(messageElement);
        });

        // Scroll to the bottom of the chat
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }, (error) => {
        console.error("Error fetching chat messages:", error);
        chatMessagesContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load messages.</p>';
    });
}

async function fetchClubMembers(clubId) {
    memberListElement.innerHTML = ''; // Clear existing members
    currentMemberCountHeader.textContent = `0/${CLUB_MEMBER_LIMIT} Members`;

    // Unsubscribe from previous listener if any
    if (unsubscribeMembers) {
        unsubscribeMembers();
    }

    const clubRef = doc(db, "clubs", clubId);
    unsubscribeMembers = onSnapshot(clubRef, (clubDoc) => {
        if (!clubDoc.exists()) {
            memberListElement.innerHTML = '<p class="text-gray-500 text-sm">Club not found.</p>';
            currentMemberCountHeader.textContent = `0/${CLUB_MEMBER_LIMIT} Members`;
            return;
        }
        const clubData = clubDoc.data();
        const members = clubData.members || [];
        currentMemberCountHeader.textContent = `${members.length}/${CLUB_MEMBER_LIMIT} Members`;
        memberListElement.innerHTML = ''; // Clear for fresh render

        if (members.length === 0) {
            memberListElement.innerHTML = '<p class="text-gray-500 text-sm">No members yet.</p>';
            return;
        }

        // Fetch user display names for members
        members.forEach(memberId => {
            const memberItem = document.createElement('li');
            memberItem.classList.add('member-item');
            
            let memberName = memberId; // Default to UID
            if (currentLoggedInUser && currentLoggedInUser.uid === memberId) {
                memberName = currentLoggedInUser.displayName || 'You';
            } else {
                // In a real app, you'd fetch this from a 'users' collection:
                // For now, we'll just display the UID or a placeholder.
                // If you have a 'users' collection with displayName, you'd do an async fetch here
                // and then update the specific memberItem once the name is resolved.
            }

            const memberInitials = getInitials(memberName);

            memberItem.innerHTML = `
                <div class="member-avatar">${memberInitials}</div>
                <span class="member-name">${memberName}</span>
                ${memberId === clubData.createdBy ? '<span class="member-role">(Admin)</span>' : ''}
            `;
            memberListElement.appendChild(memberItem);
        });
    }, (error) => {
        console.error("Error fetching club members:", error);
        memberListElement.innerHTML = '<p class="text-red-500 text-sm">Failed to load members.</p>';
        currentMemberCountHeader.textContent = `Error loading members`;
    });
}

// --- LEAVE CLUB LOGIC (re-implemented for club-chat.js) ---
async function leaveClub(clubId) {
    if (!currentLoggedInUser) {
        showSignupModal();
        return;
    }

    const clubRef = doc(db, "clubs", clubId);
    try {
        const clubDoc = await getDoc(clubRef);
        if (!clubDoc.exists()) {
            displayMessage("Club not found.", "error");
            return;
        }
        const clubData = clubDoc.data();
        if (!clubData.members.includes(currentLoggedInUser.uid)) {
            displayMessage("You are not a member of this club.", "info");
            return;
        }

        await updateDoc(clubRef, {
            members: arrayRemove(currentLoggedInUser.uid),
            memberCount: Math.max(0, (clubData.memberCount || 0) - 1), // Ensure count doesn't go negative
        });
        displayMessage("You have left the club. Redirecting to clubs list.", "info");
        console.log("Left club:", clubId);
        // Redirect to the clubs list page after leaving
        setTimeout(() => {
            window.location.href = 'club.html';
        }, 1500);
    } catch (error) {
        console.error("Error leaving club:", error);
        displayMessage(`Failed to leave club: ${error.message}`, "error");
    }
}