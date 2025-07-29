// js/set-hometown.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, // Changed from updateDoc to setDoc with merge: true
    getDoc, 
    getDocs, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const hometownSelect = document.getElementById('hometown-select');
const hometownForm = document.getElementById('hometown-form');
const hometownStatusMessage = document.getElementById('hometown-status-message');

let currentLoggedInUser = null;

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // If not logged in, redirect to main login page
        window.location.href = 'index.html';
    } else {
        currentLoggedInUser = user;
        populateHometownDropdown();
        checkAndSetInitialHometown(); // Check if user already has a hometown
    }
});

// --- POPULATE HOMETOWN DROPDOWN ---
async function populateHometownDropdown() {
    if (!hometownSelect) {
        console.error("Hometown select element not found.");
        return;
    }
    hometownSelect.innerHTML = '<option value="">Loading Towns...</option>'; // Keep loading state
    try {
        const townsCollectionRef = collection(db, "towns");
        const q = query(townsCollectionRef, orderBy("name"));
        const querySnapshot = await getDocs(q);

        hometownSelect.innerHTML = '<option value="">Select a Town</option>'; // Reset after loading
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
        }
    } catch (error) {
        console.error("Error fetching towns:", error);
        hometownSelect.innerHTML = '<option value="">Error loading towns</option>';
        hometownSelect.disabled = true;
    }
}

// --- CHECK AND SET INITIAL HOMETOWN (if already exists) ---
async function checkAndSetInitialHometown() {
    if (currentLoggedInUser && hometownSelect) {
        const userDocRef = doc(db, "users", currentLoggedInUser.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data().hometown) {
                hometownSelect.value = userDocSnap.data().hometown;
            }
        } catch (error) {
            console.error("Error fetching user hometown:", error);
        }
    }
}

// --- SAVE HOMETOWN ---
if (hometownForm) { // Ensure form exists before adding listener
    hometownForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedTown = hometownSelect.value;
        const saveBtn = document.getElementById('save-hometown-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        hometownStatusMessage.textContent = '';

        if (!selectedTown) {
            hometownStatusMessage.textContent = 'Please select a town.';
            hometownStatusMessage.classList.add('text-red-500');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Hometown';
            return;
        }

        if (currentLoggedInUser) {
            const userDocRef = doc(db, "users", currentLoggedInUser.uid);
            try {
                // Use setDoc with merge: true to create the document if it doesn't exist
                // or update it if it does, without overwriting other fields.
                await setDoc(userDocRef, { hometown: selectedTown }, { merge: true });
                hometownStatusMessage.textContent = 'Hometown saved successfully! Redirecting...';
                hometownStatusMessage.classList.remove('text-red-500');
                hometownStatusMessage.classList.add('text-emerald-400');
                
                // Redirect to home page or dashboard after saving
                setTimeout(() => {
                    window.location.href = 'home.html'; // Or your main app page
                }, 1500);

            } catch (error) {
                console.error("Error saving hometown:", error);
                hometownStatusMessage.textContent = `Failed to save hometown: ${error.message}`;
                hometownStatusMessage.classList.add('text-red-500');
                hometownStatusMessage.classList.remove('text-emerald-400');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Hometown';
            }
        } else {
            hometownStatusMessage.textContent = 'User not logged in. Please log in again.';
            hometownStatusMessage.classList.add('text-red-500');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Hometown';
        }
    });
}