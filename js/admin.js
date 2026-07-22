import {
    db,
    collection,
    query,
    getDocs,
    orderBy,
    limit,
    addDoc,
    serverTimestamp,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch,
    deleteField
} from "../firebase/firebase.js";

// -------------------------------------------------------------
// DYNAMIC MASTER BOOTH LIST (Loaded live from 'boothsNumber' collection)
// -------------------------------------------------------------
let MASTER_BOOTH_LIST = [];

const boothsCollection = collection(db, "companyBoots");

// Memory state
const selectedBooths = new Set();
let latestItems = [];

// DOM References
const adminForm = document.getElementById('adminForm');
const formContainer = document.getElementById('allMyContainer');
const toggleFormBtn = document.getElementById('btnToggleForm');
const drawerOverlay = document.getElementById('drawerOverlay');
const btnCloseDrawer = document.getElementById('btnCloseDrawer');
const cancelEditBtn = document.getElementById('btnCancelEdit');

const brandListContainer = document.getElementById('brandListContainer');
const searchInput = document.getElementById('searchInput');
const statBrands = document.getElementById('statBrands');
const statBooths = document.getElementById('statBooths');
const statUpdated = document.getElementById('statUpdated');

const hiddenBoothInput = document.getElementById('boothNumbers');
const feedbackContainer = document.getElementById('boothValidationFeedback');
const statusGridContainer = document.getElementById('allBoothsStatusGrid');

const brandFileInput = document.getElementById('brandImage');
const imagePreviewEl = document.getElementById('imagePreview');

const companyNameInput = document.getElementById('companyName');
const brandNameFeedback = document.getElementById('brandNameFeedback');

if (companyNameInput && brandNameFeedback) {
    companyNameInput.addEventListener('input', () => {
        const val = companyNameInput.value.trim().toLowerCase();
        const editingDocId = document.getElementById('editingDocId')?.value || "";

        if (!val) {
            brandNameFeedback.innerHTML = "";
            return;
        }

        const exists = latestItems.some(({ id: docId, data }) => {
            if (editingDocId && docId === editingDocId) return false;
            return (data.companyName || "").trim().toLowerCase() === val;
        });

        if (exists) {
            brandNameFeedback.style.color = "#d32f2f";
            brandNameFeedback.innerHTML = "❌ This brand name is already registered.";
        } else {
            brandNameFeedback.style.color = "#2e7d32";
            brandNameFeedback.innerHTML = "✓ Brand name is available.";
        }
    });
}



if (brandFileInput) {
    brandFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && imagePreviewEl) {
            if (file.size > 800 * 1024) {
                alert("The image is too large! Please select a file smaller than 800KB.");
                brandFileInput.value = "";
                return;
            }
            const base64 = await fileToBase64(file);
            imagePreviewEl.src = base64;
            imagePreviewEl.style.display = "block";
        }
    });
}

// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? "";
    return div.innerHTML;
}



// -------------------------------------------------------------
// FETCH MASTER BOOTHS FROM FIRESTORE
// -------------------------------------------------------------
/**
 * Loads all booth numbers from the 'boothsNumber' collection dynamically
 * and updates MASTER_BOOTH_LIST.
 */
async function loadMasterBoothList() {
    try {
        const boothsRef = collection(db, "boothsNumber");
        const snapshot = await getDocs(boothsRef);

        const boothNumbers = [];

        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            // Supports both 'bootNumber' and 'boothNumber' keys
            const num = data.bootNumber || data.boothNumber;
            if (num) {
                boothNumbers.push(num.trim());
            }
        });

        // Deduplicate and natural-sort (e.g., A1, A2, A10)
        MASTER_BOOTH_LIST = Array.from(new Set(boothNumbers)).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        console.log(`✅ Loaded ${MASTER_BOOTH_LIST.length} master booths from 'boothsNumber' collection.`);

        // Re-render UI selector grid once loaded
        triggerLiveCheck();

    } catch (error) {
        console.error("❌ Failed to load master booth list from Firestore:", error);
    }
}

// Execute initial load of master list
loadMasterBoothList();

// -------------------------------------------------------------
// DRAWER VISIBILITY & FORM MANAGEMENT
// -------------------------------------------------------------
function openDrawer() {
    if (formContainer) formContainer.style.display = "block";
    if (drawerOverlay) drawerOverlay.classList.add('is-visible');
    if (toggleFormBtn) {
        toggleFormBtn.innerHTML = '<span class="btn-icon">✕</span> Close Form';
    }
}

function resetFormState() {
    if (adminForm) adminForm.reset();

    selectedBooths.clear();

    const editingIdEl = document.getElementById('editingDocId');
    if (editingIdEl) editingIdEl.value = "";

    const formTitleEl = document.getElementById('formTitle');
    if (formTitleEl) formTitleEl.innerText = "Add New Brand";

    // --- Reset Image Preview ---
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.src = "";
        imagePreview.style.display = "none";
    }

    if (cancelEditBtn) cancelEditBtn.style.display = "none";
    if (feedbackContainer) feedbackContainer.innerHTML = "";

    if (formContainer) formContainer.style.display = "none";
    if (drawerOverlay) drawerOverlay.classList.remove('is-visible');
    if (toggleFormBtn) {
        toggleFormBtn.innerHTML = '<span class="btn-icon">+</span> Add Brand';
    }

    triggerLiveCheck();
}

if (toggleFormBtn) {
    toggleFormBtn.addEventListener('click', () => {
        const isHidden = !formContainer.style.display || formContainer.style.display === "none";
        if (isHidden) {
            openDrawer();
        } else {
            resetFormState();
        }
    });
}

if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', resetFormState);
if (drawerOverlay) drawerOverlay.addEventListener('click', resetFormState);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetFormState);

// -------------------------------------------------------------
// REAL-TIME FIRESTORE LISTENER (Company Bookings)
// -------------------------------------------------------------
onSnapshot(query(boothsCollection, orderBy("companyId", "asc")), (snapshot) => {
    latestItems = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        data: docSnapshot.data()
    }));

    updateStats();
    renderList(latestItems, searchInput ? searchInput.value : "");
    triggerLiveCheck();
}, (error) => {
    console.error("Firestore snapshot error:", error);
});

function updateStats() {
    const totalBrands = latestItems.length;
    const totalBooths = latestItems.reduce(
        (sum, entry) => sum + (Array.isArray(entry.data.bootNumber) ? entry.data.bootNumber.length : 0),
        0
    );

    if (statBrands) statBrands.textContent = totalBrands;
    if (statBooths) statBooths.textContent = totalBooths;
    if (statUpdated) {
        statUpdated.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// -------------------------------------------------------------
// BRAND LIST RENDERING
// -------------------------------------------------------------
function renderList(items, filterText) {
    if (!brandListContainer) return;
    brandListContainer.innerHTML = "";

    const normalizedFilter = (filterText || "").trim().toUpperCase();
    const filteredItems = normalizedFilter
        ? items.filter(({ data }) => {
            const nameMatch = (data.companyName || "").toUpperCase().includes(normalizedFilter);
            const boothMatch = Array.isArray(data.bootNumber) &&
                data.bootNumber.some((b) => b.toUpperCase().includes(normalizedFilter));
            return nameMatch || boothMatch;
        })
        : items;

    if (items.length === 0) {
        brandListContainer.innerHTML = "<p class='loading-text'>No brands booked yet.</p>";
        return;
    }

    if (filteredItems.length === 0) {
        brandListContainer.innerHTML = "<p class='loading-text'>No brands match your search.</p>";
        return;
    }

    filteredItems.forEach(({ id: docId, data: item }) => {
        const row = document.createElement('div');
        row.className = "brand-row";

        const boothChips = (item.bootNumber || [])
            .map((b) => `<span class="booth-chip">${escapeHtml(b)}</span>`)
            .join('');

        row.innerHTML = `
            <div class="companyLogo2">
                <img src="${escapeHtml(item.asset || '')}" alt="${escapeHtml(item.companyName || '')} Logo" />
            </div>

            <div class="brand-info">
                <div class="brand-title-area">
                    <span class="brand-name">${escapeHtml(item.companyName || '')}</span>
                    <span class="brand-id">#${item.companyId ?? '—'}</span>
                </div>
            </div>

            <div class="brand-booths">
                ${boothChips}
            </div>

            <span class="status-badge" data-status="${escapeHtml(item.status || 'booking')}">${escapeHtml(item.status || 'booking')}</span>

            <div class="brand-actions">
                <button class="btn-action edit" data-id="${docId}">Edit</button>
                <button class="btn-action delete" data-id="${docId}">Delete</button>
            </div>
        `;

        row.querySelector('.delete')?.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete ${item.companyName}?`)) {
                try {
                    await deleteDoc(doc(db, "companyBoots", docId));
                    alert("Brand deleted successfully!");
                } catch (err) {
                    console.error("Delete failed:", err);
                    alert("Failed to delete brand.");
                }
            }
        });

        row.querySelector('.edit')?.addEventListener('click', () => {
            openDrawer();

            const editingDocIdEl = document.getElementById('editingDocId');
            const companyNameEl = document.getElementById('companyName');
            const formTitleEl = document.getElementById('formTitle');
            const imagePreviewEl = document.getElementById('imagePreview'); // Preview element

            if (editingDocIdEl) editingDocIdEl.value = docId;
            if (companyNameEl) companyNameEl.value = item.companyName || "";
            if (formTitleEl) formTitleEl.innerText = `Editing: ${item.companyName || ''}`;

            // --- Show existing logo preview on edit ---
            if (imagePreviewEl && item.asset) {
                imagePreviewEl.src = item.asset;
                imagePreviewEl.style.display = "block";
            } else if (imagePreviewEl) {
                imagePreviewEl.src = "";
                imagePreviewEl.style.display = "none";
            }

            if (cancelEditBtn) cancelEditBtn.style.display = "block";

            selectedBooths.clear();
            if (Array.isArray(item.bootNumber)) {
                item.bootNumber.forEach(b => selectedBooths.add(b.toUpperCase()));
            }

            triggerLiveCheck();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        brandListContainer.appendChild(row);
    });
}

if (searchInput) {
    searchInput.addEventListener('input', () => {
        renderList(latestItems, searchInput.value);
    });
}

// -------------------------------------------------------------
// INTERACTIVE BOOTH SELECTOR & LIVE BOARD
// -------------------------------------------------------------
function toggleBoothSelection(booth) {
    if (selectedBooths.has(booth)) {
        selectedBooths.delete(booth);
    } else {
        selectedBooths.add(booth);
    }
    triggerLiveCheck();
}

function triggerLiveCheck() {
    const editingDocId = document.getElementById('editingDocId')?.value || "";

    const takenBoothsMap = {};
    latestItems.forEach(({ id: docId, data: item }) => {
        if (Array.isArray(item.bootNumber)) {
            item.bootNumber.forEach(b => {
                const normBooth = b.toUpperCase();
                if (editingDocId && docId === editingDocId) return;
                takenBoothsMap[normBooth] = item.companyName || "Booked";
            });
        }
    });

    // Merge fetched master list with booked or custom selections
    const allBoothsSet = new Set([...MASTER_BOOTH_LIST, ...Object.keys(takenBoothsMap), ...Array.from(selectedBooths)]);
    const sortedBooths = Array.from(allBoothsSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (statusGridContainer) {
        statusGridContainer.innerHTML = "";

        if (sortedBooths.length === 0) {
            statusGridContainer.innerHTML = "<p class='loading-text'>Loading booth map...</p>";
            return;
        }

        sortedBooths.forEach(booth => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "booth-tile";
            btn.dataset.booth = booth;

            const owner = takenBoothsMap[booth];
            const isSelected = selectedBooths.has(booth);

            if (owner) {
                btn.classList.add('is-booked');
                btn.textContent = `${booth} (${owner})`;
                btn.title = `Booked by ${owner}`;
                btn.disabled = true;
            } else if (isSelected) {
                btn.classList.add('is-selected');
                btn.textContent = `${booth} ✓`;
                btn.addEventListener('click', () => toggleBoothSelection(booth));
            } else {
                btn.textContent = booth;
                btn.addEventListener('click', () => toggleBoothSelection(booth));
            }

            statusGridContainer.appendChild(btn);
        });
    }

    const sortedSelected = Array.from(selectedBooths).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (hiddenBoothInput) {
        hiddenBoothInput.value = sortedSelected.join(',');
    }

    if (feedbackContainer) {
        if (sortedSelected.length === 0) {
            feedbackContainer.innerHTML = `<span style="color: #757575;">No booths selected. Click available tiles above.</span>`;
        } else {
            feedbackContainer.innerHTML = `<span style="color: #0288d1; font-weight: bold;">Selected (${sortedSelected.length}):</span> ${sortedSelected.join(', ')}`;
        }
    }
}

// -------------------------------------------------------------
// FORM SUBMISSION (ADD & UPDATE)
// -------------------------------------------------------------
if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const form = e.target;
        const submitButton = form.querySelector('.btn-submit');
        const editingDocId = document.getElementById('editingDocId')?.value || "";
        const isEditing = editingDocId !== "";

        const uniqueBootNumbers = Array.from(selectedBooths).map(b => b.toUpperCase());

        if (uniqueBootNumbers.length === 0) {
            alert("Please click at least one available booth from the grid to select it.");
            return;
        }

        const conflicts = [];
        latestItems.forEach(({ id: docId, data }) => {
            if (isEditing && docId === editingDocId) return;

            if (Array.isArray(data.bootNumber)) {
                data.bootNumber.forEach(b => {
                    const norm = b.toUpperCase();
                    if (uniqueBootNumbers.includes(norm)) {
                        conflicts.push(`${norm} (Booked by: ${data.companyName || 'another company'})`);
                    }
                });
            }
        });

        if (conflicts.length > 0) {
            alert(`⚠️ Booking Conflict:\nThe following booth(s) were just taken:\n- ${conflicts.join("\n- ")}`);
            triggerLiveCheck();
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerText = "Processing...";
        }

        try {
            const companyName = document.getElementById('companyName')?.value || "";
            const fileInput = document.getElementById('brandImage');
            let base64Asset = "";

            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (file.size > 800 * 1024) {
                    alert("The image is too large! Please select a file smaller than 800KB.");
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.innerText = isEditing ? "Save Changes" : "Submit Info";
                    }
                    return;
                }
                base64Asset = await fileToBase64(file);
            }

            if (isEditing) {
                if (submitButton) submitButton.innerText = "Updating...";
                const docRef = doc(db, "companyBoots", editingDocId);

                const updatedData = {
                    companyName: companyName,
                    bootNumber: uniqueBootNumbers,
                    updatedAt: serverTimestamp()
                };

                if (base64Asset !== "") {
                    updatedData.asset = base64Asset;
                }

                await updateDoc(docRef, updatedData);
                alert("Company details updated successfully!");
            } else {
                if (submitButton) submitButton.innerText = "Generating ID...";
                const maxIdQuery = query(boothsCollection, orderBy("companyId", "desc"), limit(1));
                const maxIdSnapshot = await getDocs(maxIdQuery);

                let nextCompanyId = 0;
                if (!maxIdSnapshot.empty) {
                    const highestCompanyDoc = maxIdSnapshot.docs[0].data();
                    if (Number.isSafeInteger(highestCompanyDoc.companyId) && highestCompanyDoc.companyId >= 0) {
                        nextCompanyId = highestCompanyDoc.companyId;
                    }
                }
                nextCompanyId += 1;

                if (base64Asset === "") {
                    base64Asset = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                }

                const newCompanyData = {
                    companyId: nextCompanyId,
                    companyName: companyName,
                    asset: base64Asset,
                    bootNumber: uniqueBootNumbers,
                    status: "booking",
                    statusColor: "#ffc107",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await addDoc(boothsCollection, newCompanyData);
                alert(`Company details successfully saved with ID: ${nextCompanyId}`);
            }

            resetFormState();

        } catch (error) {
            console.error("❌ Form transaction failure:", error);
            alert(`Failed to process transaction: ${error.message}`);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerText = isEditing ? "Save Changes" : "Submit Info";
            }
        }
    });
}

// -------------------------------------------------------------
// FIRESTORE SEEDING & UTILITY FUNCTIONS
// -------------------------------------------------------------
export async function seedBoothsCollection() {
    try {
        const boothsRef = collection(db, "boothsNumber");
        const snapshot = await getDocs(boothsRef);

        const existingBoothsMap = new Map();
        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const boothNum = data.bootNumber || data.boothNumber;
            if (boothNum) {
                existingBoothsMap.set(boothNum, {
                    ref: docSnap.ref,
                    status: data.status || "available"
                });
            }
        });

        const newBoothsSet = new Set();
        const batch = writeBatch(db);

        rawBoothData.forEach((rowObject) => {
            const [rowKey, boothList] = Object.entries(rowObject)[0];

            boothList.forEach((bootNumber) => {
                newBoothsSet.add(bootNumber);

                if (existingBoothsMap.has(bootNumber)) {
                    const { ref, status } = existingBoothsMap.get(bootNumber);
                    batch.update(ref, {
                        bootNumber: bootNumber,
                        boothNumber: deleteField(),
                        row: rowKey,
                        status: status,
                        updatedAt: serverTimestamp()
                    });
                } else {
                    const newBoothRef = doc(boothsRef);
                    batch.set(newBoothRef, {
                        docId: newBoothRef.id,
                        bootNumber: bootNumber,
                        row: rowKey,
                        status: "available",
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            });
        });

        existingBoothsMap.forEach(({ ref }, bootNumber) => {
            if (!newBoothsSet.has(bootNumber)) {
                batch.delete(ref);
            }
        });

        await batch.commit();
        console.log("✅ Seed & sync completed successfully!");

        // Reload master list after seeding
        await loadMasterBoothList();
    } catch (error) {
        console.error("❌ Error syncing 'boothsNumber' collection:", error);
        throw error;
    }
}

export async function updateBoothStatus(docId, newStatus) {
    const validStatuses = ["available", "booking", "confirm"];

    if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: "${newStatus}". Must be one of: ${validStatuses.join(", ")}`);
    }

    try {
        const boothRef = doc(db, "boothsNumber", docId);
        await updateDoc(boothRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        console.log(`✅ Booth status updated to "${newStatus}"`);
    } catch (error) {
        console.error("❌ Failed to update booth status:", error);
        throw error;
    }
}