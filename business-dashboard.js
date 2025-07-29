// js/business-dashboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    addDoc, // Added for adding deals and new businesses
    serverTimestamp,
    deleteDoc, // For deleting deals
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject // For deleting deal images and business images
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentBusinessUser = null; // Store the authenticated business user
let ownedBusinessId = null; // Store the ID of the business owned by the current user
let ownedBusinessData = null; // Store the full data of the owned business
let selectedBusinessImageFile = null; // For business image upload (edit form)
let selectedNewBusinessImageFile = null; // For new business image upload (list form)
let selectedDealImageFile = null; // For deal image upload
let allMyDeals = []; // Store all deals for the current business

// Helper function to get element by ID and log an error if not found
const getElementByIdOrLog = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: DOM element with ID '${id}' not found. Please ensure your HTML is correct.`);
    }
    return element;
};

// --- DOM ELEMENTS ---
// Main dashboard elements
const businessDetailsDisplay = getElementByIdOrLog('business-details-display'); // Container for details & edit form
const businessLoginForm = getElementByIdOrLog('business-login-form');
const dashboardContent = getElementByIdOrLog('dashboard-content');
const loginErrorMessage = getElementByIdOrLog('login-error-message');
const logoutButton = getElementByIdOrLog('logout-btn');

// Business Details Display Section
const currentBusinessImage = getElementByIdOrLog('current-business-image'); // Image element for current business
const businessDetailContent = getElementByIdOrLog('business-detail-container'); // This is the new container for text details
const showEditFormBtn = getElementByIdOrLog('show-edit-form-btn');

// Edit Business Form Elements (Only form, button, message, preview declared globally)
const editBusinessForm = getElementByIdOrLog('edit-business-form');
const updateBusinessBtn = getElementByIdOrLog('update-business-btn');
const editStatusMessage = getElementByIdOrLog('edit-status-message');
const editImagePreview = getElementByIdOrLog('edit-image-preview');
// Input elements for edit form will be retrieved inside event listeners to ensure they are available

// List Business DOM Elements
const listBusinessSection = getElementByIdOrLog('list-business-section'); // New section for listing
const listBusinessForm = getElementByIdOrLog('list-business-form'); // New form for listing
const listBusinessTownSelect = getElementByIdOrLog('list-business-town'); // New select for town
const listBusinessCategorySelect = getElementByIdOrLog('list-business-category'); // New select for category
const listBusinessImageInput = getElementByIdOrLog('list-business-image'); // New image input
const listImagePreview = getElementByIdOrLog('list-image-preview'); // New image preview
const submitNewBusinessBtn = getElementByIdOrLog('submit-new-business-btn'); // New submit button
const listBusinessStatusMessage = getElementByIdOrLog('list-business-status-message'); // New status message

// Deal Creation DOM Elements
const createDealSection = getElementByIdOrLog('create-deal-section');
const createDealForm = getElementByIdOrLog('create-deal-form');
const dealTitleInput = getElementByIdOrLog('deal-title');
const dealDescriptionInput = getElementByIdOrLog('deal-description');
const dealExpiryDateInput = getElementByIdOrLog('deal-expiry-date');
const dealImageInput = getElementByIdOrLog('deal-image');
const dealImagePreview = getElementByIdOrLog('deal-image-preview');
const createDealBtn = getElementByIdOrLog('create-deal-btn');
const createDealStatusMessage = getElementByIdOrLog('create-deal-status-message');
const dealBusinessIdInput = getElementByIdOrLog('deal-business-id');
const dealBusinessTownInput = getElementByIdOrLog('deal-business-town');
const dealBusinessCategoryInput = getElementByIdOrLog('deal-business-category');

// My Active Deals DOM Elements
const myDealsSection = getElementByIdOrLog('my-deals-section');
const myDealsList = getElementByIdOrLog('my-deals-list');
const noActiveDealsMessage = getElementByIdOrLog('no-active-deals-message');

// Edit Deal Modal DOM Elements
const editDealModal = getElementByIdOrLog('edit-deal-modal');
const editDealForm = getElementByIdOrLog('edit-deal-form');
const editDealIdInput = getElementByIdOrLog('edit-deal-id');
const editDealTitleInput = getElementByIdOrLog('edit-deal-title');
const editDealDescriptionInput = getElementByIdOrLog('edit-deal-description');
const editDealExpiryDateInput = getElementByIdOrLog('edit-deal-expiry-date');
const editDealImageInput = getElementByIdOrLog('edit-deal-image');
const editDealImagePreview = getElementByIdOrLog('edit-deal-image-preview');
const currentDealImageNameP = getElementByIdOrLog('current-deal-image-name');
const editDealStatusMessage = getElementByIdOrLog('edit-deal-status-message');
const cancelEditDealBtn = getElementByIdOrLog('cancel-edit-deal-btn');
const updateDealBtnEditModal = getElementByIdOrLog('update-deal-btn'); // Renamed to avoid conflict
let selectedEditDealImageFile = null; // For deal image upload in edit form


// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged triggered. User:", user ? user.email : "none");
    if (user) {
        // Check if the user is authenticated via email/password (business owner)
        if (user.providerData.some(provider => provider.providerId === 'password')) {
            console.log("User is a business owner (email/password). Fetching business details...");
            currentBusinessUser = user;
            await populateTownsForForms(); // Populate towns for both list and edit forms
            await populateCategoriesForForms(); // Populate categories for both list and edit forms
            await fetchOwnedBusiness(user.email); // Fetch business using email
            if (businessLoginForm) businessLoginForm.classList.add('hidden');
            if (dashboardContent) dashboardContent.classList.remove('hidden'); // This should unhide the main dashboard
            console.log("Dashboard content should now be visible.");
        } else {
            console.log("User is NOT an email/password business owner. Redirecting.");
            // This is a Google user or other non-email/password type trying to access business dashboard
            alert("❌ Access Denied: Business dashboard requires an email/password login.");
            signOut(auth).then(() => {
                window.location.href = 'business-login.html'; // Redirect to business-specific login
            }).catch((error) => {
                console.error("Error signing out non-business user:", error);
                window.location.href = 'business-login.html'; // Ensure redirect even on error
            });
        }
    } else {
        console.log("No user is logged in. Showing login form.");
        // No user is logged in
        if (businessLoginForm) businessLoginForm.classList.remove('hidden');
        if (dashboardContent) dashboardContent.classList.add('hidden');
    }
});

// --- BUSINESS LOGIN LOGIC ---
if (businessLoginForm) {
    businessLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginEmail = document.getElementById('business-login-email')?.value;
        const loginPassword = document.getElementById('business-login-password')?.value;
        const loginBtn = document.getElementById('business-login-btn');

        if (!loginEmail || !loginPassword) { // Basic validation
            if (loginErrorMessage) loginErrorMessage.textContent = "Please enter both email and password.";
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging In...';
        }
        if (loginErrorMessage) loginErrorMessage.textContent = ''; // Clear previous errors
        console.log("Attempting business login for:", loginEmail);

        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            console.log("Login successful. onAuthStateChanged will handle dashboard display.");
            // onAuthStateChanged will handle displaying the dashboard upon successful login
        } catch (error) {
            console.error("Business Login Error:", error);
            if (loginErrorMessage) loginErrorMessage.textContent = `Login failed: ${error.message}`;
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Business Login';
            }
        }
    });
}


// --- FETCH OWNED BUSINESS DETAILS ---
async function fetchOwnedBusiness(ownerEmail) {
    console.log("fetchOwnedBusiness called for email:", ownerEmail);
    // Clear previous content in the main business detail display area
    if (businessDetailContent) businessDetailContent.innerHTML = '<p class="text-gray-400 text-center">Loading your business details...</p>';
    
    // Hide all main content sections initially
    if (businessDetailsDisplay) businessDetailsDisplay.classList.add('hidden');
    if (listBusinessSection) listBusinessSection.classList.add('hidden');
    if (createDealSection) createDealSection.classList.add('hidden');
    if (myDealsSection) myDealsSection.classList.add('hidden');
    console.log("All main sections hidden initially.");

    try {
        const q = query(collection(db, "businesses"), where("ownerEmail", "==", ownerEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            console.log("Business found for this owner!");
            // Business found for this owner
            const businessDoc = querySnapshot.docs[0];
            ownedBusinessData = { id: businessDoc.id, ...businessDoc.data() }; // Store full data
            ownedBusinessId = ownedBusinessData.id; // Store the ID

            // Display business details section
            if (businessDetailsDisplay) businessDetailsDisplay.classList.remove('hidden');
            
            // Populate the image
            if (currentBusinessImage) { // Add check for currentBusinessImage
                if (ownedBusinessData.imageUrl) {
                    currentBusinessImage.src = ownedBusinessData.imageUrl;
                    currentBusinessImage.classList.remove('hidden');
                } else {
                    currentBusinessImage.classList.add('hidden');
                    currentBusinessImage.src = '#';
                }
            }

            // Populate the business details content within the dedicated container
            if (businessDetailContent) {
                businessDetailContent.innerHTML = `
                    <h2 class="text-2xl font-bold text-emerald-400 mb-4">${ownedBusinessData.name}</h2>
                    <div class="space-y-2 text-gray-300">
                        <p><strong>Category:</strong> ${ownedBusinessData.category}</p>
                        <p><strong>Town:</strong> ${ownedBusinessData.town || 'N/A'}</p>
                        <p><strong>Description:</strong> ${ownedBusinessData.description}</p>
                        <p><strong>Address:</strong> ${ownedBusinessData.address}</p>
                        <p><strong>Phone:</strong> ${ownedBusinessData.phone}</p>
                        <p><strong>Status:</strong> <span class="font-semibold ${ownedBusinessData.status === 'approved' ? 'text-emerald-400' : (ownedBusinessData.status === 'pending' ? 'text-yellow-400' : 'text-red-400')}">${ownedBusinessData.status.toUpperCase()}</span></p>
                        <p><strong>Upvotes:</strong> ${ownedBusinessData.upvoteCount || 0}</p>
                        <p><strong>Views:</strong> ${ownedBusinessData.views || 0}</p>
                    </div>
                `;
            }
            console.log("Business details displayed. Edit form fields will be populated when edit form is shown.");

            // Show the edit button and deal sections
            if (showEditFormBtn) showEditFormBtn.classList.remove('hidden');
            if (createDealSection) createDealSection.classList.remove('hidden');
            if (myDealsSection) myDealsSection.classList.remove('hidden');
            console.log("Edit button and deal sections unhidden.");

            // Pre-fill hidden fields for deal creation
            if (dealBusinessIdInput) dealBusinessIdInput.value = ownedBusinessId;
            if (dealBusinessTownInput) dealBusinessTownInput.value = ownedBusinessData.town || '';
            if (dealBusinessCategoryInput) dealBusinessCategoryInput.value = ownedBusinessData.category || '';

            fetchMyDeals(); // Fetch and display active deals for this business

        } else {
            console.log("No business found linked to this owner's email. Showing list business section.");
            // No business found linked to this owner's email
            if (listBusinessSection) listBusinessSection.classList.remove('hidden'); // Show the "List Your Business" form
            // populateTownsForForms() and populateCategoriesForForms() are already called globally
            if (businessDetailContent) businessDetailContent.innerHTML = ''; // Clear loading message
            // All other sections remain hidden
        }
    } catch (error) {
        console.error("Error fetching owned business:", error);
        if (businessDetailContent) businessDetailContent.innerHTML = `<p class="text-red-500 text-center">Failed to load business details: ${error.message}</p>`;
        if (listBusinessSection) listBusinessSection.classList.add('hidden'); // Hide list form in case of error
    }
}

// --- POPULATE TOWNS FOR FORMS ---
async function populateTownsForForms() {
    console.log("populateTownsForForms called.");
    if (!listBusinessTownSelect) {
        console.warn("listBusinessTownSelect not found.");
        return;
    }
    // Also get the edit form's town select
    const editBusinessTownSelect = getElementByIdOrLog('edit-business-town');


    listBusinessTownSelect.innerHTML = '<option value="">Select a Town</option>';
    if (editBusinessTownSelect) {
        editBusinessTownSelect.innerHTML = '<option value="">Select a Town</option>';
    }

    try {
        const townsCollectionRef = collection(db, "towns");
        const q = query(townsCollectionRef, orderBy("name"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("No towns found in the 'towns' collection.");
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Towns Available';
            option.disabled = true;
            listBusinessTownSelect.appendChild(option);
            if (editBusinessTownSelect) {
                editBusinessTownSelect.appendChild(option.cloneNode(true));
            }
        } else {
            querySnapshot.forEach((doc) => {
                const townData = doc.data();
                const option = document.createElement('option');
                option.value = townData.name; 
                option.textContent = townData.name;
                listBusinessTownSelect.appendChild(option);
                if (editBusinessTownSelect) {
                    editBusinessTownSelect.appendChild(option.cloneNode(true));
                }
            });
            console.log(`Populated town filter with ${querySnapshot.docs.length} towns.`);
        }
    } catch (error) {
        console.error("Error fetching towns for forms:", error);
    }
}

// --- POPULATE CATEGORIES FOR FORMS ---
async function populateCategoriesForForms() {
    console.log("populateCategoriesForForms called.");
    if (!listBusinessCategorySelect) {
        console.warn("listBusinessCategorySelect not found.");
        return;
    }
    // Also get the edit form's category select
    const editBusinessCategorySelect = getElementByIdOrLog('edit-business-category');

    listBusinessCategorySelect.innerHTML = '<option value="">Select a Category</option>';
    if (editBusinessCategorySelect) {
        editBusinessCategorySelect.innerHTML = '<option value="">Select a Category</option>';
    }

    try {
        const categoriesCollectionRef = collection(db, "categories"); // Assuming a 'categories' collection
        const q = query(categoriesCollectionRef, orderBy("name")); // Assuming categories have a 'name' field
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("No categories found in the 'categories' collection.");
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Categories Available';
            option.disabled = true;
            listBusinessCategorySelect.appendChild(option);
            if (editBusinessCategorySelect) {
                editBusinessCategorySelect.appendChild(option.cloneNode(true));
            }
        } else {
            querySnapshot.forEach((doc) => {
                const categoryData = doc.data();
                const option = document.createElement('option');
                option.value = categoryData.name; 
                option.textContent = categoryData.name;
                listBusinessCategorySelect.appendChild(option);
                if (editBusinessCategorySelect) {
                    editBusinessCategorySelect.appendChild(option.cloneNode(true));
                }
            });
            console.log(`Populated category filter with ${querySnapshot.docs.length} categories.`);
        }
    } catch (error) {
        console.error("Error fetching categories for forms:", error);
    }
}


// --- TOGGLE EDIT FORM VISIBILITY ---
if (showEditFormBtn && editBusinessForm && editStatusMessage) { // Ensure all elements exist
    showEditFormBtn.addEventListener('click', () => {
        console.log("Edit Business Details button clicked.");
        editBusinessForm.classList.toggle('hidden');
        editStatusMessage.textContent = ''; // Clear status message on toggle
        
        // Populate edit form fields ONLY when the form is being shown
        if (!editBusinessForm.classList.contains('hidden')) {
            // Retrieve elements here to ensure they are in the DOM
            const editBusinessNameInput = getElementByIdOrLog('edit-business-name');
            const editBusinessCategorySelect = getElementByIdOrLog('edit-business-category');
            const editBusinessTownSelect = getElementByIdOrLog('edit-business-town'); // Changed to select
            const editBusinessDescriptionTextarea = getElementByIdOrLog('edit-business-description');
            const editBusinessAddressInput = getElementByIdOrLog('edit-business-address');
            const editBusinessPhoneInput = getElementByIdOrLog('edit-business-phone');
            const editBusinessImageInput = getElementByIdOrLog('edit-business-image'); // Re-get for checking value
            const editImagePreview = getElementByIdOrLog('edit-image-preview');


            if (ownedBusinessData) {
                // Check if element exists before setting value to prevent TypeError
                if (editBusinessNameInput) editBusinessNameInput.value = ownedBusinessData.name || '';
                if (editBusinessCategorySelect) editBusinessCategorySelect.value = ownedBusinessData.category || '';
                if (editBusinessTownSelect) editBusinessTownSelect.value = ownedBusinessData.town || ''; // Set value for select
                if (editBusinessDescriptionTextarea) editBusinessDescriptionTextarea.value = ownedBusinessData.description || '';
                if (editBusinessAddressInput) editBusinessAddressInput.value = ownedBusinessData.address || '';
                if (editBusinessPhoneInput) editBusinessPhoneInput.value = ownedBusinessData.phone || '';
                
                if (editImagePreview) {
                    if (ownedBusinessData.imageUrl) {
                        editImagePreview.src = ownedBusinessData.imageUrl;
                        editImagePreview.classList.remove('hidden');
                    } else {
                        editImagePreview.classList.add('hidden');
                        editImagePreview.src = '#';
                    }
                }
                console.log("Edit form populated.");
            } else {
                console.warn("ownedBusinessData is null. Cannot populate edit form.");
            }
            showEditFormBtn.textContent = 'Hide Edit Form';
            console.log("Edit form shown.");
        } else {
            showEditFormBtn.textContent = 'Edit Business Details';
            console.log("Edit form hidden.");
        }
    });
}

// --- HANDLE IMAGE SELECTION FOR EDIT FORM ---
// This needs to be declared globally to attach the event listener
const editBusinessImageInput = getElementByIdOrLog('edit-business-image');
if (editBusinessImageInput && editImagePreview) { // Ensure both exist
    editBusinessImageInput.addEventListener('change', (e) => {
        selectedBusinessImageFile = e.target.files[0];
        console.log("Business image selected for edit:", selectedBusinessImageFile ? selectedBusinessImageFile.name : "none");
        if (selectedBusinessImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                editImagePreview.src = event.target.result;
                editImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedBusinessImageFile);
        } else {
            editImagePreview.classList.add('hidden');
            editImagePreview.src = '#';
        }
    });
}


// --- HANDLE EDIT FORM SUBMISSION ---
if (editBusinessForm && updateBusinessBtn && editStatusMessage) { // Only check essential elements here
    editBusinessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Edit Business Form submitted.");

        if (!ownedBusinessId) {
            alert("No business selected for update.");
            console.error("Attempted to update business without ownedBusinessId.");
            return;
        }

        updateBusinessBtn.disabled = true;
        updateBusinessBtn.textContent = 'Updating...';
        editStatusMessage.textContent = ''; // Clear previous messages

        // Retrieve elements here to ensure they are in the DOM at submission time
        const editBusinessNameInput = getElementByIdOrLog('edit-business-name');
        const editBusinessCategorySelect = getElementByIdOrLog('edit-business-category');
        const editBusinessTownSelect = getElementByIdOrLog('edit-business-town'); // Changed to select
        const editBusinessDescriptionTextarea = getElementByIdOrLog('edit-business-description');
        const editBusinessAddressInput = getElementByIdOrLog('edit-business-address');
        const editBusinessPhoneInput = getElementByIdOrLog('edit-business-phone');
        // editBusinessImageInput is already global and checked above for its listener

        // Add null checks before accessing .value
        const name = editBusinessNameInput?.value.trim();
        const category = editBusinessCategorySelect?.value.trim();
        const town = editBusinessTownSelect?.value.trim(); // Get value from select
        const description = editBusinessDescriptionTextarea?.value.trim();
        const address = editBusinessAddressInput?.value.trim();
        const phone = editBusinessPhoneInput?.value.trim();

        if (!name || !category || !town || !description || !address || !phone) {
            editStatusMessage.textContent = "All fields are required.";
            editStatusMessage.classList.add('text-red-500');
            updateBusinessBtn.disabled = false;
            updateBusinessBtn.textContent = 'Update Business Details';
            console.warn("Edit Business Form: Missing required fields.");
            return;
        }

        let newImageUrl = ownedBusinessData.imageUrl; // Start with current image URL

        // If a new image is selected, upload it
        if (selectedBusinessImageFile) {
            console.log("Uploading new business image...");
            try {
                const imageRef = ref(storage, `business_images/${ownedBusinessId}/${selectedBusinessImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedBusinessImageFile);
                newImageUrl = await getDownloadURL(snapshot.ref);
                console.log("New business image uploaded:", newImageUrl);
            } catch (error) {
                console.error("Error uploading new business image:", error);
                editStatusMessage.textContent = `Failed to upload business image: ${error.message}`;
                editStatusMessage.classList.add('text-red-500');
                updateBusinessBtn.disabled = false;
                updateBusinessBtn.textContent = 'Update Business Details';
                return; // Stop the update process if image upload fails
            }
        } else if (editBusinessImageInput?.value === '' && ownedBusinessData.imageUrl) { // Add null check for editBusinessImageInput
            console.log("Image input cleared, attempting to delete old image.");
            // If image input is cleared and there was an old image, remove it
            newImageUrl = null;
            try {
                const oldImageRef = ref(storage, ownedBusinessData.imageUrl);
                await deleteObject(oldImageRef);
                console.log("Old business image deleted due to clear input.");
            } catch (deleteError) {
                console.warn("Could not delete old business image (might not exist or permission issue):", deleteError);
            }
        }


        try {
            console.log("Updating business document in Firestore...");
            await updateDoc(doc(db, "businesses", ownedBusinessId), {
                name: name,
                category: category,
                town: town,
                description: description,
                address: address,
                phone: phone,
                imageUrl: newImageUrl, // Update image URL
                updatedAt: serverTimestamp()
            });

            editStatusMessage.textContent = "Business details updated successfully! ✅";
            editStatusMessage.classList.remove('text-red-500');
            editStatusMessage.classList.add('text-emerald-400');
            selectedBusinessImageFile = null; // Reset selected file after upload
            console.log("Business document updated. Re-fetching owned business details.");
            // Re-fetch and display details to ensure UI is updated with new data
            await fetchOwnedBusiness(currentBusinessUser.email); // Use email to refetch
            // Optionally hide the edit form again
            if (editBusinessForm) editBusinessForm.classList.add('hidden');
            if (showEditFormBtn) showEditFormBtn.classList.remove('hidden');
        } catch (error) {
            console.error("Error updating business document:", error);
            editStatusMessage.textContent = `Failed to update business: ${error.message}`;
            editStatusMessage.classList.add('text-red-500');
        } finally {
            updateBusinessBtn.disabled = false;
            updateBusinessBtn.textContent = 'Update Business Details';
        }
    });
}

// --- LOGOUT BUTTON ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        console.log("Logout button clicked.");
        signOut(auth).then(() => {
            console.log("Business user signed out.");
            window.location.href = 'business-login.html'; // Redirect to business login
        }).catch((error) => {
            console.error("Error signing out:", error);
            alert("Failed to log out. Please try again.");
        });
    });
}

// --- DEAL CREATION LOGIC ---
if (dealImageInput && dealImagePreview && createDealForm && dealTitleInput && dealDescriptionInput && dealExpiryDateInput && createDealBtn && createDealStatusMessage && dealBusinessIdInput && dealBusinessTownInput && dealBusinessCategoryInput) { // Ensure all exist
    dealImageInput.addEventListener('change', (e) => {
        selectedDealImageFile = e.target.files[0];
        console.log("Deal image selected for creation:", selectedDealImageFile ? selectedDealImageFile.name : "none");
        if (selectedDealImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                dealImagePreview.src = event.target.result;
                dealImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedDealImageFile);
        } else {
            dealImagePreview.classList.add('hidden');
            dealImagePreview.src = '#';
        }
    });


    createDealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Create Deal Form submitted.");

        if (!ownedBusinessId || !ownedBusinessData) {
            createDealStatusMessage.textContent = "Error: No business linked to your account. Cannot create deal.";
            createDealStatusMessage.classList.add('text-red-500');
            console.error("Attempted to create deal without linked business.");
            return;
        }

        createDealBtn.disabled = true;
        createDealBtn.textContent = 'Publishing...';
        createDealStatusMessage.textContent = '';

        const title = dealTitleInput.value.trim();
        const description = dealDescriptionInput.value.trim();
        const expiryDateStr = dealExpiryDateInput.value; // "YYYY-MM-DDTHH:MM" format

        if (!title || !description || !expiryDateStr) {
            createDealStatusMessage.textContent = "Please fill in all required deal fields.";
            createDealStatusMessage.classList.add('text-red-500');
            createDealBtn.disabled = false;
            createDealBtn.textContent = 'Publish Deal';
            console.warn("Create Deal Form: Missing required fields.");
            return;
        }

        const expiryDate = new Date(expiryDateStr);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            createDealStatusMessage.textContent = "Please enter a valid future expiry date and time.";
            createDealStatusMessage.classList.add('text-red-500');
            createDealBtn.disabled = false;
            createDealBtn.textContent = 'Publish Deal';
            console.warn("Create Deal Form: Invalid expiry date.");
            return;
        }

        let dealImageUrl = null;
        if (selectedDealImageFile) {
            console.log("Uploading new deal image...");
            try {
                const imageRef = ref(storage, `deal_images/${ownedBusinessId}/${Date.now()}_${selectedDealImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedDealImageFile);
                dealImageUrl = await getDownloadURL(snapshot.ref);
                console.log("Deal image uploaded:", dealImageUrl);
            } catch (error) {
                console.error("Error uploading deal image:", error);
                createDealStatusMessage.textContent = `Failed to upload deal image: ${error.message}`;
                createDealStatusMessage.classList.add('text-red-500');
                createDealBtn.disabled = false;
                createDealBtn.textContent = 'Publish Deal';
                return;
            }
        }

        try {
            console.log("Adding deal document to Firestore...");
            await addDoc(collection(db, "deals"), {
                businessId: ownedBusinessId,
                businessName: ownedBusinessData.name, // Store business name for easier display
                town: ownedBusinessData.town, // Store business town
                category: ownedBusinessData.category, // Store business category
                title: title,
                description: description,
                expiryDate: expiryDate, // Store as Firestore Timestamp
                imageUrl: dealImageUrl,
                isActive: true, // Mark deal as active
                createdAt: serverTimestamp()
            });

            createDealStatusMessage.textContent = "Deal published successfully! ✅";
            createDealStatusMessage.classList.remove('text-red-500');
            createDealStatusMessage.classList.add('text-emerald-400');
            createDealForm.reset(); // Clear the form
            dealImagePreview.src = '#';
            dealImagePreview.classList.add('hidden');
            selectedDealImageFile = null; // Reset selected file
            console.log("Deal added. Refreshing active deals list.");
            fetchMyDeals(); // Refresh the list of active deals
        } catch (error) {
            console.error("Error adding deal document:", error);
            createDealStatusMessage.textContent = `Failed to publish deal: ${error.message}`;
            createDealStatusMessage.classList.add('text-red-500');
        } finally {
            createDealBtn.disabled = false;
            createDealBtn.textContent = 'Publish Deal';
        }
    });
}

// --- FETCH AND DISPLAY MY ACTIVE DEALS ---
function fetchMyDeals() {
    console.log("fetchMyDeals called.");
    if (!ownedBusinessId || !myDealsList || !noActiveDealsMessage) {
        console.log("Cannot fetch deals: ownedBusinessId or DOM elements missing.");
        return;
    }

    const dealsQuery = query(
        collection(db, "deals"),
        where("businessId", "==", ownedBusinessId),
        where("isActive", "==", true),
        where("expiryDate", ">", new Date()), // Only active and unexpired deals
        orderBy("expiryDate", "asc") // Order by soonest expiring
    );

    onSnapshot(dealsQuery, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} deal updates.`);
        if (myDealsList) myDealsList.innerHTML = ''; // Clear previous list
        allMyDeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Store all fetched deals
        
        if (allMyDeals.length === 0) {
            if (noActiveDealsMessage) noActiveDealsMessage.classList.remove('hidden');
            console.log("No active deals found.");
        } else {
            if (noActiveDealsMessage) noActiveDealsMessage.classList.add('hidden');
            allMyDeals.forEach((deal) => {
                const expiryDate = deal.expiryDate ? deal.expiryDate.toDate() : null;
                const expiryText = expiryDate ? `Expires: ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No expiry date';

                const dealCard = document.createElement('div');
                dealCard.className = 'bg-gray-800 p-4 rounded-lg flex items-center justify-between shadow';
                dealCard.innerHTML = `
                    <div>
                        <h3 class="text-lg font-semibold text-white">${deal.title}</h3>
                        <p class="text-gray-400 text-sm">${deal.description}</p>
                        <p class="text-gray-500 text-xs mt-1">${expiryText}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button class="edit-deal-btn bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition duration-300" data-id="${deal.id}">Edit</button>
                        <button class="delete-deal-btn bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 transition duration-300" data-id="${deal.id}" data-image-url="${deal.imageUrl || ''}">Delete</button>
                    </div>
                `;
                if (myDealsList) myDealsList.appendChild(dealCard);

                // Add event listeners for deal actions
                dealCard.querySelector('.delete-deal-btn')?.addEventListener('click', async (e) => {
                    const idToDelete = e.target.dataset.id;
                    const imageUrlToDelete = e.target.dataset.imageUrl;
                    console.log("Delete deal button clicked for ID:", idToDelete);
                    if (confirm("Are you sure you want to delete this deal?")) {
                        await deleteDeal(idToDelete, imageUrlToDelete);
                    }
                });
                dealCard.querySelector('.edit-deal-btn')?.addEventListener('click', (e) => {
                    console.log("Edit deal button clicked for ID:", e.target.dataset.id);
                    showEditDealModal(e.target.dataset.id);
                });
            });
        }
    }, (error) => {
        console.error("Error fetching my deals:", error);
        if (noActiveDealsMessage) {
            noActiveDealsMessage.textContent = 'Failed to load your deals.';
            noActiveDealsMessage.classList.remove('hidden');
        }
    });
}

// --- SHOW EDIT DEAL MODAL FUNCTION (NEW) ---
function showEditDealModal(dealId) {
    console.log("showEditDealModal called for deal ID:", dealId);
    const dealToEdit = allMyDeals.find(deal => deal.id === dealId);
    if (!dealToEdit) {
        alert("Deal not found for editing.");
        console.error("Deal not found in allMyDeals for ID:", dealId);
        return;
    }

    // Ensure modal elements exist before trying to access them
    if (!editDealIdInput || !editDealTitleInput || !editDealDescriptionInput || !editDealExpiryDateInput || !editDealImageInput || !editDealImagePreview || !currentDealImageNameP || !editDealStatusMessage || !cancelEditDealBtn || !updateDealBtnEditModal) { // Corrected updateDealBtn reference
        console.error("One or more edit deal modal elements not found in the DOM.");
        alert("Error: Missing elements for deal editing. Please ensure your HTML is up to date.");
        return;
    }

    editDealIdInput.value = dealToEdit.id;
    editDealTitleInput.value = dealToEdit.title || '';
    editDealDescriptionInput.value = dealToEdit.description || '';

    // Format expiry date for datetime-local input
    if (dealToEdit.expiryDate && dealToEdit.expiryDate.toDate) {
        const date = dealToEdit.expiryDate.toDate();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        editDealExpiryDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
        editDealExpiryDateInput.value = '';
    }

    if (dealToEdit.imageUrl) {
        editDealImagePreview.src = dealToEdit.imageUrl;
        editDealImagePreview.classList.remove('hidden');
        currentDealImageNameP.textContent = `Current: ${dealToEdit.imageUrl.split('/').pop().split('?')[0]}`;
    } else {
        editDealImagePreview.src = '#';
        editDealImagePreview.classList.add('hidden');
        currentDealImageNameP.textContent = 'No current image.';
    }
    selectedEditDealImageFile = null; // Reset selected file
    editDealImageInput.value = ''; // Clear file input value

    editDealStatusMessage.textContent = ''; // Clear status message
    editDealModal.classList.remove('hidden'); // Show the modal
    console.log("Edit Deal Modal shown and populated.");
}

// --- HANDLE IMAGE SELECTION FOR EDIT DEAL FORM (NEW) ---
if (editDealImageInput && editDealImagePreview && currentDealImageNameP) { // Ensure all exist
    editDealImageInput.addEventListener('change', (e) => {
        selectedEditDealImageFile = e.target.files[0];
        console.log("Edit Deal image selected:", selectedEditDealImageFile ? selectedEditDealImageFile.name : "none");
        if (selectedEditDealImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                editDealImagePreview.src = event.target.result;
                editDealImagePreview.classList.remove('hidden');
                currentDealImageNameP.textContent = `New: ${selectedEditDealImageFile.name}`;
            };
            reader.readAsDataURL(selectedEditDealImageFile);
        } else {
            // If user clears selection, revert to current image or hide
            const dealId = editDealIdInput.value;
            const dealToEdit = allMyDeals.find(deal => deal.id === dealId);
            if (dealToEdit && dealToEdit.imageUrl) {
                editDealImagePreview.src = dealToEdit.imageUrl;
                editDealImagePreview.classList.remove('hidden');
                currentDealImageNameP.textContent = `Current: ${dealToEdit.imageUrl.split('/').pop().split('?')[0]}`;
            } else {
                editDealImagePreview.src = '#';
                editDealImagePreview.classList.add('hidden');
                currentDealImageNameP.textContent = 'No new image selected.';
            }
        }
    });
}

// --- HANDLE EDIT DEAL FORM SUBMISSION (NEW) ---
if (editDealForm && editDealIdInput && updateDealBtnEditModal && editDealStatusMessage && editDealTitleInput && editDealDescriptionInput && editDealExpiryDateInput && editDealImageInput) { // Ensure all exist
    editDealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Edit Deal Form submitted.");

        const dealId = editDealIdInput.value;
        if (!dealId) {
            editDealStatusMessage.textContent = "Error: Deal ID missing.";
            editDealStatusMessage.classList.add('text-red-500');
            console.error("Attempted to update deal without deal ID.");
            return;
        }

        updateDealBtnEditModal.disabled = true; // Corrected reference
        updateDealBtnEditModal.textContent = 'Saving...'; // Corrected reference
        editDealStatusMessage.textContent = '';

        const title = editDealTitleInput.value.trim();
        const description = editDealDescriptionInput.value.trim();
        const expiryDateStr = editDealExpiryDateInput.value;

        if (!title || !description || !expiryDateStr) {
            editDealStatusMessage.textContent = "Please fill in all required fields.";
            editDealStatusMessage.classList.add('text-red-500');
            updateDealBtnEditModal.disabled = false; // Corrected reference
            updateDealBtnEditModal.textContent = 'Save Changes'; // Corrected reference
            console.warn("Edit Deal Form: Missing required fields.");
            return;
        }

        const expiryDate = new Date(expiryDateStr);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            editDealStatusMessage.textContent = "Please enter a valid future expiry date and time.";
            editDealStatusMessage.classList.add('text-red-500');
            updateDealBtnEditModal.disabled = false; // Corrected reference
            updateDealBtnEditModal.textContent = 'Save Changes'; // Corrected reference
            console.warn("Edit Deal Form: Invalid expiry date.");
            return;
        }

        let newDealImageUrl = allMyDeals.find(d => d.id === dealId)?.imageUrl || null;

        if (selectedEditDealImageFile) {
            console.log("Uploading new deal image for edit...");
            try {
                const imageRef = ref(storage, `deal_images/${ownedBusinessId}/${Date.now()}_${selectedEditDealImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedEditDealImageFile);
                newDealImageUrl = await getDownloadURL(snapshot.ref);
                
                // Delete old image if it exists and is different from the new one
                const oldImageUrl = allMyDeals.find(d => d.id === dealId)?.imageUrl;
                if (oldImageUrl && oldImageUrl !== newDealImageUrl) {
                    try {
                        await deleteObject(ref(storage, oldImageUrl));
                        console.log("Old deal image deleted:", oldImageUrl);
                    } catch (deleteError) {
                        console.warn("Could not delete old deal image:", deleteError);
                    }
                }
            } catch (error) {
                console.error("Error uploading new deal image:", error);
                editDealStatusMessage.textContent = `Failed to upload image: ${error.message}`;
                editDealStatusMessage.classList.add('text-red-500');
                updateDealBtnEditModal.disabled = false; // Corrected reference
                updateDealBtnEditModal.textContent = 'Save Changes'; // Corrected reference
                return;
            }
        } else if (editDealImageInput.value === '' && newDealImageUrl) {
            console.log("Edit Deal image input cleared, attempting to delete old image.");
            // If image input is cleared and there was an old image, remove it
            try {
                await deleteObject(ref(storage, newDealImageUrl));
                console.log("Old deal image deleted due to input clear.");
                newDealImageUrl = null;
            } catch (deleteError) {
                console.warn("Could not delete old deal image on clear:", deleteError);
            }
        }


        try {
            console.log("Updating deal document in Firestore for ID:", dealId);
            await updateDoc(doc(db, "deals", dealId), {
                title: title,
                description: description,
                expiryDate: expiryDate,
                imageUrl: newDealImageUrl,
                updatedAt: serverTimestamp()
            });

            editDealStatusMessage.textContent = "Deal updated successfully! ✅";
            editDealStatusMessage.classList.remove('text-red-500');
            editDealStatusMessage.classList.add('text-emerald-400');
            selectedEditDealImageFile = null; // Reset selected file
            if (editDealModal) editDealModal.classList.add('hidden'); // Hide modal
            console.log("Deal updated successfully. Modal hidden.");
            // fetchMyDeals will automatically refresh due to onSnapshot
        } catch (error) {
            console.error("Error updating deal document:", error);
            editDealStatusMessage.textContent = `Failed to update deal: ${error.message}`;
            editDealStatusMessage.classList.add('text-red-500');
        } finally {
            updateDealBtnEditModal.disabled = false; // Corrected reference
            updateDealBtnEditModal.textContent = 'Save Changes'; // Corrected reference
        }
    });
}

// --- CANCEL EDIT DEAL BUTTON (NEW) ---
if (cancelEditDealBtn && editDealModal && editDealStatusMessage) { // Ensure all exist
    cancelEditDealBtn.addEventListener('click', () => {
        console.log("Cancel Edit Deal button clicked.");
        editDealModal.classList.add('hidden');
        editDealStatusMessage.textContent = '';
    });
}

// --- DELETE DEAL FUNCTION ---
async function deleteDeal(dealId, imageUrl) {
    console.log("deleteDeal called for ID:", dealId);
    try {
        // Delete image from storage if it exists
        if (imageUrl) {
            try {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
                console.log("Deal image deleted from storage.");
            } catch (storageError) {
                console.warn("Could not delete deal image from storage (might not exist or permission issue):", storageError);
            }
        }
        // Delete deal document from Firestore
        await deleteDoc(doc(db, "deals", dealId));
        alert("Deal deleted successfully! 🗑️");
        console.log("Deal document deleted from Firestore.");
        // UI will update via onSnapshot
    } catch (error) {
        console.error("Error deleting deal:", error);
        alert(`Failed to delete deal: ${error.message}`);
    }
}

// --- LIST NEW BUSINESS LOGIC (NEW SECTION) ---
if (listBusinessImageInput && listImagePreview && listBusinessForm && submitNewBusinessBtn && listBusinessStatusMessage && listBusinessTownSelect && listBusinessCategorySelect) { // Ensure all exist
    listBusinessImageInput.addEventListener('change', (e) => {
        selectedNewBusinessImageFile = e.target.files[0];
        console.log("New Business image selected:", selectedNewBusinessImageFile ? selectedNewBusinessImageFile.name : "none");
        if (selectedNewBusinessImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                listImagePreview.src = event.target.result;
                listImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedNewBusinessImageFile);
        } else {
            listImagePreview.classList.add('hidden');
            listImagePreview.src = '#';
        }
    });

    listBusinessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("List Business Form submitted.");

        if (!currentBusinessUser) {
            listBusinessStatusMessage.textContent = "You must be logged in to list a business.";
            listBusinessStatusMessage.classList.add('text-red-500');
            console.error("Attempted to list business without logged-in user.");
            return;
        }

        submitNewBusinessBtn.disabled = true;
        submitNewBusinessBtn.textContent = 'Submitting...';
        listBusinessStatusMessage.textContent = '';

        const name = document.getElementById('list-business-name')?.value.trim();
        const category = listBusinessCategorySelect.value; // Get value from the select
        const town = listBusinessTownSelect.value; // Get value from the select
        const description = document.getElementById('list-business-description')?.value.trim();
        const address = document.getElementById('list-business-address')?.value.trim();
        const phone = document.getElementById('list-business-phone')?.value.trim();
        const ownerEmail = currentBusinessUser.email; // Use the logged-in user's email as ownerEmail

        if (!name || !category || !town || !description || !address || !phone) {
            listBusinessStatusMessage.textContent = "Please fill in all required fields.";
            listBusinessStatusMessage.classList.add('text-red-500');
            submitNewBusinessBtn.disabled = false;
            submitNewBusinessBtn.textContent = 'Submit Business for Approval';
            console.warn("List Business Form: Missing required fields.");
            return;
        }

        // Basic phone number validation (10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            listBusinessStatusMessage.textContent = "Please enter a valid 10-digit phone number.";
            listBusinessStatusMessage.classList.add('text-red-500');
            submitNewBusinessBtn.disabled = false;
            submitNewBusinessBtn.textContent = 'Submit Business for Approval';
            return;
        }

        let imageUrl = null;
        if (selectedNewBusinessImageFile) {
            console.log("Uploading new business image for listing...");
            try {
                const storageRef = ref(storage, `business_images/${Date.now()}_${selectedNewBusinessImageFile.name}`);
                const uploadResult = await uploadBytes(storageRef, selectedNewBusinessImageFile);
                imageUrl = await getDownloadURL(uploadResult.ref);
                console.log("New business image uploaded:", imageUrl);
            } catch (error) {
                console.error("Error uploading new business image:", error);
                listBusinessStatusMessage.textContent = `Failed to upload image: ${error.message}`;
                listBusinessStatusMessage.classList.add('text-red-500');
                submitNewBusinessBtn.disabled = false;
                submitNewBusinessBtn.textContent = 'Submit Business for Approval';
                return;
            }
        }

        try {
            console.log("Adding new business document to Firestore...");
            await addDoc(collection(db, "businesses"), {
                name: name,
                category: category,
                town: town,
                description: description,
                address: address,
                phone: phone,
                imageUrl: imageUrl,
                ownerEmail: ownerEmail, // Set owner email from current logged-in user
                submittedBy: currentBusinessUser.uid, // Business owner's UID
                status: 'pending', // New businesses submitted by owner are pending approval
                upvoteCount: 0, 
                upvotedBy: [], 
                views: 0,
                createdAt: serverTimestamp()
            });

            listBusinessStatusMessage.textContent = "✅ Business submitted successfully! It will be listed after admin approval.";
            listBusinessStatusMessage.classList.remove('text-red-500');
            listBusinessStatusMessage.classList.add('text-emerald-400');
            listBusinessForm.reset(); // Clear the form
            listImagePreview.src = '#';
            listImagePreview.classList.add('hidden');
            selectedNewBusinessImageFile = null; // Reset selected file
            console.log("New business submitted. Re-fetching owned business details.");
            // After successful submission, re-fetch owned business to show details
            await fetchOwnedBusiness(currentBusinessUser.email);
            
        } catch (error) {
            console.error("Error adding new business document: ", error);
            listBusinessStatusMessage.textContent = "❌ Failed to submit business. Please try again. Check console for details.";
            listBusinessStatusMessage.classList.add('text-red-500');
            listBusinessStatusMessage.classList.remove('text-emerald-400');
        } finally {
            submitNewBusinessBtn.disabled = false;
            submitNewBusinessBtn.textContent = 'Submit Business for Approval';
        }
    });
}