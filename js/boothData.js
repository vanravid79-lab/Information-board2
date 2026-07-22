import {
    db,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp
} from "../firebase/firebase.js";

// Helper Function: Converts a local project image path into a Base64 string dynamically
async function urlToBase64(url) {
    try {
        const response = await fetch(url);
        console.log("response: ", response);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const blob = await response.blob();
        console.log("blob: ", blob);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);

            console.log("reader: ", reader);
        });
    } catch (error) {
        console.warn(`⚠️ Path "${url}" failed to convert. Using valid fallback icon placeholder.`);
        // Fallback transparent 1x1 pixel PNG string so the image source structure remains valid
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
}

const myBootData = [
    {
        "companyId": 1,
        "companyName": "24 កក្កដា",
        "asset": "../image/24 july.jpg",
        "bootNumber": ["A1", "A2", "A3"],
        "status": "confirmed",
        "statusColor": "#28a745"
    },
    {
        "companyId": 2,
        "companyName": "Ford Cambodia",
        "asset": "../image/ford.png",
        "bootNumber": ["B6", "B7"],
        "status": "booking",
        "statusColor": "#ffc107"
    },
    {
        "companyId": 3,
        "companyName": "Hanuman Beer",
        "asset": "../image/hanuman.jpg",
        "bootNumber": ["C7"],
        "status": "confirmed",
        "statusColor": "#28a745"
    },
    {
        "companyId": 4,
        "companyName": "Lok Ov",
        "asset": "../image/lok ov.jpg",
        "bootNumber": ["A10", "A11"],
        "status": "booking",
        "statusColor": "#ffc107"
    },
    {
        "companyId": 5,
        "companyName": "Pocari Sweat",
        "asset": "../image/pocari sweat.jpg",
        "bootNumber": ["J1"],
        "status": "confirmed",
        "statusColor": "#28a745"
    }
];

export async function uploadData() {
    // Referencing the targeted collection name explicitly
    const boothsCollection = collection(db, "companyBoots");
    console.log("Initializing...");

    for (const boot of myBootData) {

        try {
            //  covert my asset to base64
            let finalAsset = boot.asset;
            if (boot.asset.startsWith("../") || boot.asset.startsWith("/")) {
                console.log(`Processing asset structure for: ${boot.companyName}`);
                finalAsset = await urlToBase64(boot.asset);
            }

            const processedBoot = {
                ...boot,
                asset: finalAsset
            };

            console.log("processedBoo: ", processedBoot);

            const q = query(boothsCollection, where("companyId", "==", boot.companyId));
            const querySnapshot = await getDocs(q);
            console.log("querySnapshot: ", querySnapshot);

            if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                const docRef = existingDoc.ref;

                await updateDoc(docRef, {
                    ...processedBoot,
                    updatedAt: serverTimestamp()
                });
                console.log(`🔄 Updated matching record: ${boot.companyName} (ID: ${docRef.id})`);
            } else {

                const dataToUpload = {
                    ...processedBoot,
                    createdAt: serverTimestamp(),

                };

                const newDocRef = await addDoc(boothsCollection, dataToUpload);
                console.log(`🔒 Created new collection document: ${boot.companyName} (ID: ${newDocRef.id})`);
            }
        } catch (error) {
            console.error(`❌ Complete pipeline break on "${boot.companyName}":`, error);
        }
    }
    alert("Upload execution finished! Check your Firestore panel.");
}