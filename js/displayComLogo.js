import { db, collection, query, orderBy, onSnapshot } from "../firebase/firebase.js";

// --- GLOBAL TRACKING STATE ---
let activeSelectedCompanyId = null;
let previousCardCount = 0;

// ---------------------------------------------------
// STEP 1: Auto-tag booth cells (Normalized to UPPERCASE)
// ---------------------------------------------------
function tagBoothCells() {
    const boothPattern = /^[A-Za-z]{0,3}\d+$/;

    const scope = document.querySelectorAll(
        ".parentRow1 div, .subParent1 div, .row1 div, .row2 div, .number-row2 div, .number-row3 div"
    );

    let count = 0;

    scope.forEach(el => {
        if (el.children.length > 0) return;
        if (el.classList.contains("booth-cell")) return;

        const text = el.textContent.trim();
        if (!boothPattern.test(text)) return;

        el.classList.add("booth-cell");
        el.dataset.booth = text.toUpperCase();
        count++;
    });

    console.log(`✅ Auto-tagged ${count} booth cells`);
}

// ---------------------------------------------------
// STEP 2: Real-time listener for Firestore company booths
// ---------------------------------------------------
function listenToBooths() {
    const container = document.getElementById("boothContainer");
    if (!container) {
        console.warn("⚠️ Element #boothContainer not found in DOM.");
        return;
    }

    console.log("Listening to booths in real-time from Firestore...");

    const boothsCollection = collection(db, "companyBoots");
    const q = query(boothsCollection, orderBy("companyId", "asc"));

    onSnapshot(q, (snapshot) => {
        const currentScrollLeft = container.scrollLeft;
        const currentCardCount = snapshot.size;

        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = "<p style='padding:1rem; width:100%; text-align:center;'>No booths found.</p>";
            activeSelectedCompanyId = null;
            resetAllHighlights();
            previousCardCount = 0;
            return;
        }

        let currentlyActiveCompanyData = null;

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const compId = data.companyId;

            const card = document.createElement("div");
            card.className = "company-card";
            card.style.cursor = "pointer";

            if (activeSelectedCompanyId !== null && compId === activeSelectedCompanyId) {
                card.classList.add("active-selected-card");
                currentlyActiveCompanyData = data;
            }

            if (data.statusColor) {
                card.style.borderTop = `5px solid ${data.statusColor}`;
            }

            card.innerHTML = `
                <div class="companyLogo">
                    <img src="${data.asset || ''}" alt="${data.companyName || 'Brand'} Logo" loading="lazy" />
                </div>
                <div class="company-name" title="${data.companyName || ''}">${data.companyName || 'Unnamed'}</div>
            `;

            card.addEventListener("click", () => {
                if (activeSelectedCompanyId === compId) {
                    activeSelectedCompanyId = null;
                    resetAllHighlights();
                    card.classList.remove("active-selected-card");
                } else {
                    activeSelectedCompanyId = compId;

                    document.querySelectorAll(".company-card").forEach(c => c.classList.remove("active-selected-card"));
                    card.classList.add("active-selected-card");

                    highlightBooths(data);
                }
            });

            container.appendChild(card);
        });

        if (activeSelectedCompanyId !== null) {
            if (currentlyActiveCompanyData) {
                highlightBooths(currentlyActiveCompanyData);
            } else {
                activeSelectedCompanyId = null;
                resetAllHighlights();
            }
        }

        // Keep scroll position smooth on real-time sync
        if (previousCardCount > 0 && currentCardCount > previousCardCount) {
            container.scrollTo({
                left: container.scrollWidth,
                behavior: "smooth"
            });
        } else {
            container.scrollLeft = currentScrollLeft;
        }

        previousCardCount = currentCardCount;
        console.log("⚡ Real-time display sync completed!");
    }, (error) => {
        console.error("❌ Error syncing real-time board data:", error);
        container.innerHTML = `<p style="color: red; padding:1rem;">Error updating board data: ${error.message}</p>`;
    });
}

// ---------------------------------------------------
// STEP 3: Clear all highlights cleanly
// ---------------------------------------------------
function resetAllHighlights() {
    const allCells = document.querySelectorAll(".booth-cell");
    allCells.forEach(cell => {
        cell.style.backgroundColor = "";
        cell.style.color = "";
        cell.classList.remove("highlighted");

        const existingPin = cell.querySelector(".booth-pin");
        if (existingPin) {
            existingPin.remove();
        }
    });
}

// ---------------------------------------------------
// STEP 4: Case-insensitive booth highlighter
// ---------------------------------------------------
function highlightBooths(data) {
    resetAllHighlights();

    if (!data || !Array.isArray(data.bootNumber) || data.bootNumber.length === 0) {
        console.warn("⚠️ No booth numbers found for this company.");
        return;
    }

    const allBoothCells = document.querySelectorAll(".booth-cell");

    data.bootNumber.forEach(num => {
        const cleanNum = String(num).trim().toUpperCase();
        let found = false;

        allBoothCells.forEach(cell => {
            const cellBooth = (cell.dataset.booth || "").trim().toUpperCase();

            if (cellBooth === cleanNum) {
                found = true;
                cell.style.backgroundColor = data.statusColor || "#007bff";
                cell.classList.add("highlighted");

                if (!cell.querySelector(".booth-pin")) {
                    const pin = document.createElement("i");
                    pin.className = "fa-solid fa-location-dot booth-pin";
                    pin.style.fontFamily = '"Font Awesome 6 Free", "Font Awesome 7 Free", sans-serif';
                    pin.style.fontWeight = "900";
                    pin.style.color = "red";
                    pin.style.fontSize = "2rem";

                    cell.style.position = "relative";
                    cell.appendChild(pin);
                }
            }
        });

        if (!found) {
            console.warn(`⚠️ Target map cell not found for booth number: "${cleanNum}"`);
        }
    });
}

// ---------------------------------------------------
// STEP 5: Desktop Drag-to-Scroll Mechanism
// ---------------------------------------------------
function enableDragToScroll() {
    const container = document.getElementById("boothContainer");
    if (!container) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;

    container.addEventListener("mousedown", (e) => {
        isDown = true;
        isDragging = false;
        container.style.cursor = "grabbing";
        container.style.scrollBehavior = "auto";
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });

    const endDrag = () => {
        isDown = false;
        container.style.cursor = "grab";
        container.style.scrollBehavior = "smooth";
    };

    container.addEventListener("mouseleave", endDrag);
    container.addEventListener("mouseup", endDrag);

    container.addEventListener("mousemove", (e) => {
        if (!isDown) return;

        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5;

        if (Math.abs(x - startX) > 5) {
            isDragging = true;
            e.preventDefault();
            container.scrollLeft = scrollLeft - walk;
        }
    });

    container.addEventListener("click", (e) => {
        if (isDragging) {
            e.stopImmediatePropagation();
            e.preventDefault();
            isDragging = false;
        }
    }, true);
}

// ---------------------------------------------------
// STEP 6: Run on DOM ready
// ---------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    tagBoothCells();
    listenToBooths();
    enableDragToScroll();
});