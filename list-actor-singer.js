// js/list-actor-singer.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Removed getStorage, ref, uploadBytes, getDownloadURL as we are no longer uploading files
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // No longer needed for this page

// --- DOM Elements ---
const actorSingerListingForm = document.getElementById('actor-singer-listing-form');
const profileTypeSelect = document.getElementById('profile-type');
const nameInput = document.getElementById('name');
const bioTextarea = document.getElementById('bio');
const linkInput = document.getElementById('link');
// const hometownSelect = document.getElementById('hometown'); // Removed hometown select
const imageUrlInput = document.getElementById('image-url'); 
const imagePreview = document.getElementById('image-preview');
const submitProfileBtn = document.getElementById('submit-profile-btn');
const actorSingerStatusMessage = document.getElementById('actor-singer-status-message');

let currentAdminUser = null; 


// --- AUTHENTICATION CHECK (for Admin UID) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentAdminUser = user;
        console.log("Admin user detected:", user.uid);
        // populateHometownDropdown(); // No longer needed
    } else {
        console.log("No admin user logged in. This page assumes admin access.");
        // populateHometownDropdown(); // No longer needed
    }
});

// --- POPULATE HOMETOWN DROPDOWN ---
// This function is no longer needed as hometown is removed from the form.
/*
async function populateHometownDropdown() {
    if (!hometownSelect) {
        console.warn("Hometown select element not found.");
        return;
    }
    hometownSelect.innerHTML = '<option value="">Loading Towns...</option>'; 
    try {
        const townsCollectionRef = collection(db, "towns");
        const q = query(townsCollectionRef, orderBy("name")); 
        const querySnapshot = await getDocs(q);

        hometownSelect.innerHTML = '<option value="">Select a Town</option>'; 
        if (querySnapshot.empty) {
            console.warn("No towns found in the 'towns' collection.");
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Towns Available';
            option.disabled = true;
            hometownSelect.appendChild(option);
        } else {
            querySnapshot.forEach((doc) => {
                const townData = doc.data();
                const option = document.createElement('option');
                option.value = townData.name; 
                option.textContent = townData.name;
                hometownSelect.appendChild(option);
            });
            console.log("Towns dropdown populated.");
        }
    } catch (error) {
        console.error("Error fetching towns for dropdown:", error);
        hometownSelect.innerHTML = '<option value="">Error loading towns</option>';
        hometownSelect.disabled = true;
    }
}
*/

// --- HANDLE IMAGE URL INPUT AND PREVIEW ---
if (imageUrlInput && imagePreview) {
    imageUrlInput.addEventListener('input', () => { 
        const url = imageUrlInput.value.trim();
        if (url) {
            imagePreview.src = url;
            imagePreview.classList.remove('hidden');
            imagePreview.onerror = () => {
                imagePreview.src = 'https://placehold.co/150x150/E5E7EB/000000?text=Invalid+URL'; 
                actorSingerStatusMessage.textContent = "Invalid image URL provided. Displaying placeholder.";
                actorSingerStatusMessage.classList.add('text-red-500');
            };
        } else {
            imagePreview.src = '#';
            imagePreview.classList.add('hidden');
            actorSingerStatusMessage.textContent = ''; 
        }
    });
}

// --- HANDLE FORM SUBMISSION ---
if (actorSingerListingForm && submitProfileBtn && actorSingerStatusMessage) {
    actorSingerListingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Actor/Singer Listing Form submitted by admin.");

        if (!currentAdminUser) {
            actorSingerStatusMessage.textContent = "Admin user not detected. Please ensure you are logged in to the admin panel.";
            actorSingerStatusMessage.classList.add('text-red-500');
            return;
        }

        submitProfileBtn.disabled = true;
        submitProfileBtn.textContent = 'Submitting...';
        actorSingerStatusMessage.textContent = ''; 

        const profileType = profileTypeSelect.value.trim();
        const name = nameInput.value.trim();
        const bio = bioTextarea.value.trim(); // Bio is now optional, so no validation here
        const link = linkInput.value.trim();
        // const hometown = hometownSelect.value.trim(); // Removed hometown from submission
        const imageUrl = imageUrlInput.value.trim(); 
        const adminId = currentAdminUser.uid; 

        if (!profileType || !name) { // Updated validation: bio is now optional
            actorSingerStatusMessage.textContent = "Please fill in all required fields (Profile Type, Name).";
            actorSingerStatusMessage.classList.add('text-red-500');
            submitProfileBtn.disabled = false;
            submitProfileBtn.textContent = 'Submit Profile';
            return;
        }

        try {
            const collectionName = profileType === 'actor' ? 'actors' : 'singers';
            await addDoc(collection(db, collectionName), {
                submittedByAdminId: adminId, 
                name: name,
                bio: bio, // Save bio even if empty
                // hometown: hometown, // Removed hometown from Firestore document
                link: link,
                imageUrl: imageUrl, 
                upvoteCount: 0,
                upvotedBy: [], 
                createdAt: serverTimestamp()
            });

            actorSingerStatusMessage.textContent = `✅ ${name}'s ${profileType} profile has been added successfully!`;
            actorSingerStatusMessage.classList.remove('text-red-500');
            actorSingerStatusMessage.classList.add('text-emerald-400');
            actorSingerListingForm.reset(); 
            imagePreview.src = '#'; 
            imagePreview.classList.add('hidden');
            console.log(`${profileType} profile added to Firestore by admin.`);

            setTimeout(() => {
                window.location.href = 'leaderboard.html'; 
            }, 2000);

        } catch (error) {
            console.error(`Error adding ${profileType} listing:`, error);
            actorSingerStatusMessage.textContent = `❌ Failed to submit ${profileType} profile: ${error.message}`;
            actorSingerStatusMessage.classList.add('text-red-500');
            actorSingerStatusMessage.classList.remove('text-emerald-400');
        } finally {
            submitProfileBtn.disabled = false;
            submitProfileBtn.textContent = 'Submit Profile';
        }
    });
}
