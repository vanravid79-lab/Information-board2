import { db, collection, getDocs } from "../firebase/firebase.js";

export async function renderBooths() {
    try {
        const boothsRef = collection(db, "boothsNumber");
        const querySnapshot = await getDocs(boothsRef);

        // 1. Dynamically clear all row containers (row1Container through row40Container)
        // Prevents duplicate booth elements if function is called multiple times
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

        // 3. Render each booth into its target row container
        booths.forEach((boot) => {
            // Guard clause: skip if required data is missing
            if (!boot.bootNumber || !boot.row) return;

            const boothElement = document.createElement("div");

            // Basic text and attributes
            const cleanBoothNumber = String(boot.bootNumber).trim().toUpperCase();
            const boothStatus = boot.status || "available"; // Default to 'available' if missing

            boothElement.textContent = cleanBoothNumber;
            boothElement.dataset.id = boot.docId || boot.id;
            boothElement.dataset.booth = cleanBoothNumber;
            boothElement.dataset.status = boothStatus;

            // Base CSS classes + dynamic status class (e.g., status-available, status-booking, status-confirm)
            boothElement.classList.add("booth-cell", `status-${boothStatus}`);

            // Dynamic row target lookup (e.g., "row1" -> "row1Container")
            const targetContainer = document.getElementById(`${boot.row}Container`);

            if (targetContainer) {
                targetContainer.appendChild(boothElement);
            } else {
                console.warn(`⚠️ Target container element "#${boot.row}Container" not found in DOM.`);
            }
        });

        console.log("✅ Booths rendered successfully with status classes!");
    } catch (error) {
        console.error("❌ Error rendering booths:", error);
    }
}