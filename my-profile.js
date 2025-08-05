// js/my-profile.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    onSnapshot,
    deleteDoc,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const loadingState = document.getElementById('loading-state');
const profileView = document.getElementById('profile-view');
const profileEditView = document.getElementById('profile-edit-view');
const profileForm = document.getElementById('profile-form');

// View State Elements
const profileImageDisplay = document.getElementById('profile-image-display');
const profileNameDisplay = document.getElementById('profile-name-display');
const profileHometownDisplay = document.getElementById('profile-hometown-display');
const profileBioDisplay = document.getElementById('profile-bio-display');
const profileInterestsDisplay = document.getElementById('profile-interests-display');
const editProfileBtn = document.getElementById('edit-profile-btn');
const connectionsCountEl = document.getElementById('connections-count');
const requestsCountEl = document.getElementById('requests-count');

// Edit State Elements
const profileImagePreview = document.getElementById('profile-image-preview');
const profileImageUpload = document.getElementById('profile-image-upload');
const profileNameInput = document.getElementById('profile-name');
const profileHometownSelect = document.getElementById('profile-hometown');
const profileBioInput = document.getElementById('profile-bio');
const profileInterestsInput = document.getElementById('profile-interests');
const statusMessage = document.getElementById('status-message');
const saveProfileBtn = document.getElementById('save-profile-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const logoutButton = document.getElementById('logout-btn');
const logoutButtonMobile = document.getElementById('logout-btn-mobile');

// Connection Elements
const connectionRequestsList = document.getElementById('connection-requests-list');
const noRequestsMessage = document.getElementById('no-requests-message');
const myConnectionsList = document.getElementById('my-connections-list');
const noConnectionsMessage = document.getElementById('no-connections-message');
const connectionsSearchInput = document.getElementById('connections-search');

// Tab Elements
const connectionsTab = document.getElementById('connections-tab');
const requestsTab = document.getElementById('requests-tab');
const connectionsContent = document.getElementById('connections-content');
const requestsContent = document.getElementById('requests-content');

let currentUser = null;
let selectedProfileImageFile = null;
let currentUserData = null;
let allConnections = []; // For searching

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadProfileData(user.uid);
        fetchConnectionRequests(user.uid);
        fetchConnections(user.uid);
        populateHometowns();
    } else {
        window.location.href = 'index.html';
    }
});

async function loadProfileData(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserData = { uid, ...userDocSnap.data() }; // Ensure UID is part of the object
            displayProfileView(currentUserData);
            loadingState.classList.add('hidden');
            profileView.classList.remove('hidden');
        } else {
            loadingState.textContent = "Could not find your profile.";
        }
    } catch (error) {
        console.error("Error loading profile data:", error);
        loadingState.textContent = "Error loading your profile.";
    }
}

function displayProfileView(userData) {
    // CORRECTED: Use UID as a fallback seed for the avatar if the name is missing.
    profileImageDisplay.src = userData.profileImageUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${userData.name || userData.uid}`;
    profileNameDisplay.textContent = userData.name || 'Anonymous User';
    profileHometownDisplay.textContent = userData.hometown || 'No hometown set';
    profileBioDisplay.textContent = userData.bio || 'No bio yet. Click edit to add one!';
    
    profileInterestsDisplay.innerHTML = '';
    if (userData.interests && userData.interests.length > 0) {
        userData.interests.forEach(interest => {
            const tag = document.createElement('span');
            tag.className = 'bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full';
            tag.textContent = interest;
            profileInterestsDisplay.appendChild(tag);
        });
    } else {
        profileInterestsDisplay.innerHTML = '<p class="text-sm text-gray-500">No interests listed.</p>';
    }
}

function populateEditForm(userData) {
    // CORRECTED: Use UID as a fallback seed for the avatar if the name is missing.
    profileImagePreview.src = userData.profileImageUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${userData.name || userData.uid}`;
    profileNameInput.value = userData.name || '';
    profileHometownSelect.value = userData.hometown || '';
    profileBioInput.value = userData.bio || '';
    profileInterestsInput.value = (userData.interests || []).join(', ');
}

async function populateHometowns() {
    try {
        const townsSnapshot = await getDocs(query(collection(db, "towns"), orderBy("name")));
        profileHometownSelect.innerHTML = '<option value="">Select your town</option>';
        townsSnapshot.forEach(doc => {
            const townName = doc.data().name;
            const option = new Option(townName, townName);
            profileHometownSelect.add(option);
        });
    } catch (error) {
        console.error("Error populating hometowns:", error);
    }
}

function fetchConnectionRequests(uid) {
    const q = query(collection(db, "connections"), where("receiverId", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, async (snapshot) => {
        requestsCountEl.textContent = snapshot.size;
        if (snapshot.empty) {
            connectionRequestsList.innerHTML = '';
            noRequestsMessage.classList.remove('hidden');
            return;
        }
        noRequestsMessage.classList.add('hidden');
        connectionRequestsList.innerHTML = '';
        for (const connectionDoc of snapshot.docs) {
            const connection = { id: connectionDoc.id, ...connectionDoc.data() };
            const userDoc = await getDoc(doc(db, "users", connection.senderId));
            if (userDoc.exists()) {
                const requestEl = createConnectionCard(userDoc.data(), connection.id, 'request');
                connectionRequestsList.appendChild(requestEl);
            }
        }
    });
}

function fetchConnections(uid) {
    const q = query(collection(db, "connections"), where("participants", "array-contains", uid), where("status", "==", "accepted"));
    onSnapshot(q, async (snapshot) => {
        connectionsCountEl.textContent = snapshot.size;
        if (snapshot.empty) {
            allConnections = [];
            displayConnections([]);
            return;
        }
        
        const connectionsPromises = snapshot.docs.map(async (connectionDoc) => {
            const connection = {id: connectionDoc.id, ...connectionDoc.data()};
            const otherUserId = connection.participants.find(id => id !== uid);
            if (otherUserId) {
                const userDoc = await getDoc(doc(db, "users", otherUserId));
                if (userDoc.exists()) {
                    return {uid: otherUserId, ...userDoc.data()};
                }
            }
            return null;
        });

        allConnections = (await Promise.all(connectionsPromises)).filter(Boolean);
        displayConnections(allConnections);
    });
}

function displayConnections(connectionsToDisplay) {
    myConnectionsList.innerHTML = '';
    if (connectionsToDisplay.length === 0) {
        noConnectionsMessage.classList.remove('hidden');
    } else {
        noConnectionsMessage.classList.add('hidden');
        connectionsToDisplay.forEach(friendData => {
            const connectionEl = createConnectionCard(friendData, null, 'connection');
            myConnectionsList.appendChild(connectionEl);
        });
    }
}

function createConnectionCard(userData, connectionId, type) {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
    const profileImageUrl = userData.profileImageUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${userData.name || userData.uid}`;
    let buttonsHtml = '';
    if (type === 'request') {
        buttonsHtml = `<div class="flex space-x-2"><button data-id="${connectionId}" class="accept-btn bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600">Accept</button><button data-id="${connectionId}" class="decline-btn bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Decline</button></div>`;
    } else {
        buttonsHtml = `<button data-id="${userData.uid}" class="message-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Message</button>`;
    }
    div.innerHTML = `<div class="flex items-center space-x-3"><img src="${profileImageUrl}" alt="${userData.name}" class="w-10 h-10 rounded-full object-cover"><span class="font-semibold">${userData.name}</span></div>${buttonsHtml}`;
    if (type === 'request') {
        div.querySelector('.accept-btn').addEventListener('click', () => acceptRequest(connectionId));
        div.querySelector('.decline-btn').addEventListener('click', () => declineRequest(connectionId));
    } else {
        div.querySelector('.message-btn').addEventListener('click', (e) => {
            window.location.href = `chat.html?with=${e.currentTarget.dataset.id}`;
        });
    }
    return div;
}

async function acceptRequest(connectionId) {
    await updateDoc(doc(db, "connections", connectionId), { status: 'accepted' });
}
async function declineRequest(connectionId) {
    await deleteDoc(doc(db, "connections", connectionId));
}

// --- EVENT LISTENERS ---
editProfileBtn.addEventListener('click', () => {
    populateEditForm(currentUserData);
    profileView.classList.add('hidden');
    profileEditView.classList.remove('hidden');
});

cancelEditBtn.addEventListener('click', () => {
    profileEditView.classList.add('hidden');
    profileView.classList.remove('hidden');
});

if (profileImageUpload) {
    profileImageUpload.addEventListener('change', (e) => {
        selectedProfileImageFile = e.target.files[0];
        if (selectedProfileImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profileImagePreview.src = event.target.result;
            };
            reader.readAsDataURL(selectedProfileImageFile);
        }
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Saving...';
        statusMessage.textContent = '';

        try {
            let imageUrl = currentUserData.profileImageUrl || profileImagePreview.src;
            if (selectedProfileImageFile) {
                const storageRef = ref(storage, `profile_images/${currentUser.uid}/${selectedProfileImageFile.name}`);
                const snapshot = await uploadBytes(storageRef, selectedProfileImageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const interestsArray = profileInterestsInput.value.split(',').map(i => i.trim()).filter(Boolean);
            const updatedData = {
                name: profileNameInput.value.trim(),
                hometown: profileHometownSelect.value,
                bio: profileBioInput.value.trim(),
                interests: interestsArray,
                profileImageUrl: imageUrl
            };

            await updateDoc(doc(db, "users", currentUser.uid), updatedData);
            
            await loadProfileData(currentUser.uid);
            profileEditView.classList.add('hidden');
            profileView.classList.remove('hidden');

            selectedProfileImageFile = null;

        } catch (error) {
            statusMessage.textContent = 'Failed to save profile.';
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = 'Save Changes';
        }
    });
}

// Tab switching logic
connectionsTab.addEventListener('click', () => {
    connectionsTab.classList.add('active');
    requestsTab.classList.remove('active');
    connectionsContent.classList.remove('hidden');
    requestsContent.classList.add('hidden');
});

requestsTab.addEventListener('click', () => {
    requestsTab.classList.add('active');
    connectionsTab.classList.remove('active');
    requestsContent.classList.remove('hidden');
    connectionsContent.classList.add('hidden');
});

// Connection Search Logic
connectionsSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredConnections = allConnections.filter(user => 
        user.name.toLowerCase().includes(searchTerm)
    );
    displayConnections(filteredConnections);
});

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}
if (logoutButtonMobile) {
    logoutButtonMobile.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}
