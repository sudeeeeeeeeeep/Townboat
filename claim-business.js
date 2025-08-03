// js/claim-business.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    addDoc, 
    collection, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const businessNameHeading = document.getElementById('business-name-heading');
const businessIdInput = document.getElementById('business-id');
const claimForm = document.getElementById('claim-business-form');
const statusMessage = document.getElementById('claim-status-message');
const submitButton = document.getElementById('submit-claim-btn');

let currentBusinessId = null;
let currentLoggedInUser = null;

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentLoggedInUser = user;
        initializePage();
    } else {
        // If not logged in, redirect to the main login page
        window.location.href = 'index.html';
    }
});

// --- INITIALIZE PAGE ---
async function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentBusinessId = urlParams.get('id');

    if (!currentBusinessId) {
        businessNameHeading.textContent = "Business Not Found";
        claimForm.classList.add('hidden');
        return;
    }

    businessIdInput.value = currentBusinessId;

    try {
        const businessDocRef = doc(db, "businesses", currentBusinessId);
        const businessDocSnap = await getDoc(businessDocRef);

        if (businessDocSnap.exists()) {
            const business = businessDocSnap.data();
            businessNameHeading.textContent = business.name;

            // Check if business is already claimed
            if (business.isClaimed || business.claimStatus === 'pending') {
                claimForm.classList.add('hidden');
                statusMessage.textContent = "This business has already been claimed or has a pending claim request.";
                statusMessage.classList.add('text-yellow-500');
            }

        } else {
            businessNameHeading.textContent = "Business Not Found";
            claimForm.classList.add('hidden');
        }
    } catch (error) {
        console.error("Error fetching business details:", error);
        businessNameHeading.textContent = "Error loading business details.";
        claimForm.classList.add('hidden');
    }
}

// --- HANDLE FORM SUBMISSION ---
if (claimForm) {
    claimForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentLoggedInUser || !currentBusinessId) {
            statusMessage.textContent = 'Error: You must be logged in to submit a claim.';
            statusMessage.classList.add('text-red-500');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        statusMessage.textContent = '';

        const ownerName = document.getElementById('owner-name').value.trim();
        const ownerPhone = document.getElementById('owner-phone').value.trim();
        const proof = document.getElementById('proof-of-ownership').value.trim();

        try {
            // 1. Create a claim request document
            await addDoc(collection(db, "claimRequests"), {
                businessId: currentBusinessId,
                businessName: businessNameHeading.textContent,
                requestingUserId: currentLoggedInUser.uid,
                requestingUserEmail: currentLoggedInUser.email,
                ownerName: ownerName,
                ownerPhone: ownerPhone,
                proofOfOwnership: proof,
                status: 'pending', // 'pending', 'approved', 'rejected'
                createdAt: serverTimestamp()
            });

            // 2. Update the business document's claim status
            const businessDocRef = doc(db, "businesses", currentBusinessId);
            await updateDoc(businessDocRef, {
                claimStatus: 'pending'
            });

            // 3. Show success message and hide form
            claimForm.classList.add('hidden');
            statusMessage.textContent = '✅ Your claim has been submitted! Our team will review it and get back to you shortly.';
            statusMessage.classList.remove('text-red-500');
            statusMessage.classList.add('text-green-500');

        } catch (error) {
            console.error("Error submitting claim:", error);
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.classList.add('text-red-500');
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Claim Request';
        }
    });
}