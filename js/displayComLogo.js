// js/displayComLogo.js

import { db, collection, query, orderBy, onSnapshot } from "../firebase/firebase.js";

// --- GLOBAL TRACKING STATE ---
let activeSelectedCompanyId = null;

// ---------------------------------------------------
// STEP 1: Auto-tag booth cells (Normalized to UPPERCASE)
// ---------------------------------------------------
function tagBoothCells() {
    // Matches booth-style text: A1, J1, U12, C9, 171, 96, etc.
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
        // Always store as UPPERCASE for consistent query matching
        el.dataset.booth = text.toUpperCase();
        count++;
    });

    console.log(`✅ Auto-tagged ${count} booth cells`);
}

// ---------------------------------------------------
// STEP 2: Listen to booth/company cards in REAL-TIME from Firestore
// ---------------------------------------------------
function listenToBooths() {
    const container = document.getElementById("boothContainer");
    if (!container) return;

    console.log("Listening to booths in real-time from Firestore...");

    const boothsCollection = collection(db, "companyBoots");
    const q = query(boothsCollection, orderBy("companyId", "asc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = "<p>No booths found.</p>";
            activeSelectedCompanyId = null;
            resetAllHighlights();
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
                    <img src="${data.asset || ''}" alt="${data.companyName || 'Brand'} Logo" />
                </div>
                <div class="company-name">${data.companyName || 'Unnamed'}</div>
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

        // Re-highlight if active company updated or deleted in real-time
        if (activeSelectedCompanyId !== null) {
            if (currentlyActiveCompanyData) {
                highlightBooths(currentlyActiveCompanyData);
            } else {
                activeSelectedCompanyId = null;
                resetAllHighlights();
            }
        }

        console.log("⚡ Real-time display sync completed!");
    }, (error) => {
        console.error("❌ Error syncing real-time board data:", error);
        container.innerHTML = `<p style="color: red;">Error updating board data: ${error.message}</p>`;
    });
}

// Helper function to wipe styles cleanly
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
// STEP 3: Case-Insensitive Matching for Highlighting
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

                // Avoid adding duplicate pins if clicked repeatedly
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
// STEP 4: Run everything on page load
// ---------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    tagBoothCells();
    listenToBooths();
});