import { db, collection, getDocs } from "../firebase/firebase.js";

export async function renderBooths() {
    try {
        const boothsRef = collection(db, "boothsNumber");
        const querySnapshot = await getDocs(boothsRef);

        // 1. Dynamically clear all existing row containers present on the current DOM
        // Loop 1..57 safely without touching or logging non-existent rows
        for (let i = 1; i <= 57; i++) {
            const container = document.getElementById(`row${i}Container`);
            if (container) {
                container.innerHTML = "";
            }
        }

        // 2. Extract Firestore documents
        const booths = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        let renderedCount = 0;
        let skippedCount = 0;

        // 3. Render each booth into its target row container
        booths.forEach((boot) => {
            // Guard clause: skip if required data is missing
            if (!boot.bootNumber || !boot.row) return;

            // Check if the container exists FIRST before creating elements
            const targetContainer = document.getElementById(`${boot.row}Container`);

            // Silent guard: If this row doesn't exist on this layout/page, skip it cleanly
            if (!targetContainer) {
                skippedCount++;
                return;
            }

            const boothElement = document.createElement("div");

            // Basic text and attributes
            const cleanBoothNumber = String(boot.bootNumber).trim().toUpperCase();
            const boothStatus = boot.status || "available"; // Default to 'available' if missing

            boothElement.textContent = cleanBoothNumber;
            boothElement.dataset.id = boot.docId || boot.id;
            boothElement.dataset.booth = cleanBoothNumber;
            boothElement.dataset.status = boothStatus;

            // Base CSS classes + dynamic status class
            boothElement.classList.add("booth-cell", `status-${boothStatus}`);

            // Append directly to validated container
            targetContainer.appendChild(boothElement);
            renderedCount++;
        });

        console.log(`✅ Rendered ${renderedCount} booths successfully! (${skippedCount} booths mapped to rows not present in this DOM layout)`);
    } catch (error) {
        console.error("❌ Error rendering booths:", error);
    }
}