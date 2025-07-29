// js/autotaxi.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    getDocs,
    doc, getDoc // Added for fetching user profile
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

// --- DOM Elements ---
const autotaxiListingForm = document.getElementById('autotaxi-listing-form');
const vehicleTypeSelect = document.getElementById('vehicle-type');
const vehicleModelInput = document.getElementById('vehicle-model');
const licensePlateInput = document.getElementById('license-plate');
const driverNameInput = document.getElementById('driver-name');
const contactPhoneInput = document.getElementById('contact-phone');
const serviceDescriptionTextarea = document.getElementById('service-description');
const serviceTownSelect = document.getElementById('service-town');
const serviceImageInput = document.getElementById('service-image');
const serviceImagePreview = document.getElementById('service-image-preview');
const submitAutotaxiListingBtn = document.getElementById('submit-autotaxi-listing-btn');
const autotaxiStatusMessage = document.getElementById('autotaxi-status-message');
const logoutButton = document.getElementById('logout-btn');

let currentLoggedInUser = null;
let selectedServiceImageFile = null;

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // No user is signed in, redirect to login page
        console.log("No user logged in, redirecting to index.html");
        window.location.href = 'index.html';
    } else {
        // User is logged in
        console.log("User logged in:", user.uid);
        currentLoggedInUser = user;

        // Fetch user's hometown to ensure it's set
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists() || !userDocSnap.data().hometown) {
                console.log("User has no hometown set. Redirecting to set-hometown page.");
                window.location.href = 'set-hometown.html'; 
                return;
            }
        } catch (error) {
            console.error("Error fetching user hometown:", error);
            // Even if there's an error, proceed, but without a default filter
        }

        populateTownsDropdown(); // Populate the towns dropdown
    }
});

// --- POPULATE TOWNS DROPDOWN ---
async function populateTownsDropdown() {
    if (!serviceTownSelect) {
        console.warn("Service town select element not found.");
        return;
    }
    serviceTownSelect.innerHTML = '<option value="">Loading Towns...</option>'; // Placeholder
    try {
        const townsCollectionRef = collection(db, "towns");
        const q = query(townsCollectionRef, orderBy("name")); // Assuming 'name' field for town names
        const querySnapshot = await getDocs(q);

        serviceTownSelect.innerHTML = '<option value="">Select a Town</option>'; // Reset
        if (querySnapshot.empty) {
            console.warn("No towns found in the 'towns' collection.");
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Towns Available';
            option.disabled = true;
            serviceTownSelect.appendChild(option);
        } else {
            querySnapshot.forEach((doc) => {
                const townData = doc.data();
                const option = document.createElement('option');
                option.value = townData.name; 
                option.textContent = townData.name;
                serviceTownSelect.appendChild(option);
            });
            console.log("Towns dropdown populated.");
        }
    } catch (error) {
        console.error("Error fetching towns for dropdown:", error);
        serviceTownSelect.innerHTML = '<option value="">Error loading towns</option>';
        serviceTownSelect.disabled = true;
    }
}

// --- HANDLE IMAGE SELECTION ---
if (serviceImageInput && serviceImagePreview) {
    serviceImageInput.addEventListener('change', (e) => {
        selectedServiceImageFile = e.target.files[0];
        if (selectedServiceImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                serviceImagePreview.src = event.target.result;
                serviceImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedServiceImageFile);
        } else {
            serviceImagePreview.classList.add('hidden');
            serviceImagePreview.src = '#';
        }
    });
}

// --- HANDLE FORM SUBMISSION ---
if (autotaxiListingForm && submitAutotaxiListingBtn && autotaxiStatusMessage) {
    autotaxiListingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Auto/Taxi Listing Form submitted.");

        if (!currentLoggedInUser) {
            autotaxiStatusMessage.textContent = "You must be logged in to submit a listing.";
            autotaxiStatusMessage.classList.add('text-red-500');
            return;
        }

        submitAutotaxiListingBtn.disabled = true;
        submitAutotaxiListingBtn.textContent = 'Submitting...';
        autotaxiStatusMessage.textContent = ''; // Clear previous messages

        const vehicleType = vehicleTypeSelect.value.trim();
        const vehicleModel = vehicleModelInput.value.trim();
        const licensePlate = licensePlateInput.value.trim();
        const driverName = driverNameInput.value.trim();
        const contactPhone = contactPhoneInput.value.trim();
        const serviceDescription = serviceDescriptionTextarea.value.trim();
        const serviceTown = serviceTownSelect.value.trim();

        if (!vehicleType || !licensePlate || !driverName || !contactPhone || !serviceDescription || !serviceTown) {
            autotaxiStatusMessage.textContent = "Please fill in all required fields.";
            autotaxiStatusMessage.classList.add('text-red-500');
            submitAutotaxiListingBtn.disabled = false;
            submitAutotaxiListingBtn.textContent = 'Submit Listing';
            return;
        }

        // Basic phone number validation (10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(contactPhone)) {
            autotaxiStatusMessage.textContent = "Please enter a valid 10-digit phone number.";
            autotaxiStatusMessage.classList.add('text-red-500');
            submitAutotaxiListingBtn.disabled = false;
            submitAutotaxiListingBtn.textContent = 'Submit Listing';
            return;
        }

        let imageUrl = null;
        if (selectedServiceImageFile) {
            try {
                const imageRef = ref(storage, `autotaxi_images/${currentLoggedInUser.uid}/${Date.now()}_${selectedServiceImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedServiceImageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
                console.log("Vehicle image uploaded:", imageUrl);
            } catch (error) {
                console.error("Error uploading vehicle image:", error);
                autotaxiStatusMessage.textContent = `Failed to upload image: ${error.message}`;
                autotaxiStatusMessage.classList.add('text-red-500');
                submitAutotaxiListingBtn.disabled = false;
                submitAutotaxiListingBtn.textContent = 'Submit Listing';
                return;
            }
        }

        try {
            await addDoc(collection(db, "autotaxiListings"), {
                userId: currentLoggedInUser.uid,
                userEmail: currentLoggedInUser.email,
                vehicleType: vehicleType,
                vehicleModel: vehicleModel,
                licensePlate: licensePlate,
                driverName: driverName,
                contactPhone: contactPhone,
                serviceDescription: serviceDescription,
                serviceTown: serviceTown,
                imageUrl: imageUrl,
                status: 'approved', // Assuming direct approval for now, can be 'pending' for admin review
                createdAt: serverTimestamp(),
                upvoteCount: 0,
                views: 0
            });

            autotaxiStatusMessage.textContent = "✅ Your auto/taxi listing has been submitted successfully!";
            autotaxiStatusMessage.classList.remove('text-red-500');
            autotaxiStatusMessage.classList.add('text-emerald-400');
            autotaxiListingForm.reset(); // Clear the form
            console.log("Auto/Taxi listing added to Firestore.");

            // Optionally redirect to a confirmation page or the discover page
            setTimeout(() => {
                window.location.href = 'discover.html'; 
            }, 2000);

        } catch (error) {
            console.error("Error adding auto/taxi listing:", error);
            autotaxiStatusMessage.textContent = `❌ Failed to submit listing: ${error.message}`;
            autotaxiStatusMessage.classList.add('text-red-500');
            autotaxiStatusMessage.classList.remove('text-emerald-400');
        } finally {
            submitAutotaxiListingBtn.disabled = false;
            submitAutotaxiListingBtn.textContent = 'Submit Listing';
        }
    });
}

// --- LOGOUT BUTTON ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out.");
            window.location.href = 'index.html'; // Redirect to the main login page
        }).catch((error) => {
            console.error("Error signing out:", error);
            alert("Failed to log out. Please try again.");
        });
    });
}