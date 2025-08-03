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

// Edit Business Form Elements
const editBusinessForm = getElementByIdOrLog('edit-business-form');
const updateBusinessBtn = getElementByIdOrLog('update-business-btn');
const editStatusMessage = getElementByIdOrLog('edit-status-message');
const editImagePreview = getElementByIdOrLog('edit-image-preview');

// List Business DOM Elements
const listBusinessSection = getElementByIdOrLog('list-business-section');
const listBusinessForm = getElementByIdOrLog('list-business-form');
const listBusinessTownSelect = getElementByIdOrLog('list-business-town');
const listBusinessCategorySelect = getElementByIdOrLog('list-business-category');
const listBusinessImageInput = getElementByIdOrLog('list-business-image');
const listImagePreview = getElementByIdOrLog('list-image-preview');
const submitNewBusinessBtn = getElementByIdOrLog('submit-new-business-btn');
const listBusinessStatusMessage = getElementByIdOrLog('list-business-status-message');

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
const updateDealBtnEditModal = getElementByIdOrLog('update-deal-btn');
let selectedEditDealImageFile = null;

// NEW: Claim Status Elements
const claimStatusDisplay = getElementByIdOrLog('claim-status-display');
const claimStatusMessage = getElementByIdOrLog('claim-status-message');


// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged triggered. User:", user ? user.email : "none");
    if (user) {
        // MODIFIED: Removed the check for password provider.
        // Now, any logged-in user (Google or email/password) can potentially access the dashboard.
        // The fetchOwnedBusiness function will determine if they actually own a business.
        console.log("User is logged in. Fetching business details...");
        currentBusinessUser = user;
        await populateTownsForForms();
        await populateCategoriesForForms();
        await fetchOwnedBusiness(user.email); // Fetch business using the user's email
        if (businessLoginForm) businessLoginForm.classList.add('hidden');
        if (dashboardContent) dashboardContent.classList.remove('hidden');
        console.log("Dashboard content should now be visible.");
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

        if (!loginEmail || !loginPassword) {
            if (loginErrorMessage) loginErrorMessage.textContent = "Please enter both email and password.";
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging In...';
        }
        if (loginErrorMessage) loginErrorMessage.textContent = '';
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
    if (businessDetailContent) businessDetailContent.innerHTML = '<p class="text-gray-400 text-center">Loading your business details...</p>';
    
    if (claimStatusDisplay) claimStatusDisplay.classList.add('hidden');
    if (businessDetailsDisplay) businessDetailsDisplay.classList.add('hidden');
    if (listBusinessSection) listBusinessSection.classList.add('hidden');
    if (createDealSection) createDealSection.classList.add('hidden');
    if (myDealsSection) myDealsSection.classList.add('hidden');

    try {
        const q = query(collection(db, "businesses"), where("ownerEmail", "==", ownerEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            console.log("Business found for this owner!");
            const businessDoc = querySnapshot.docs[0];
            ownedBusinessData = { id: businessDoc.id, ...businessDoc.data() };
            ownedBusinessId = ownedBusinessData.id;

            if (ownedBusinessData.claimStatus === 'pending') {
                claimStatusDisplay.classList.remove('hidden');
                claimStatusMessage.textContent = 'Your claim for this business is currently under review.';
                claimStatusMessage.className = 'text-lg text-yellow-400';
                return;
            }

            if (ownedBusinessData.claimStatus === 'rejected') {
                claimStatusDisplay.classList.remove('hidden');
                claimStatusMessage.innerHTML = `
                    <p class="text-lg text-red-400">Your claim for this business has been rejected.</p>
                    <p class="text-sm text-gray-400 mt-2">Please contact support for more information.</p>
                `;
                return;
            }

            if (businessDetailsDisplay) businessDetailsDisplay.classList.remove('hidden');
            
            if (currentBusinessImage) {
                if (ownedBusinessData.imageUrl) {
                    currentBusinessImage.src = ownedBusinessData.imageUrl;
                    currentBusinessImage.classList.remove('hidden');
                } else {
                    currentBusinessImage.classList.add('hidden');
                    currentBusinessImage.src = '#';
                }
            }

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

            if (showEditFormBtn) showEditFormBtn.classList.remove('hidden');
            if (createDealSection) createDealSection.classList.remove('hidden');
            if (myDealsSection) myDealsSection.classList.remove('hidden');

            if (dealBusinessIdInput) dealBusinessIdInput.value = ownedBusinessId;
            if (dealBusinessTownInput) dealBusinessTownInput.value = ownedBusinessData.town || '';
            if (dealBusinessCategoryInput) dealBusinessCategoryInput.value = ownedBusinessData.category || '';

            fetchMyDeals();

        } else {
            console.log("No business found linked to this owner's email. Showing list business section.");
            if (listBusinessSection) listBusinessSection.classList.remove('hidden');
            if (businessDetailContent) businessDetailContent.innerHTML = '';
        }
    } catch (error) {
        console.error("Error fetching owned business:", error);
        if (businessDetailContent) businessDetailContent.innerHTML = `<p class="text-red-500 text-center">Failed to load business details: ${error.message}</p>`;
        if (listBusinessSection) listBusinessSection.classList.add('hidden');
    }
}

// --- POPULATE TOWNS FOR FORMS ---
async function populateTownsForForms() {
    if (!listBusinessTownSelect) return;
    const editBusinessTownSelect = getElementByIdOrLog('edit-business-town');
    listBusinessTownSelect.innerHTML = '<option value="">Select a Town</option>';
    if(editBusinessTownSelect) editBusinessTownSelect.innerHTML = '<option value="">Select a Town</option>';

    try {
        const townsSnapshot = await getDocs(query(collection(db, "towns"), orderBy("name")));
        townsSnapshot.forEach(doc => {
            const town = doc.data();
            const option = new Option(town.name, town.name);
            listBusinessTownSelect.add(option.cloneNode(true));
            if(editBusinessTownSelect) editBusinessTownSelect.add(option);
        });
    } catch (error) {
        console.error("Error populating towns:", error);
    }
}

// --- POPULATE CATEGORIES FOR FORMS ---
async function populateCategoriesForForms() {
    if (!listBusinessCategorySelect) return;
    const editBusinessCategorySelect = getElementByIdOrLog('edit-business-category');
    listBusinessCategorySelect.innerHTML = '<option value="">Select a Category</option>';
    if (editBusinessCategorySelect) editBusinessCategorySelect.innerHTML = '<option value="">Select a Category</option>';

    try {
        const categoriesSnapshot = await getDocs(query(collection(db, "categories"), orderBy("name")));
        categoriesSnapshot.forEach(doc => {
            const category = doc.data();
            const option = new Option(category.name, category.name);
            listBusinessCategorySelect.add(option.cloneNode(true));
            if (editBusinessCategorySelect) editBusinessCategorySelect.add(option);
        });
    } catch (error) {
        console.error("Error populating categories:", error);
    }
}

// --- TOGGLE EDIT FORM VISIBILITY ---
if (showEditFormBtn) {
    showEditFormBtn.addEventListener('click', () => {
        editBusinessForm.classList.toggle('hidden');
        if (!editBusinessForm.classList.contains('hidden')) {
            getElementByIdOrLog('edit-business-name').value = ownedBusinessData.name || '';
            getElementByIdOrLog('edit-business-category').value = ownedBusinessData.category || '';
            getElementByIdOrLog('edit-business-town').value = ownedBusinessData.town || '';
            getElementByIdOrLog('edit-business-description').value = ownedBusinessData.description || '';
            getElementByIdOrLog('edit-business-address').value = ownedBusinessData.address || '';
            getElementByIdOrLog('edit-business-phone').value = ownedBusinessData.phone || '';
            const editImagePreview = getElementByIdOrLog('edit-image-preview');
            if (ownedBusinessData.imageUrl) {
                editImagePreview.src = ownedBusinessData.imageUrl;
                editImagePreview.classList.remove('hidden');
            }
            showEditFormBtn.textContent = 'Hide Edit Form';
        } else {
            showEditFormBtn.textContent = 'Edit Business Details';
        }
    });
}

// --- HANDLE IMAGE SELECTION FOR EDIT FORM ---
const editBusinessImageInput = getElementByIdOrLog('edit-business-image');
if (editBusinessImageInput && editImagePreview) {
    editBusinessImageInput.addEventListener('change', (e) => {
        selectedBusinessImageFile = e.target.files[0];
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
if (editBusinessForm) {
    editBusinessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!ownedBusinessId) return;

        updateBusinessBtn.disabled = true;
        updateBusinessBtn.textContent = 'Updating...';
        editStatusMessage.textContent = '';

        const name = getElementByIdOrLog('edit-business-name').value.trim();
        const category = getElementByIdOrLog('edit-business-category').value.trim();
        const town = getElementByIdOrLog('edit-business-town').value.trim();
        const description = getElementByIdOrLog('edit-business-description').value.trim();
        const address = getElementByIdOrLog('edit-business-address').value.trim();
        const phone = getElementByIdOrLog('edit-business-phone').value.trim();

        let newImageUrl = ownedBusinessData.imageUrl;

        if (selectedBusinessImageFile) {
            try {
                const imageRef = ref(storage, `business_images/${ownedBusinessId}/${selectedBusinessImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedBusinessImageFile);
                newImageUrl = await getDownloadURL(snapshot.ref);
            } catch (error) {
                editStatusMessage.textContent = `Failed to upload image: ${error.message}`;
                updateBusinessBtn.disabled = false;
                updateBusinessBtn.textContent = 'Update Business Details';
                return;
            }
        }

        try {
            await updateDoc(doc(db, "businesses", ownedBusinessId), {
                name, category, town, description, address, phone, imageUrl: newImageUrl,
                updatedAt: serverTimestamp()
            });
            editStatusMessage.textContent = "Business details updated successfully! ✅";
            selectedBusinessImageFile = null;
            await fetchOwnedBusiness(currentBusinessUser.email);
            editBusinessForm.classList.add('hidden');
            showEditFormBtn.textContent = 'Edit Business Details';
        } catch (error) {
            editStatusMessage.textContent = `Failed to update business: ${error.message}`;
        } finally {
            updateBusinessBtn.disabled = false;
            updateBusinessBtn.textContent = 'Update Business Details';
        }
    });
}

// --- LOGOUT BUTTON ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'business-login.html';
        }).catch((error) => {
            console.error("Error signing out:", error);
            alert("Failed to log out. Please try again.");
        });
    });
}

// --- DEAL CREATION LOGIC ---
if (dealImageInput) {
    dealImageInput.addEventListener('change', (e) => {
        selectedDealImageFile = e.target.files[0];
        if (selectedDealImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                dealImagePreview.src = event.target.result;
                dealImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedDealImageFile);
        } else {
            dealImagePreview.classList.add('hidden');
        }
    });
}

if (createDealForm) {
    createDealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!ownedBusinessId) return;

        createDealBtn.disabled = true;
        createDealBtn.textContent = 'Publishing...';

        const title = dealTitleInput.value.trim();
        const description = dealDescriptionInput.value.trim();
        const expiryDate = new Date(dealExpiryDateInput.value);

        let dealImageUrl = null;
        if (selectedDealImageFile) {
            try {
                const imageRef = ref(storage, `deal_images/${ownedBusinessId}/${Date.now()}_${selectedDealImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedDealImageFile);
                dealImageUrl = await getDownloadURL(snapshot.ref);
            } catch (error) {
                createDealStatusMessage.textContent = `Image upload failed: ${error.message}`;
                createDealBtn.disabled = false;
                createDealBtn.textContent = 'Publish Deal';
                return;
            }
        }

        try {
            await addDoc(collection(db, "deals"), {
                businessId: ownedBusinessId,
                businessName: ownedBusinessData.name,
                town: ownedBusinessData.town,
                category: ownedBusinessData.category,
                title, description, expiryDate, imageUrl: dealImageUrl,
                isActive: true,
                createdAt: serverTimestamp()
            });
            createDealStatusMessage.textContent = "Deal published! ✅";
            createDealForm.reset();
            dealImagePreview.classList.add('hidden');
            selectedDealImageFile = null;
        } catch (error) {
            createDealStatusMessage.textContent = `Failed to publish deal: ${error.message}`;
        } finally {
            createDealBtn.disabled = false;
            createDealBtn.textContent = 'Publish Deal';
        }
    });
}

// --- FETCH AND DISPLAY MY ACTIVE DEALS ---
function fetchMyDeals() {
    if (!ownedBusinessId || !myDealsList) return;
    const q = query(collection(db, "deals"), where("businessId", "==", ownedBusinessId), where("isActive", "==", true), where("expiryDate", ">", new Date()), orderBy("expiryDate", "asc"));

    onSnapshot(q, (snapshot) => {
        myDealsList.innerHTML = '';
        allMyDeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (allMyDeals.length === 0) {
            noActiveDealsMessage.classList.remove('hidden');
        } else {
            noActiveDealsMessage.classList.add('hidden');
            allMyDeals.forEach(deal => {
                const expiryText = `Expires: ${deal.expiryDate.toDate().toLocaleDateString()}`;
                const dealCard = document.createElement('div');
                dealCard.className = 'bg-gray-800 p-4 rounded-lg flex items-center justify-between shadow';
                dealCard.innerHTML = `
                    <div>
                        <h3 class="text-lg font-semibold text-white">${deal.title}</h3>
                        <p class="text-gray-400 text-sm">${deal.description}</p>
                        <p class="text-gray-500 text-xs mt-1">${expiryText}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button class="edit-deal-btn bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700" data-id="${deal.id}">Edit</button>
                        <button class="delete-deal-btn bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700" data-id="${deal.id}" data-image-url="${deal.imageUrl || ''}">Delete</button>
                    </div>
                `;
                myDealsList.appendChild(dealCard);
            });
            
            document.querySelectorAll('.edit-deal-btn').forEach(button => {
                button.addEventListener('click', (e) => showEditDealModal(e.target.dataset.id));
            });
            document.querySelectorAll('.delete-deal-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    if (confirm("Are you sure you want to delete this deal?")) {
                        deleteDeal(e.target.dataset.id, e.target.dataset.imageUrl);
                    }
                });
            });
        }
    });
}

// --- SHOW EDIT DEAL MODAL ---
function showEditDealModal(dealId) {
    const deal = allMyDeals.find(d => d.id === dealId);
    if (!deal || !editDealModal) return;

    editDealIdInput.value = deal.id;
    editDealTitleInput.value = deal.title;
    editDealDescriptionInput.value = deal.description;
    editDealExpiryDateInput.value = new Date(deal.expiryDate.seconds * 1000).toISOString().slice(0, 16);
    
    if (deal.imageUrl) {
        editDealImagePreview.src = deal.imageUrl;
        editDealImagePreview.classList.remove('hidden');
        currentDealImageNameP.textContent = `Current image: ${deal.imageUrl.split('/').pop().split('?')[0]}`;
    } else {
        editDealImagePreview.classList.add('hidden');
        currentDealImageNameP.textContent = '';
    }
    selectedEditDealImageFile = null;
    editDealImageInput.value = '';

    editDealStatusMessage.textContent = '';
    editDealModal.classList.remove('hidden');
}

// --- HANDLE EDIT DEAL FORM SUBMISSION ---
if (editDealForm) {
    editDealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dealId = editDealIdInput.value;
        if (!dealId) return;

        updateDealBtnEditModal.disabled = true;
        updateDealBtnEditModal.textContent = 'Saving...';

        let newDealImageUrl = allMyDeals.find(d => d.id === dealId)?.imageUrl || null;
        if (selectedEditDealImageFile) {
            try {
                const imageRef = ref(storage, `deal_images/${ownedBusinessId}/${Date.now()}_${selectedEditDealImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, selectedEditDealImageFile);
                newDealImageUrl = await getDownloadURL(snapshot.ref);
                const oldImageUrl = allMyDeals.find(d => d.id === dealId)?.imageUrl;
                if (oldImageUrl) await deleteObject(ref(storage, oldImageUrl)).catch(err => console.warn("Old image delete failed:", err));
            } catch (error) {
                editDealStatusMessage.textContent = `Image upload failed: ${error.message}`;
                updateDealBtnEditModal.disabled = false;
                updateDealBtnEditModal.textContent = 'Save Changes';
                return;
            }
        }

        try {
            await updateDoc(doc(db, "deals", dealId), {
                title: editDealTitleInput.value.trim(),
                description: editDealDescriptionInput.value.trim(),
                expiryDate: new Date(editDealExpiryDateInput.value),
                imageUrl: newDealImageUrl,
                updatedAt: serverTimestamp()
            });
            editDealModal.classList.add('hidden');
        } catch (error) {
            editDealStatusMessage.textContent = `Update failed: ${error.message}`;
        } finally {
            updateDealBtnEditModal.disabled = false;
            updateDealBtnEditModal.textContent = 'Save Changes';
        }
    });
}

// --- CANCEL EDIT DEAL ---
if (cancelEditDealBtn) {
    cancelEditDealBtn.addEventListener('click', () => editDealModal.classList.add('hidden'));
}

// --- DELETE DEAL ---
async function deleteDeal(dealId, imageUrl) {
    try {
        if (imageUrl) {
            await deleteObject(ref(storage, imageUrl)).catch(err => console.warn("Image delete failed:", err));
        }
        await deleteDoc(doc(db, "deals", dealId));
        alert("Deal deleted successfully!");
    } catch (error) {
        alert(`Failed to delete deal: ${error.message}`);
    }
}

// --- LIST NEW BUSINESS LOGIC ---
if (listBusinessImageInput) {
    listBusinessImageInput.addEventListener('change', (e) => {
        selectedNewBusinessImageFile = e.target.files[0];
        if (selectedNewBusinessImageFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                listImagePreview.src = event.target.result;
                listImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedNewBusinessImageFile);
        } else {
            listImagePreview.classList.add('hidden');
        }
    });
}

if (listBusinessForm) {
    listBusinessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentBusinessUser) return;

        submitNewBusinessBtn.disabled = true;
        submitNewBusinessBtn.textContent = 'Submitting...';

        const name = getElementByIdOrLog('list-business-name').value.trim();
        const category = listBusinessCategorySelect.value;
        const town = listBusinessTownSelect.value;
        const description = getElementByIdOrLog('list-business-description').value.trim();
        const address = getElementByIdOrLog('list-business-address').value.trim();
        const phone = getElementByIdOrLog('list-business-phone').value.trim();

        let imageUrl = null;
        if (selectedNewBusinessImageFile) {
            try {
                const storageRef = ref(storage, `business_images/${Date.now()}_${selectedNewBusinessImageFile.name}`);
                const uploadResult = await uploadBytes(storageRef, selectedNewBusinessImageFile);
                imageUrl = await getDownloadURL(uploadResult.ref);
            } catch (error) {
                listBusinessStatusMessage.textContent = `Image upload failed: ${error.message}`;
                submitNewBusinessBtn.disabled = false;
                submitNewBusinessBtn.textContent = 'Submit Business for Approval';
                return;
            }
        }

        try {
            await addDoc(collection(db, "businesses"), {
                name, category, town, description, address, phone,
                imageUrl,
                ownerEmail: currentBusinessUser.email,
                submittedBy: currentBusinessUser.uid,
                status: 'pending',
                upvoteCount: 0, 
                upvotedBy: [], 
                views: 0,
                createdAt: serverTimestamp()
            });
            listBusinessStatusMessage.textContent = "✅ Business submitted! Awaiting admin approval.";
            listBusinessForm.reset();
            listImagePreview.classList.add('hidden');
            selectedNewBusinessImageFile = null;
            await fetchOwnedBusiness(currentBusinessUser.email);
        } catch (error) {
            listBusinessStatusMessage.textContent = `Submission failed: ${error.message}`;
        } finally {
            submitNewBusinessBtn.disabled = false;
            submitNewBusinessBtn.textContent = 'Submit Business for Approval';
        }
    });
}