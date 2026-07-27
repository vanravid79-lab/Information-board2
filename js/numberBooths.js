import {
    db,
    writeBatch,
    doc,
    collection,
    serverTimestamp,
    getDocs,
    updateDoc,
    deleteField
} from "../firebase/firebase.js";

const rawBoothData = [
    { "row1": ["A20", "A22", "A24", "A26", "A28"] },
    { "row2": ["F01", "G02", "H03", "I04", "J05", "L06", "M07", "N08"] },
    { "row3": ["A1", "A2", "A3", "A4"] },
    { "row4": ["A5", "A6", "A7", "A8"] },
    { "row5": ["A9", "A10", "A11", "A12"] },
    { "row6": ["B1", "B2", "B3", "B4"] },
    { "row7": ["B5", "B6", "B7", "B8"] },
    { "row8": ["B10", "B11", "B12", "B9"] },
    { "row9": ["C1", "C2", "C3", "C4", "C5"] },
    { "row10": ["C6", "C7", "C8", "C9"] },
    { "row11": ["U1", "U2", "U3", "U4"] },
    { "row12": ["U5", "U6", "U7", "U8"] },
    { "row13": ["P1", "P2", "P3", "P4"] },
    { "row14": ["D1", "D2", "D3", "D4", "D5"] },
    { "row15": ["C10", "C12", "C14", "C16"] },
    { "row16": ["C18", "C20", "C22", "C24"] },
    { "row17": ["D10", "D11", "D12", "D13"] },
    { "row18": ["C25", "C26", "C27", "C28"] },
    { "row19": ["C29", "C30", "C31", "C32"] },
    { "row20": ["D40", "D41", "D42", "D43"] },
    { "row21": ["J1", "J3", "J5", "J7", "J9"] },
    { "row22": ["J11", "J13", "J15", "J17", "J19"] },
    { "row23": ["J01", "J02", "J03"] },
    { "row24": ["J04", "J05", "J06"] },
    { "row25": ["E1", "E2", "E3", "E4", "E5"] },
    { "row26": ["E10", "E11", "E12", "E13", "E14"] },
    { "row27": ["E15", "E16", "E17", "E18", "E19"] },
    { "row28": ["F30", "F31", "F32", "F33", "F34"] },
    { "row29": ["F35", "F36", "F37", "F38", "F39"] },
    { "row30": ["Y1", "Y10", "Y11"] },
    { "row31": ["Y12", "Y13", "Y14"] },
    { "row32": ["Y2", "Y20", "Y21"] },
    { "row33": ["Y22", "Y23", "Y24"] },
    { "row34": ["J44", "J45", "J46"] },
    { "row35": ["J50", "J51", "J52"] },
    { "row36": ["Z1", "Z2", "Z3", "Z4"] },
    { "row37": ["Z22", "Z23", "Z33", "Z40"] },
    { "row38": ["L1", "L2", "L3"] },
    { "row39": ["L8", "L9", "L10"] },
    { "row40": ["V1", "V2", "V3", "V4", "V5", "V6"] },
    { "row44": ["S30"] },
    { "row45": ["S31"] },
    { "row46": ["S33"] },
    { "row47": ["G5", "G6", "G7", "G8"] },
    { "row48": ["G1", "G2", "G3", "G4"] },
    { "row49": ["G90", "G91", "G92", "G93"] },
    { "row50": ["M1", "M4", "M9"] },
    { "row51": ["M60", "M61"] },
    { "row52": ["S80"] },
    { "row53": ["S81"] },
    { "row54": ["S82"] },
    { "row55": ["S83"] },
    { "row56": ["S84"] },
    { "row57": ["S85"] },

];

export async function seedBoothsCollection() {
    try {
        const boothsRef = collection(db, "boothsNumber");
        const snapshot = await getDocs(boothsRef);

        // Map existing booths: bootNumber -> { ref, currentStatus }
        const existingBoothsMap = new Map();
        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const boothNum = data.bootNumber || data.boothNumber;
            if (boothNum) {
                existingBoothsMap.set(boothNum, {
                    ref: docSnap.ref,
                    status: data.status || "available" // Retain current status or default to 'available'
                });
            }
        });

        const newBoothsSet = new Set();

        const batch = writeBatch(db);

        // Process ADD & UPDATE
        rawBoothData.forEach((rowObject) => {
            const [rowKey, boothList] = Object.entries(rowObject)[0];

            boothList.forEach((bootNumber) => {
                newBoothsSet.add(bootNumber);

                if (existingBoothsMap.has(bootNumber)) {
                    // UPDATE: Preserve status, convert key name, clean up old field
                    const { ref, status } = existingBoothsMap.get(bootNumber);
                    batch.update(ref, {
                        bootNumber: bootNumber,
                        boothNumber: deleteField(),
                        row: rowKey,
                        status: status,
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // ADD: Create new booth with default status = "available"
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

        // Process DELETE (remove docs missing from rawBoothData)
        existingBoothsMap.forEach(({ ref }, bootNumber) => {
            if (!newBoothsSet.has(bootNumber)) {
                batch.delete(ref);
            }
        });

        await batch.commit();
        console.log("✅ Seed & sync completed successfully!");
    } catch (error) {
        console.error("❌ Error syncing 'boothsNumber' collection:", error);
        throw error;
    }
}

/**
 * Utility function to update a booth's status in Firestore
 * @param {string} docId - The Firestore document ID
 * @param {'available' | 'booking' | 'confirm'} newStatus
 */
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