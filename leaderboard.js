// js/leaderboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    where,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Removed getStorage, ref, uploadBytes, getDownloadURL as personal images are now from Google
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Storage is no longer directly used for person images on this page

// Declare DOM elements globally but initialize them inside DOMContentLoaded
let logoutButton;
let topUpvotedList;
let topUpvotedPeopleList;
let topUpvotedActorsList;
let topUpvotedSingersList;
let townFilter;
let categoryFilter;

// View All Containers
let viewAllBusinessesContainer;
let viewAllPeopleContainer;
let viewAllActorsContainer;
let viewAllSingersContainer;

// Person Listing Form Elements
let listPersonSection;
let personSectionTitle; // New: for dynamic title
let personListingForm;
let personNameInput;
let personBioInput;
let personInstagramInput;
let personImagePreview;
let submitPersonListingBtn;
let personListingStatusMessage;
let personAlreadyListedInfo; // Changed from personAlreadyListedMessage to a div
let personImageSourceNote; // New: for the note about Google image

// Edit Person Profile Form Elements
let editPersonForm;
let editPersonIdInput;
let editPersonNameInput;
let editPersonBioInput;
let editPersonInstagramInput;
let editPersonImagePreview;
let editPersonStatusMessage;
let cancelEditPersonBtn;
let updatePersonProfileBtn;
let editPersonProfileBtn; // Button to show edit form

let currentPersonListingData = null; // To store the current user's person listing data

// Global data storage for full lists
let allBusinessesData = [];
let allPeopleData = [];
let allActorsData = [];
let allSingersData = [];

// Flags to track if full list is currently displayed
let showAllBusinessesFlag = false;
let showAllPeopleFlag = false;
let showAllActorsFlag = false;
let showAllSingersFlag = false;

let currentFilters = {
    town: '',
    category: ''
};
let userHometown = '';
let currentLoggedInUser = null;

// Helper function to get element by ID and log an error if not found
const getElementByIdOrLog = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: DOM element with ID '${id}' not found. Please ensure your HTML is correct.`);
    }
    return element;
};

// --- DOM CONTENT LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements here to ensure they are available
    logoutButton = getElementByIdOrLog('logout-btn');
    topUpvotedList = getElementByIdOrLog('top-upvoted-list');
    topUpvotedPeopleList = getElementByIdOrLog('top-upvoted-people-list');
    topUpvotedActorsList = getElementByIdOrLog('top-upvoted-actors-list');
    topUpvotedSingersList = getElementByIdOrLog('top-upvoted-singers-list');
    townFilter = getElementByIdOrLog('town-filter');
    categoryFilter = getElementByIdOrLog('category-filter');

    // View All Containers
    viewAllBusinessesContainer = getElementByIdOrLog('view-all-businesses-container');
    viewAllPeopleContainer = getElementByIdOrLog('view-all-people-container');
    viewAllActorsContainer = getElementByIdOrLog('view-all-actors-container');
    viewAllSingersContainer = getElementByIdOrLog('view-all-singers-container');

    // Person Listing Form Elements
    listPersonSection = getElementByIdOrLog('list-person-section');
    personSectionTitle = getElementByIdOrLog('person-section-title');
    personListingForm = getElementByIdOrLog('person-listing-form');
    personNameInput = getElementByIdOrLog('person-name');
    personBioInput = getElementByIdOrLog('person-bio');
    personInstagramInput = getElementByIdOrLog('person-instagram');
    personImagePreview = getElementByIdOrLog('person-image-preview');
    submitPersonListingBtn = getElementByIdOrLog('submit-person-listing-btn');
    personListingStatusMessage = getElementByIdOrLog('person-listing-status-message');
    personAlreadyListedInfo = getElementByIdOrLog('person-already-listed-info');
    personImageSourceNote = getElementByIdOrLog('person-image-source-note');

    // Edit Person Profile Form Elements
    editPersonForm = getElementByIdOrLog('edit-person-form');
    editPersonIdInput = getElementByIdOrLog('edit-person-id');
    editPersonNameInput = getElementByIdOrLog('edit-person-name');
    editPersonBioInput = getElementByIdOrLog('edit-person-bio');
    editPersonInstagramInput = getElementByIdOrLog('edit-person-instagram');
    editPersonImagePreview = getElementByIdOrLog('edit-person-image-preview');
    editPersonStatusMessage = getElementByIdOrLog('edit-person-status-message');
    cancelEditPersonBtn = getElementByIdOrLog('cancel-edit-person-btn');
    updatePersonProfileBtn = getElementByIdOrLog('update-person-profile-btn');
    editPersonProfileBtn = getElementByIdOrLog('edit-person-profile-btn');


    // --- AUTHENTICATION CHECK ---
    onAuthStateChanged(auth, async (user) => {
        currentLoggedInUser = user; // Set currentLoggedInUser regardless of login status

        if (user) {
            console.log("User logged in:", user.uid);
            // --- FETCH USER'S HOMETOWN ---
            const userDocRef = doc(db, "users", user.uid);
            try {
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists() && userDocSnap.data().hometown) {
                    userHometown = userDocSnap.data().hometown;
                    console.log("User's hometown:", userHometown);
                    
                    await populateTownFilter();
                    if (townFilter && Array.from(townFilter.options).some(opt => opt.value === userHometown)) {
                        townFilter.value = userHometown;
                        currentFilters.town = userHometown;
                    }
                } else {
                    console.log("User has no hometown set. Redirecting to set-hometown page.");
                    window.location.href = 'set-hometown.html';
                    return;
                }
            } catch (error) {
                console.error("Error fetching user hometown:", error);
                await populateTownFilter();
            }

            // --- PROCEED WITH PAGE-SPECIFIC LOGIC ---
            checkAndDisplayPersonListingForm(); // Only show person listing form if logged in
        } else {
            console.log("No user logged in. Displaying public leaderboard content.");
            // If not logged in, ensure the person listing section is hidden
            if (listPersonSection) {
                listPersonSection.classList.add('hidden');
            }
            populateTownFilter(); // Still populate town filter for public viewing
        }

        // Always fetch leaderboard data, regardless of login status
        fetchLeaderboardData();
        fetchPeopleRankingData();
        fetchActorsRankingData();
        fetchSingersRankingData();
    });

    // --- EVENT LISTENERS FOR FILTERS ---
    if (townFilter) {
        townFilter.addEventListener('change', (e) => {
            currentFilters.town = e.target.value;
            fetchLeaderboardData();
            fetchPeopleRankingData();
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentFilters.category = e.target.value;
            fetchLeaderboardData();
        });
    }

    // --- EVENT LISTENERS FOR "VIEW ALL" BUTTONS ---
    document.querySelectorAll('.view-all-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const section = e.currentTarget.dataset.section;
            if (section === 'businesses') {
                showAllBusinessesFlag = !showAllBusinessesFlag; // Toggle flag
                renderListings(topUpvotedList, allBusinessesData, showAllBusinessesFlag, createBusinessCard, 'businesses');
            } else if (section === 'people') {
                showAllPeopleFlag = !showAllPeopleFlag;
                renderListings(topUpvotedPeopleList, allPeopleData, showAllPeopleFlag, createEntityCard, 'peopleRankings');
            } else if (section === 'actors') {
                showAllActorsFlag = !showAllActorsFlag;
                renderListings(topUpvotedActorsList, allActorsData, showAllActorsFlag, createEntityCard, 'actors');
            } else if (section === 'singers') {
                showAllSingersFlag = !showAllSingersFlag;
                renderListings(topUpvotedSingersList, allSingersData, showAllSingersFlag, createEntityCard, 'singers');
            }
        });
    });


    // --- LOGOUT BUTTON ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log("User signed out.");
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error("Error signing out:", error);
                displayMessage("Failed to log out. Please try again.", "error"); // Use custom message box
            });
        });
    }

    // --- PERSON LISTING FORM SUBMISSION ---
    if (personListingForm) {
        personListingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentLoggedInUser) {
                personListingStatusMessage.textContent = "You must be logged in to list yourself.";
                personListingStatusMessage.classList.add('text-red-500');
                return;
            }

            submitPersonListingBtn.disabled = true;
            submitPersonListingBtn.textContent = 'Submitting...';
            personListingStatusMessage.textContent = '';

            const name = personNameInput.value.trim();
            const bio = personBioInput.value.trim();
            const instagramId = personInstagramInput.value.trim();
            const userId = currentLoggedInUser.uid;
            const hometown = userHometown;

            if (!name) {
                personListingStatusMessage.textContent = "Please enter your name.";
                personListingStatusMessage.classList.add('text-red-500');
                submitPersonListingBtn.disabled = false;
                submitPersonListingBtn.textContent = 'Add Me to Leaderboard';
                return;
            }

            // Always use the Google profile image for the person listing
            const imageUrl = currentLoggedInUser.photoURL || 'https://placehold.co/50x50/E5E7EB/000000?text=User';

            try {
                const docRef = await addDoc(collection(db, "peopleRankings"), {
                    userId: userId,
                    name: name,
                    bio: bio,
                    instagramId: instagramId,
                    hometown: hometown,
                    imageUrl: imageUrl, // Use Google profile image
                    upvoteCount: 0,
                    upvotedBy: [],
                    createdAt: serverTimestamp()
                });
                console.log("Person listing added with ID:", docRef.id);
                personListingStatusMessage.textContent = "✅ You have been added to the People Leaderboard!";
                personListingStatusMessage.classList.remove('text-red-500');
                personListingStatusMessage.classList.add('text-emerald-400');
                personListingForm.reset();
                currentPersonListingId = docRef.id;
                checkAndDisplayPersonListingForm(); // Re-check to hide form and show message
            } catch (error) {
                console.error("Error adding person listing:", error);
                personListingStatusMessage.textContent = `❌ Failed to add to leaderboard: ${error.message}`;
                personListingStatusMessage.classList.add('text-red-500');
                personListingStatusMessage.classList.remove('text-emerald-400');
            } finally {
                submitPersonListingBtn.disabled = false;
                submitPersonListingBtn.textContent = 'Add Me to Leaderboard';
            }
        });
    }

    // --- EDIT PERSON PROFILE LOGIC ---
    if (editPersonProfileBtn) {
        editPersonProfileBtn.addEventListener('click', () => {
            if (currentPersonListingData) {
                personListingForm.classList.add('hidden'); // Hide add form
                personAlreadyListedInfo.classList.add('hidden'); // Hide already listed message
                editPersonForm.classList.remove('hidden'); // Show edit form
                personSectionTitle.textContent = 'Edit Your Profile'; // Update title

                // Populate edit form with current data
                editPersonIdInput.value = currentPersonListingData.id;
                editPersonNameInput.value = currentPersonListingData.name || '';
                editPersonBioInput.value = currentPersonListingData.bio || '';
                editPersonInstagramInput.value = currentPersonListingData.instagramId || '';
                
                // Display Google image in edit preview
                if (editPersonImagePreview && currentLoggedInUser.photoURL) {
                    editPersonImagePreview.src = currentLoggedInUser.photoURL;
                    editPersonImagePreview.classList.remove('hidden');
                } else if (editPersonImagePreview) {
                    editPersonImagePreview.classList.add('hidden');
                }
                editPersonStatusMessage.textContent = ''; // Clear status
            } else {
                displayMessage("No profile data found to edit.", "error");
            }
        });
    }

    if (cancelEditPersonBtn) {
        cancelEditPersonBtn.addEventListener('click', () => {
            editPersonForm.classList.add('hidden'); // Hide edit form
            checkAndDisplayPersonListingForm(); // Go back to showing appropriate form/message
        });
    }

    if (updatePersonProfileBtn) {
        updatePersonProfileBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentLoggedInUser || !currentPersonListingData) {
                editPersonStatusMessage.textContent = "You must be logged in and have a profile to edit.";
                editPersonStatusMessage.classList.add('text-red-500');
                return;
            }

            updatePersonProfileBtn.disabled = true;
            updatePersonProfileBtn.textContent = 'Saving...';
            editPersonStatusMessage.textContent = '';

            const personId = editPersonIdInput.value;
            const name = editPersonNameInput.value.trim();
            const bio = editPersonBioInput.value.trim();
            const instagramId = editPersonInstagramInput.value.trim();
            const hometown = userHometown; // Hometown cannot be changed from this form

            if (!name) {
                editPersonStatusMessage.textContent = "Please enter your name.";
                editPersonStatusMessage.classList.add('text-red-500');
                updatePersonProfileBtn.disabled = false;
                updatePersonProfileBtn.textContent = 'Save Changes';
                return;
            }

            try {
                const personDocRef = doc(db, "peopleRankings", personId);
                await updateDoc(personDocRef, {
                    name: name,
                    bio: bio,
                    instagramId: instagramId,
                    updatedAt: serverTimestamp()
                });

                editPersonStatusMessage.textContent = "✅ Profile updated successfully!";
                editPersonStatusMessage.classList.remove('text-red-500');
                editPersonStatusMessage.classList.add('text-emerald-400');
                
                // Update local data and re-render lists
                currentPersonListingData.name = name;
                currentPersonListingData.bio = bio;
                currentPersonListingData.instagramId = instagramId;

                setTimeout(() => {
                    editPersonForm.classList.add('hidden');
                    checkAndDisplayPersonListingForm(); // Re-display appropriate section
                    fetchPeopleRankingData(); // Re-fetch to update leaderboard
                }, 1500);

            } catch (error) {
                console.error("Error updating person profile:", error);
                editPersonStatusMessage.textContent = `❌ Failed to update profile: ${error.message}`;
                editPersonStatusMessage.classList.add('text-red-500');
                editPersonStatusMessage.classList.remove('text-emerald-400');
            } finally {
                updatePersonProfileBtn.disabled = false;
                updatePersonProfileBtn.textContent = 'Save Changes';
            }
        });
    }
});

// --- POPULATE TOWN FILTER ---
async function populateTownFilter() {
    if (townFilter) {
        townFilter.innerHTML = '<option value="">All Towns</option>';

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
                townFilter.appendChild(option);
            } else {
                querySnapshot.forEach((doc) => {
                    const townData = doc.data();
                    const option = document.createElement('option');
                    option.value = townData.name;
                    option.textContent = townData.name;
                    townFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error fetching towns for filter:", error);
        }
    }
}

/**
 * Formats a number for display, using 'k' for thousands and 'M' for millions.
 * @param {number} count The number to format.
 * @returns {string|number} The formatted string or the original number if less than 1000.
 */
function formatUpvoteCount(count) {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1000) {
        return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count;
}


// --- FETCH LEADERBOARD DATA (BUSINESSES) ---
function fetchLeaderboardData() {
    if (!topUpvotedList) {
        console.error("topUpvotedList element not found in DOM.");
        return;
    }

    let leaderboardQuery = query(
        collection(db, "businesses"),
        where("status", "==", "approved"),
        orderBy("upvoteCount", "desc"),
        orderBy("name")
    );

    if (currentFilters.town) {
        leaderboardQuery = query(leaderboardQuery, where("town", "==", currentFilters.town));
    }
    if (currentFilters.category) {
        leaderboardQuery = query(leaderboardQuery, where("category", "==", currentFilters.category));
    }

    onSnapshot(leaderboardQuery, (snapshot) => {
        allBusinessesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderListings(topUpvotedList, allBusinessesData, showAllBusinessesFlag, createBusinessCard, 'businesses');
    }, (error) => {
        console.error("Error fetching top upvoted businesses:", error);
        topUpvotedList.innerHTML = '<li class="text-red-400 text-center py-4">Failed to load leaderboard data.</li>';
    });
}

// --- CHECK AND DISPLAY PERSON LISTING FORM / INFO ---
async function checkAndDisplayPersonListingForm() {
    // This function should only run if a user is logged in.
    if (!currentLoggedInUser || !listPersonSection || !personListingForm || !personAlreadyListedInfo || !editPersonForm) {
        // If not logged in, or missing essential DOM elements, hide the section and return.
        if (listPersonSection) listPersonSection.classList.add('hidden');
        return;
    }

    try {
        const q = query(collection(db, "peopleRankings"), where("userId", "==", currentLoggedInUser.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // User has already listed themselves
            currentPersonListingData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
            listPersonSection.classList.remove('hidden'); // Ensure section is visible
            personListingForm.classList.add('hidden'); // Hide add form
            personAlreadyListedInfo.classList.remove('hidden'); // Show already listed message
            editPersonForm.classList.add('hidden'); // Ensure edit form is hidden initially
            personListingStatusMessage.textContent = ''; // Clear any previous status
            personSectionTitle.textContent = 'Your People Leaderboard Profile';

            // Display Google profile image for the "already listed" view
            if (personImagePreview && currentLoggedInUser.photoURL) {
                personImagePreview.src = currentLoggedInUser.photoURL;
                personImagePreview.classList.remove('hidden');
                if (personImageSourceNote) personImageSourceNote.textContent = 'Image from your Google account.';
            } else if (personImagePreview) {
                personImagePreview.classList.add('hidden');
                if (personImageSourceNote) personImageSourceNote.textContent = '';
            }
            console.log("User already listed in people rankings.");
        } else {
            // User has not listed themselves
            currentPersonListingData = null; // Reset
            listPersonSection.classList.remove('hidden'); // Ensure section is visible
            personListingForm.classList.remove('hidden'); // Show add form
            personAlreadyListedInfo.classList.add('hidden'); // Hide already listed message
            editPersonForm.classList.add('hidden'); // Ensure edit form is hidden
            personListingStatusMessage.textContent = 'Be the first to list yourself!';
            personListingStatusMessage.classList.remove('text-red-500', 'text-emerald-400');
            personListingStatusMessage.classList.add('text-gray-400');
            personSectionTitle.textContent = 'List Yourself on the People Leaderboard';

            // Display Google profile image for the "add new" view
            if (personImagePreview && currentLoggedInUser.photoURL) {
                personImagePreview.src = currentLoggedInUser.photoURL;
                personImagePreview.classList.remove('hidden');
                if (personImageSourceNote) personImageSourceNote.textContent = 'Image from your Google account.';
            } else if (personImagePreview) {
                personImagePreview.classList.add('hidden');
                if (personImageSourceNote) personImageSourceNote.textContent = '';
            }
            console.log("User not listed in people rankings, showing form.");
        }
    } catch (error) {
        console.error("Error checking person listing status:", error);
        listPersonSection.classList.remove('hidden');
        personListingForm.classList.add('hidden');
        personAlreadyListedInfo.classList.add('hidden');
        editPersonForm.classList.add('hidden');
        personListingStatusMessage.textContent = `Error checking your listing status: ${error.message}`;
        personListingStatusMessage.classList.add('text-red-500');
    }
}

// --- FETCH PEOPLE RANKING DATA ---
function fetchPeopleRankingData() {
    if (!topUpvotedPeopleList) {
        console.error("topUpvotedPeopleList element not found in DOM.");
        return;
    }

    let peopleQuery = query(
        collection(db, "peopleRankings"),
        orderBy("upvoteCount", "desc"),
        orderBy("name")
    );

    if (currentFilters.town) {
        peopleQuery = query(peopleQuery, where("hometown", "==", currentFilters.town));
    }

    onSnapshot(peopleQuery, (snapshot) => {
        allPeopleData = snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));
        renderListings(topUpvotedPeopleList, allPeopleData, showAllPeopleFlag, createEntityCard, 'peopleRankings');
    }, (error) => {
        console.error("Error fetching top upvoted people:", error);
        topUpvotedPeopleList.innerHTML = '<li class="text-red-400 text-center py-4">Failed to load people ranking data.</li>';
    });
}

// --- FETCH ACTORS RANKING DATA ---
function fetchActorsRankingData() {
    if (!topUpvotedActorsList) {
        console.error("topUpvotedActorsList element not found in DOM.");
        return;
    }

    let actorsQuery = query(
        collection(db, "actors"),
        orderBy("upvoteCount", "desc"),
        orderBy("name")
    );

    onSnapshot(actorsQuery, (snapshot) => {
        allActorsData = snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));
        renderListings(topUpvotedActorsList, allActorsData, showAllActorsFlag, createEntityCard, 'actors');
    }, (error) => {
        console.error("Error fetching top upvoted actors:", error);
        topUpvotedActorsList.innerHTML = '<li class="text-red-400 text-center py-4">Failed to load actors ranking data.</li>';
    });
}

// --- FETCH SINGERS RANKING DATA ---
function fetchSingersRankingData() {
    if (!topUpvotedSingersList) {
        console.error("topUpvotedSingersList element not found in DOM.");
        return;
    }

    let singersQuery = query(
        collection(db, "singers"),
        orderBy("upvoteCount", "desc"),
        orderBy("name")
    );

    onSnapshot(singersQuery, (snapshot) => {
        allSingersData = snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));
        renderListings(topUpvotedSingersList, allSingersData, showAllSingersFlag, createEntityCard, 'singers');
    }, (error) => {
        console.error("Error fetching top upvoted singers:", error);
        topUpvotedSingersList.innerHTML = '<li class="text-red-400 text-center py-4">Failed to load singers ranking data.</li>';
    });
}

// --- GENERIC RENDER LISTINGS FUNCTION ---
function renderListings(containerElement, dataArray, showAllFlag, createCardFn, collectionName) {
    containerElement.innerHTML = ''; // Clear existing list items
    const limitToDisplay = showAllFlag ? dataArray.length : 3; // Show all or top 3

    if (dataArray.length === 0) {
        containerElement.innerHTML = '<li class="text-gray-400 text-center py-4">No entries found.</li>';
        // Hide the view all button if no data
        const viewAllContainer = document.getElementById(`view-all-${collectionName}-container`);
        if (viewAllContainer) viewAllContainer.classList.add('hidden');
        return;
    }

    dataArray.slice(0, limitToDisplay).forEach((item, index) => {
        const li = createCardFn(item, item.id, index + 1, collectionName);
        containerElement.appendChild(li);
    });

    // Manage "View All" / "Show Less" button
    const viewAllContainer = document.getElementById(`view-all-${collectionName}-container`);
    if (viewAllContainer) {
        if (dataArray.length > 3) {
            viewAllContainer.classList.remove('hidden');
            const viewAllButton = viewAllContainer.querySelector('.view-all-btn');
            if (viewAllButton) {
                viewAllButton.innerHTML = showAllFlag ? '<i class="fas fa-chevron-up mr-2 text-black"></i> Show Less' : '<i class="fas fa-chevron-down mr-2 text-black"></i> View All';
            }
        } else {
            viewAllContainer.classList.add('hidden'); // Hide if 3 or fewer items
        }
    }
}


// --- CREATE BUSINESS CARD ---
function createBusinessCard(business, businessId, rank) {
    const li = document.createElement('li');
    li.className = 'leaderboard-item flex items-center justify-between';
    
    const imageUrl = business.imageUrl || 'https://placehold.co/50x50/E5E7EB/000000?text=Logo';

    li.innerHTML = `
        <a href="business-detail.html?id=${businessId}" class="flex items-center justify-between w-full no-underline text-current">
            <div class="flex items-center flex-grow min-w-0">
                <span class="rank-text font-bold mr-3 md:mr-4 ${getRankColorClass(rank)} flex-shrink-0">${rank}.</span>
                <img src="${imageUrl}" alt="${business.name}" class="item-image object-cover rounded-full mr-3 md:mr-4 border border-gray-300 flex-shrink-0">
                <div class="flex-grow min-w-0">
                    <p class="item-name font-semibold text-black">${business.name}</p>
                    <p class="item-details text-gray-700">${business.category} • ${business.town}</p>
                </div>
            </div>
            <div class="flex items-center text-black font-bold upvote-count flex-shrink-0 ml-2">
                <i class="fas fa-arrow-up mr-1 text-black"></i>${formatUpvoteCount(business.upvoteCount || 0)}
            </div>
        </a>
    `;
    return li;
}

// --- GENERIC CREATE ENTITY CARD (for People, Actors, Singers) ---
function createEntityCard(entity, entityId, rank, collectionName) {
    const li = document.createElement('li');
    li.className = 'leaderboard-item flex items-center justify-between';
    
    const imageUrl = entity.imageUrl || (collectionName === 'peopleRankings' && currentLoggedInUser?.photoURL) || 'https://placehold.co/50x50/E5E7EB/000000?text=User';
    
    const isUpvoted = currentLoggedInUser && entity.upvotedBy && entity.upvotedBy.includes(currentLoggedInUser.uid);
    // Determine icon based on upvote status, but always make it black
    const upvoteIconClass = isUpvoted ? 'fas fa-heart text-black' : 'far fa-heart text-black';
    
    let extraInfoHtml = '';
    if (collectionName === 'peopleRankings' && entity.instagramId) {
        extraInfoHtml = ` • IG: @${entity.instagramId}`;
    } else if ((collectionName === 'actors' || collectionName === 'singers') && entity.link) {
        extraInfoHtml = ` • <a href="${entity.link}" target="_blank" class="text-blue-500 hover:underline">Link</a>`;
    }

    li.innerHTML = `
        <div class="flex items-center flex-grow min-w-0">
            <span class="rank-text font-bold mr-3 md:mr-4 ${getRankColorClass(rank)} flex-shrink-0">${rank}.</span>
            <img src="${imageUrl}" alt="${entity.name}" class="item-image object-cover rounded-full mr-3 md:mr-4 border border-gray-300 flex-shrink-0">
            <div class="flex-grow min-w-0">
                <p class="item-name font-semibold text-black">${entity.name}</p>
                <p class="item-details text-gray-700">
                    ${entity.bio || 'No bio'}
                    ${entity.hometown ? ` • ${entity.hometown}` : ''}
                    ${extraInfoHtml}
                </p>
            </div>
        </div>
        <div class="flex items-center space-x-2 md:space-x-3 flex-shrink-0 ml-2">
            <span class="upvote-clickable flex items-center font-bold cursor-pointer text-black"
                  data-id="${entityId}" data-collection="${collectionName}" data-is-upvoted="${isUpvoted}" ${!currentLoggedInUser ? 'data-disabled="true"' : ''}>
                <i class="${upvoteIconClass} mr-1"></i><span class="text-black">${formatUpvoteCount(entity.upvoteCount || 0)}</span>
            </span>
        </div>
    `;

    // Attach event listener to the new clickable span
    const upvoteClickableSpan = li.querySelector('.upvote-clickable');
    if (upvoteClickableSpan) { // Always attach listener
        upvoteClickableSpan.addEventListener('click', (e) => {
            if (!currentLoggedInUser) {
                // If not logged in, redirect to index.html for signup/login
                window.location.href = 'index.html';
                return;
            }
            const currentIsUpvoted = e.currentTarget.dataset.isUpvoted === 'true';
            handleEntityUpvote(e.currentTarget, entityId, collectionName, currentIsUpvoted);
        });
    }

    return li;
}

// --- GENERIC HANDLE ENTITY UPVOTE ---
async function handleEntityUpvote(element, entityId, collectionName, isCurrentlyUpvoted) {
    // This check is now also in the event listener, but kept here for robustness
    if (!currentLoggedInUser) {
        // This case should ideally be handled by the event listener redirection,
        // but as a fallback, display message and return.
        displayMessage("You must be logged in to upvote.", "error");
        return;
    }

    // Disable the element to prevent multiple clicks during processing
    element.style.pointerEvents = 'none';
    element.style.opacity = '0.6';

    const entityRef = doc(db, collectionName, entityId);

    try {
        const iconElement = element.querySelector('i');
        
        if (isCurrentlyUpvoted) {
            await updateDoc(entityRef, {
                upvoteCount: Math.max(0, (await getDoc(entityRef)).data().upvoteCount - 1),
                upvotedBy: arrayRemove(currentLoggedInUser.uid)
            });
            // Update UI immediately (optimistic update or after success)
            iconElement.classList.remove('fas');
            iconElement.classList.add('far');
            element.dataset.isUpvoted = 'false';
            console.log(`Upvote removed for ${collectionName} ID: ${entityId}`);
        } else {
            await updateDoc(entityRef, {
                upvoteCount: ((await getDoc(entityRef)).data().upvoteCount || 0) + 1,
                upvotedBy: arrayUnion(currentLoggedInUser.uid)
            });
            // Update UI immediately
            iconElement.classList.remove('far');
            iconElement.classList.add('fas');
            element.dataset.isUpvoted = 'true';
            console.log(`Upvote added for ${collectionName} ID: ${entityId}`);
        }
    } catch (error) {
        console.error(`Error updating ${collectionName} upvote for ID ${entityId}:`, error);
        displayMessage("Failed to update upvote. Please try again.", "error");
        // Revert UI if update failed (optional, but good for robustness)
        const iconElement = element.querySelector('i');
        iconElement.classList.toggle('fas');
        iconElement.classList.toggle('far');
        element.dataset.isUpvoted = String(!isCurrentlyUpvoted);
    } finally {
        element.style.pointerEvents = 'auto'; // Re-enable pointer events
        element.style.opacity = '1';
    }
}

// --- RANK COLOR CLASS HELPER ---
function getRankColorClass(rank) {
    if (rank === 1) {
        return 'text-yellow-400';
    } else if (rank === 2) {
        return 'text-yellow-600';
    } else if (rank === 3) {
        return 'text-yellow-700';
    }
    return 'text-gray-700';
}

// --- CUSTOM MESSAGE BOX (instead of alert) ---
function displayMessage(message, type = "info") {
    const messageBox = document.createElement('div');
    messageBox.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-[1000]
                            ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : 'bg-gray-700'}`;
    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    setTimeout(() => {
        messageBox.remove();
    }, 3000); // Message disappears after 3 seconds
}
