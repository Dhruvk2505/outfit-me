// --- Firebase and MediaPipe Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// --- Your Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBafbWmG0k7mFBtCq_Zj3bVPia-GXyv_jo",
    authDomain: "outfit-me-app-e9c8b.firebaseapp.com",
    projectId: "outfit-me-app-e9c8b",
    storageBucket: "outfit-me-app-e9c8b.appspot.com",
    messagingSenderId: "650076729047",
    appId: "1:650076729047:web:806e86a66f99e21d750a92",
    measurementId: "G-H6FZKJ2RJW"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


// --- Main Logic Controller ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.auth-container')) { runAuthLogic(); }
    if (document.querySelector('.style-finder')) { runHomeLogic(); }
    if (document.getElementById('video-container')) { runMeasurementLogic(); }
    if (document.getElementById('chat-messages')) { runChatLogic(); } 
    if (document.getElementById('wardrobe-grid')) { runWardrobeLogic(); }
    if (document.getElementById('closet-items')) { runOutfitBuilderLogic(); }
    if (document.getElementById('look-content-container')) { runLookDetailsLogic(); }
});


// --- 1. Authentication Logic (Firebase Version) ---
function runAuthLogic() {
    const emailView = document.getElementById('email-view');
    const successView = document.getElementById('success-view');
    const emailForm = document.getElementById('email-form');
    const emailInput = document.getElementById('email-input');
    const userEmailDisplay = document.getElementById('user-email-display');
    const emailError = document.getElementById('email-error');
    
    // Flow 1: User enters email to get a link
    if (emailForm) {
        emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = emailInput.value;
            if (!email) {
                emailError.textContent = 'Please enter an email address.';
                return;
            }

            const actionCodeSettings = {
                url: window.location.href.replace('login.html', 'home.html'),
                handleCodeInApp: true
            };

            sendSignInLinkToEmail(auth, email, actionCodeSettings)
                .then(() => {
                    window.localStorage.setItem('emailForSignIn', email);
                    emailError.textContent = '';
                    userEmailDisplay.textContent = email;
                    emailView.style.display = 'none';
                    successView.style.display = 'block';
                })
                .catch((error) => {
                    emailError.textContent = error.message;
                });
        });
    }

    // Flow 2: User clicks the link in their email and returns
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }

        signInWithEmailLink(auth, email, window.location.href)
            .then((result) => {
                window.localStorage.removeItem('emailForSignIn');
                
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', result.user.email);
                window.location.href = 'home.html';
            })
            .catch((error) => {
                if(emailError) emailError.textContent = `Error: ${error.message}`;
            });
    }
}


// --- 2. Home Page Logic (Complete and Correct) ---
function runHomeLogic() {
    const filterButtons = document.querySelectorAll('.finder-btn');
    const gridItems = document.querySelectorAll('.grid-item');

    function filterItems() {
        const activeButton = document.querySelector('.finder-btn.active');
        if (!activeButton) return;
        const filter = activeButton.textContent.toLowerCase();

        gridItems.forEach(item => {
            const category = item.dataset.category;
            if (filter === 'for him' && category.includes('him')) {
                item.style.display = 'block';
            } else if (filter === 'for her' && category.includes('her')) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterItems();
        });
    });

    filterItems();
}

// --- 3. Measurement Logic (Complete and Correct) ---
function runMeasurementLogic() {
    const video = document.getElementById("video");
    const canvasElement = document.getElementById("output_canvas");
    const canvasCtx = canvasElement.getContext("2d");
    const drawingUtils = new DrawingUtils(canvasCtx);
    const errorContainer = document.getElementById("error-container");
    const startCamBtn = document.getElementById("start-cam-btn");
    const stopCamBtn = document.getElementById("stop-cam-btn");
    const resetBtn = document.getElementById("reset-btn");
    const ratioResultsDiv = document.getElementById("ratio-results");
    const measurementForm = document.getElementById('measurement-form');
    
    let poseLandmarker;
    let webcamStream;
    let animationFrameId;
    let stableRatio = 0;
    let stableCounter = 0;
    let finalRatioLocked = false;
    const STABILITY_THRESHOLD = 0.05; 
    const FRAMES_PER_SECOND = 30; 
    const STABLE_FRAMES_REQUIRED = 4 * FRAMES_PER_SECOND;
    let ratioHistory = [];
    const SMOOTHING_WINDOW = 15;

    const genderRadios = document.querySelectorAll('input[name="gender"]');
    const chestField = document.getElementById('chest-field');
    const bustField = document.getElementById('bust-field');
    genderRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.value === 'male') {
                chestField.classList.remove('hidden');
                bustField.classList.add('hidden');
            } else {
                chestField.classList.add('hidden');
                bustField.classList.remove('hidden');
            }
        });
    });

    measurementForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(measurementForm);
        const measurements = Object.fromEntries(formData.entries());
        localStorage.setItem('manualMeasurements', JSON.stringify(measurements));
        localStorage.removeItem('cameraRatio');
        alert('Your manual measurements have been saved!');
    });
    
    async function createPoseLandmarker() {
        if (poseLandmarker) return; 
        try {
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                    delegate: "GPU"
                }, runningMode: "VIDEO", numPoses: 1
            });
        } catch (error) { displayError("Could not load measurement model. Please check your internet connection and refresh."); }
    }

    function enableWebcam() {
        if (!poseLandmarker) {
            displayError("Model is still loading. Please wait a moment and try again.");
            return;
        }
        resetMeasurement();
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                webcamStream = stream;
                video.srcObject = stream;
                video.addEventListener("loadeddata", predictWebcam);
            })
            .catch((err) => { displayError("Could not access camera. Please grant permissions in your browser settings."); });
    }

    function stopWebcam() {
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            if(animationFrameId) { cancelAnimationFrame(animationFrameId); }
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            ratioResultsDiv.innerHTML = "<p>Camera is off. Turn on to see results.</p>";
        }
    }
    
    function resetMeasurement() {
        stableRatio = 0;
        stableCounter = 0;
        finalRatioLocked = false;
        ratioHistory = [];
        localStorage.removeItem('cameraRatio');
        localStorage.removeItem('manualMeasurements');
        ratioResultsDiv.innerHTML = "<p>Stand still, facing the camera...</p>";
    }

    let lastVideoTime = -1;
    function predictWebcam() {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            poseLandmarker.detectForVideo(video, performance.now(), (result) => {
                canvasCtx.save();
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                if (result.landmarks && result.landmarks.length > 0) {
                    const landmarks = result.landmarks[0];
                    drawingUtils.drawLandmarks(landmarks, { radius: 3, color: '#D92A4D' });
                    drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#FFFFFF' });
                    
                    if (!finalRatioLocked) {
                        processPoseForStability(landmarks);
                    }
                }
                canvasCtx.restore();
            });
        }
        animationFrameId = window.requestAnimationFrame(predictWebcam);
    }
    
    function processPoseForStability(landmarks) {
        const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const shoulderWidth = getDistance(landmarks[11], landmarks[12]);
        const waistWidth = getDistance(landmarks[23], landmarks[24]);
        
        if (shoulderWidth > 0 && waistWidth > 0) {
            const currentRatio = shoulderWidth / waistWidth;
            ratioHistory.push(currentRatio);
            if (ratioHistory.length > SMOOTHING_WINDOW) { ratioHistory.shift(); }
            const sum = ratioHistory.reduce((a, b) => a + b, 0);
            const smoothedRatio = sum / ratioHistory.length;

            if (Math.abs(smoothedRatio - stableRatio) < STABILITY_THRESHOLD) {
                stableCounter++;
            } else {
                stableCounter = 0;
                stableRatio = smoothedRatio;
            }

            const progressPercentage = Math.min(100, (stableCounter / STABLE_FRAMES_REQUIRED) * 100);
            ratioResultsDiv.innerHTML = `<p>Current Ratio: ${stableRatio.toFixed(2)}</p>
                                         <p>Hold Still... ${Math.round(progressPercentage)}%</p>`;
            
            if (stableCounter >= STABLE_FRAMES_REQUIRED) {
                finalRatioLocked = true;
                const finalRatio = stableRatio.toFixed(2);
                localStorage.setItem('cameraRatio', finalRatio);
                localStorage.removeItem('manualMeasurements');
                console.log('Final Ratio Saved:', finalRatio);

                ratioResultsDiv.innerHTML = `<p><strong>Final Ratio Recorded:</strong></p>
                                             <p style="font-size: 1.5em; font-weight: bold;">${finalRatio}</p>
                                             <p>Check the 'Body Type' page now!</p>`;
            }
        }
    }

    function displayError(message) {
        errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }

    startCamBtn.addEventListener('click', enableWebcam);
    stopCamBtn.addEventListener('click', stopWebcam);
    resetBtn.addEventListener('click', resetMeasurement);
    
    createPoseLandmarker();
}

// --- 4. AI Chatbot Logic (IMPLEMENTED) ---
function runChatLogic() {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Function to add a new message to the chat display
    const addMessage = (text, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to the bottom
    };

    // Function to get a response from the "AI"
    const getAiResponse = (userInput) => {
        const input = userInput.toLowerCase();
        
        if (input.includes("hello") || input.includes("hi")) {
            return "Hi there! What fashion question is on your mind today?";
        }
        if (input.includes("style") || input.includes("help")) {
            return "Of course! To give you the best advice, could you tell me what occasion you're dressing for? (e.g., casual, office, party)";
        }
        if (input.includes("color") || input.includes("match")) {
            return "Color matching is key! A great rule of thumb is to pair a neutral color (like white, black, grey, or beige) with a brighter, bolder color. What colors are you thinking of?";
        }
        if (input.includes("jeans")) {
            return "Jeans are a versatile classic! For a casual look, pair them with a t-shirt and sneakers. To dress them up, try a blazer, a stylish top, and boots or heels.";
        }
        if (input.includes("formal") || input.includes("office")) {
            return "For a formal or office setting, tailored pieces are your best friend. Think blazers, trousers, pencil skirts, and button-down shirts. Neutral colors often work best.";
        }
        if (input.includes("body type")) {
            return "Understanding your body type is the first step to great style! Have you used our 'Measurement' page? The results there feed into the 'Body Type' page to give you personalized recommendations.";
        }
         if (input.includes("thank")) {
            return "You're very welcome! Is there anything else I can help you with?";
        }

        return "That's an interesting question. Could you tell me a bit more? For specific advice, I recommend checking out the 'Outfit Builder' or 'Body Type' pages!";
    };

    // Function to handle the entire user interaction
    const handleUserInput = () => {
        const userInput = chatInput.value.trim();
        if (userInput === "") return;

        addMessage(userInput, 'user');
        chatInput.value = "";

        // Simulate AI "thinking" then respond
        setTimeout(() => {
            const aiResponse = getAiResponse(userInput);
            addMessage(aiResponse, 'ai');
        }, 1000);
    };

    // Add event listeners
    sendBtn.addEventListener('click', handleUserInput);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleUserInput();
        }
    });

    // Display initial welcome message from AI
    setTimeout(() => {
        addMessage("Hello! I'm your AI Style Assistant. Ask me anything about fashion, colors, or outfit ideas!", 'ai');
    }, 500);
}


// --- 5. Wardrobe Logic (Complete and Correct) ---
// --- 5. Wardrobe Logic (Corrected) ---
function runWardrobeLogic() {
    const addItemBtn = document.getElementById('add-item-btn');
    const modal = document.getElementById('add-item-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const newItemForm = document.getElementById('new-item-form');
    const imageInput = document.getElementById('item-image');
    const imagePreview = document.getElementById('image-preview');
    const wardrobeGrid = document.getElementById('wardrobe-grid');
    const emptyPlaceholder = document.getElementById('empty-wardrobe-placeholder');
    const addFirstItemBtn = document.getElementById('add-first-item-btn'); // This might exist from a previous version, the code handles it.

    const defaultImagePlaceholder = "https://placehold.co/300x400/f0f0f0/ccc?text=Upload+Image";

    function loadWardrobeItems() {
        const items = JSON.parse(localStorage.getItem('wardrobeItems')) || [];

        if (items.length === 0) {
            // Show the placeholder message when empty
            if(emptyPlaceholder) emptyPlaceholder.style.display = 'block';
            // The line that hid the button is now removed.
        } else {
            // Hide the placeholder and show items
            if(emptyPlaceholder) emptyPlaceholder.style.display = 'none';
            
            wardrobeGrid.innerHTML = ''; // Clear the grid before adding new items
            items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'wardrobe-item';
                itemDiv.innerHTML = `<img src="${item.image}" alt="${item.name}"><div class="item-info"><h4>${item.name}</h4><p>${item.type} - ${item.color}</p></div><button class="delete-btn" data-index="${index}">&times;</button>`;
                wardrobeGrid.appendChild(itemDiv);
            });
        }
    }

    // --- All event listeners remain the same ---

    if(addItemBtn) addItemBtn.addEventListener('click', () => {
        newItemForm.reset();
        imagePreview.src = defaultImagePlaceholder;
        modal.classList.add('active');
    });

    if(addFirstItemBtn) addFirstItemBtn.addEventListener('click', () => {
        newItemForm.reset();
        imagePreview.src = defaultImagePlaceholder;
        modal.classList.add('active');
    });

    if(cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    if(modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Use the label's 'for' attribute for clicking, but keep JS for preview
    if(imageInput) imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => imagePreview.src = e.target.result;
            reader.readAsDataURL(file);
        }
    });

    if(newItemForm) newItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const items = JSON.parse(localStorage.getItem('wardrobeItems')) || [];
        const newItem = {
            name: document.getElementById('item-name').value,
            type: document.getElementById('item-type').value,
            color: document.getElementById('item-color').value,
            image: imagePreview.src
        };
        items.push(newItem);
        localStorage.setItem('wardrobeItems', JSON.stringify(items));
        
        modal.classList.remove('active');
        loadWardrobeItems();
    });

    if(wardrobeGrid) wardrobeGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.dataset.index;
            let items = JSON.parse(localStorage.getItem('wardrobeItems')) || [];
            items.splice(index, 1);
            localStorage.setItem('wardrobeItems', JSON.stringify(items));
            loadWardrobeItems();
        }
    });
    
    loadWardrobeItems();
}
// --- 6. OUTFIT BUILDER LOGIC (Corrected) ---
// --- 6. OUTFIT BUILDER LOGIC (Debugging Version) ---
function runOutfitBuilderLogic() {
    console.log("--- OUTFIT BUILDER SCRIPT STARTED ---");

    const closetItemsGrid = document.getElementById('closet-items');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const dropZones = document.querySelectorAll('.drop-zone');
    const clearOutfitBtn = document.getElementById('clear-outfit-btn');

    let allWardrobeItems = [];
    let draggedItem = null;

    function loadClosetItems(category) {
        console.log("Step 4: loadClosetItems function is running for category:", category);
        console.log("Step 5: The 'allWardrobeItems' variable contains:", allWardrobeItems);

        closetItemsGrid.innerHTML = '';
        const itemsToShow = allWardrobeItems.filter(item => item.type === category);

        console.log("Step 6: After filtering, found", itemsToShow.length, "items to show.");

        if (itemsToShow.length === 0) {
            closetItemsGrid.innerHTML = `<p style="text-align: center; color: #777; grid-column: 1 / -1;">No '${category}' items in your wardrobe.</p>`;
        } else {
            itemsToShow.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'closet-item';
                itemDiv.draggable = true;
                itemDiv.dataset.item = JSON.stringify(item);
                itemDiv.innerHTML = `<img src="${item.image}" alt="${item.name}">`;
                closetItemsGrid.appendChild(itemDiv);
            });
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log("Step 3: Tab button was clicked for category:", button.dataset.category);
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadClosetItems(button.dataset.category);
        });
    });
    
    // --- Drag and Drop Logic (No changes needed) ---
    closetItemsGrid.addEventListener('dragstart', (e) => { if (e.target.classList.contains('closet-item')) { draggedItem = e.target; setTimeout(() => e.target.classList.add('dragging'), 0); } });
    closetItemsGrid.addEventListener('dragend', (e) => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } });
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); if (!draggedItem) return; const itemData = JSON.parse(draggedItem.dataset.item); const canDrop = (itemData.type === zone.dataset.type) || (itemData.type === 'Dress' && (zone.dataset.type === 'Top' || zone.dataset.type === 'Bottoms')); if (canDrop) { zone.classList.add('drag-over'); } });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (!draggedItem) return; const itemData = JSON.parse(draggedItem.dataset.item); const dropZoneType = zone.dataset.type; const canDrop = (itemData.type === dropZoneType) || (itemData.type === 'Dress' && (dropZoneType === 'Top' || dropZoneType === 'Bottoms')); if (!canDrop) return; if (itemData.type === 'Dress') { const topZone = document.querySelector('.drop-zone[data-type="Top"]'); const bottomZone = document.querySelector('.drop-zone[data-type="Bottoms"]'); dropZones.forEach(z => { if (z.dataset.type !== 'Shoes' && z.dataset.type !== 'Accessory' && z.dataset.type !== 'Outerwear') { clearZone(z); } }); applyItemToZone(topZone, itemData); applyItemToZone(bottomZone, itemData); topZone.dataset.isDress = 'true'; } else { const topZone = document.querySelector('.drop-zone[data-type="Top"]'); if (topZone.dataset.isDress === 'true') { clearOutfit(); } applyItemToZone(zone, itemData); } });
    });
    function applyItemToZone(zone, item) { zone.style.backgroundImage = `url(${item.image})`; zone.style.backgroundSize = 'cover'; }
    function clearZone(zone) { zone.style.backgroundImage = 'none'; delete zone.dataset.isDress; }
    function clearOutfit() { dropZones.forEach(clearZone); }
    if(clearOutfitBtn) clearOutfitBtn.addEventListener('click', clearOutfit);
    // --- End of Drag and Drop Logic ---

    console.log("Step 1: The script is setting up the initial load.");
    allWardrobeItems = JSON.parse(localStorage.getItem('wardrobeItems')) || [];
    console.log("Step 2: Loaded items from localStorage. Found:", allWardrobeItems);
    
    const firstTab = document.querySelector('.tab-btn');
    if (firstTab) {
        firstTab.click();
    } else {
        closetItemsGrid.innerHTML = `<p style="text-align: center; color: #777; grid-column: 1 / -1;">Error: Tab buttons not found.</p>`;
    }
}


function runLookDetailsLogic() {
    const looksData = {
        'office-workwear': {
            title: 'Office Workwear',
            women: {
                'Featured Full Outfits': [
                    { img: 'https://images.pexels.com/photos/7959648/pexels-photo-7959648.jpeg', name: 'The Executive Set', price: '$249.99' },
                    { img: 'https://images.pexels.com/photos/7550889/pexels-photo-7550889.jpeg', name: 'Modern Professional', price: '$199.99' },
                    { img: 'https://images.pexels.com/photos/17243567/pexels-photo-17243567.jpeg', name: 'Chic Business Casual', price: '$189.00' },
                    { img: 'https://images.pexels.com/photos/3361168/pexels-photo-3361168.jpeg', name: 'The Boardroom Look', price: '$279.00' },
                    { img: 'https://images.pexels.com/photos/9834925/pexels-photo-9834925.jpeg', name: 'Power Suit Ensemble', price: '$319.99' },
                ],
                'Shop Blouses': [
                    { img: 'https://images.pexels.com/photos/16663310/pexels-photo-16663310.jpeg', name: 'Silk Button-Down', price: '$89.99' },
                    { img: 'https://images.pexels.com/photos/8452066/pexels-photo-8452066.jpeg', name: 'Ruffled Neck Top', price: '$75.00' },
                    { img: 'https://images.pexels.com/photos/15835264/pexels-photo-15835264.jpeg', name: 'Classic Poplin Shirt', price: '$69.00' },
                    { img: 'https://images.pexels.com/photos/4889343/pexels-photo-4889343.jpeg', name: 'Satin Cowl Neck Top', price: '$79.99' },
                    { img: 'https://images.pexels.com/photos/10041233/pexels-photo-10041233.jpeg', name: 'Striped Oxford Shirt', price: '$72.00' },
                ],
                'Shop Trousers & Skirts': [
                    { img: 'https://images.pexels.com/photos/13985706/pexels-photo-13985706.jpeg', name: 'High-Waisted Trousers', price: '$99.99' },
                    { img: 'https://images.pexels.com/photos/16846955/pexels-photo-16846955.jpeg', name: 'Pencil Skirt', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/8989581/pexels-photo-8989581.jpeg', name: 'Wide-Leg Crepe Pants', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/14007280/pexels-photo-14007280.jpeg', name: 'A-Line Midi Skirt', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/7273399/pexels-photo-7273399.jpeg', name: 'Slim-Fit Ankle Pants', price: '$95.00' },
                ],
            },
            men: {
                'Featured Full Outfits': [
                    { img: 'https://images.pexels.com/photos/29594234/pexels-photo-29594234.jpeg', name: 'Classic Navy Suit', price: '$349.99' },
                    { img: 'https://images.pexels.com/photos/31647491/pexels-photo-31647491.jpeg', name: 'Charcoal Grey Suit', price: '$329.99' },
                    { img: 'https://images.pexels.com/photos/15126317/pexels-photo-15126317.jpeg', name: 'Business Casual Blazer', price: '$259.00' },
                    { img: 'https://images.pexels.com/photos/34203263/pexels-photo-34203263.jpeg', name: 'Boardroom Ready', price: '$450.00' },
                    { img: 'https://images.pexels.com/photos/5745181/pexels-photo-5745181.jpeg', name: 'Modern Tech Exec', price: '$299.00' },
                ],
                'Shop Shirts': [
                    { img: 'https://images.pexels.com/photos/28710331/pexels-photo-28710331.jpeg', name: 'Crisp White Dress Shirt', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg', name: 'Light Blue Oxford', price: '$70.00' },
                    { img: 'https://images.pexels.com/photos/17035525/pexels-photo-17035525.png', name: 'Striped Poplin Shirt', price: '$72.00' },
                    { img: 'https://images.pexels.com/photos/12401748/pexels-photo-12401748.jpeg', name: 'Non-Iron Twill Shirt', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/7621074/pexels-photo-7621074.jpeg', name: 'Gingham Dress Shirt', price: '$75.00' },
                ],
                'Shop Trousers': [
                    { img: 'https://images.pexels.com/photos/6764917/pexels-photo-6764917.jpeg', name: 'Tailored Wool Trousers', price: '$120.00' },
                    { img: 'https://images.pexels.com/photos/10074957/pexels-photo-10074957.jpeg', name: 'Slim-Fit Chinos', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/8126198/pexels-photo-8126198.jpeg', name: 'Modern Khakis', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/33658685/pexels-photo-33658685.jpeg', name: 'Pleated Dress Pants', price: '$130.00' },
                    { img: 'https://images.pexels.com/photos/6817691/pexels-photo-6817691.jpeg', name: 'Performance Tech Pants', price: '$95.00' },
                ],
            }
        },
        'interview-look': {
            title: 'Interview Look',
            women: {
                'Shop Blazers': [
                    { img: 'https://placehold.co/280x350/111827/D1D5DB?text=Blazer+1', name: 'Structured Black Blazer', price: '$129.99' },
                    { img: 'https://placehold.co/280x350/1E3A8A/DBEAFE?text=Blazer+2', name: 'Classic Navy Blazer', price: '$129.99' },
                    { img: 'https://placehold.co/280x350/F9FAFB/4B5563?text=Blazer+3', name: 'Grey Tweed Blazer', price: '$140.00' },
                    { img: 'https://placehold.co/280x350/F5F3FF/5B21B6?text=Blazer+4', name: 'Single-Button Blazer', price: '$119.00' },
                    { img: 'https://placehold.co/280x350/FFF7ED/9A3412?text=Blazer+5', name: 'Camel Hair Blazer', price: '$160.00' },
                ],
                'Shop Tops': [
                    { img: 'https://placehold.co/280x350/F5F3FF/5B21B6?text=Top+1', name: 'Sleeveless Shell Top', price: '$49.99' },
                    { img: 'https://placehold.co/280x350/ECFEFF/0E7490?text=Top+2', name: 'Silk Camisole', price: '$59.00' },
                    { img: 'https://placehold.co/280x350/F0F9FF/0369A1?text=Top+3', name: 'Button-Up Blouse', price: '$69.00' },
                    { img: 'https://placehold.co/280x350/FDF2F8/8E24AA?text=Top+4', name: 'Crewneck Sweater', price: '$79.99' },
                    { img: 'https://placehold.co/280x350/FEFCE8/854D0E?text=Top+5', name: 'High-Neck Blouse', price: '$65.00' },
                ],
            },
            men: {
                'Shop Suits': [
                    { img: 'https://placehold.co/280x350/374151/9CA3AF?text=Suit+1', name: 'Charcoal Pinstripe Suit', price: '$399.99' },
                    { img: 'https://placehold.co/280x350/1E3A8A/93C5FD?text=Suit+2', name: 'Solid Navy Suit', price: '$349.99' },
                    { img: 'https://placehold.co/280x350/111827/D1D5DB?text=Suit+3', name: 'Modern Black Suit', price: '$329.00' },
                    { img: 'https://placehold.co/280x350/4A5568/CBD5E0?text=Suit+4', name: 'Light Grey Suit', price: '$369.00' },
                    { img: 'https://placehold.co/280x350/9A3412/FED7AA?text=Suit+5', name: 'Brown Tweed Suit', price: '$420.00' },
                ],
                'Shop Ties': [
                    { img: 'https://placehold.co/280x350/DCFCE7/14532D?text=Tie+1', name: 'Silk Striped Tie', price: '$45.00' },
                    { img: 'https://placehold.co/280x350/DBEAFE/1E40AF?text=Tie+2', name: 'Solid Navy Tie', price: '$40.00' },
                    { img: 'https://placehold.co/280x350/FEE2E2/991B1B?text=Tie+3', name: 'Burgundy Grenadine Tie', price: '$55.00' },
                    { img: 'https://placehold.co/280x350/E5E7EB/374151?text=Tie+4', name: 'Charcoal Knit Tie', price: '$50.00' },
                    { img: 'https://placehold.co/280x350/F5F3FF/4C1D95?text=Tie+5', name: 'Subtle Pattern Tie', price: '$48.00' },
                ],
            }
        },
        'date-night': {
            title: 'Date Night Look',
            women: {
                'Shop Dresses': [
                    { img: 'https://images.pexels.com/photos/12375730/pexels-photo-12375730.jpeg', name: 'Little Black Dress', price: '$119.99' },
                    { img: 'https://images.pexels.com/photos/18235036/pexels-photo-18235036.jpeg', name: 'Satin Slip Dress', price: '$129.00' },
                    { img: 'https://images.pexels.com/photos/31410199/pexels-photo-31410199.jpeg', name: 'Red Cocktail Dress', price: '$140.00' },
                    { img: 'https://images.pexels.com/photos/32567185/pexels-photo-32567185.jpeg', name: 'Silver White Dress', price: '$135.00' },
                    { img: 'https://images.pexels.com/photos/4773057/pexels-photo-4773057.jpeg', name: 'Lace Bodycon Dress', price: '$145.00' },
                ],
                'Shop Tops': [
                    { img: 'https://images.pexels.com/photos/7710640/pexels-photo-7710640.jpeg', name: 'Silk Cami Top', price: '$69.00' },
                    { img: 'https://images.pexels.com/photos/16456009/pexels-photo-16456009.jpeg', name: 'Lace Bodysuit', price: '$75.00' },
                    { img: 'https://images.pexels.com/photos/3081575/pexels-photo-3081575.jpeg', name: 'Off-Shoulder Top', price: '$79.99' },
                    { img: 'https://images.pexels.com/photos/5614541/pexels-photo-5614541.jpeg', name: 'Velvet Crop Top', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/18660483/pexels-photo-18660483.jpeg', name: 'One-Shoulder Blouse', price: '$82.00' }
                ],
                'Shop Bottoms': [
                    { img: 'https://images.pexels.com/photos/29793545/pexels-photo-29793545.jpeg', name: 'Faux Leather Skirt', price: '$88.00' },
                    { img: 'https://images.pexels.com/photos/4427110/pexels-photo-4427110.jpeg', name: 'Satin Midi Skirt', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/4550974/pexels-photo-4550974.jpeg', name: 'High-Waisted Trousers', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/18568806/pexels-photo-18568806.jpeg', name: 'Black loose fit Jeans', price: '$98.00' },
                    { img: 'https://images.pexels.com/photos/20662582/pexels-photo-20662582.jpeg', name: 'Sequin Mini Skirt', price: '$89.99' }
                ],
                'Shop Accessories': [
                    { img: 'https://images.pexels.com/photos/32498616/pexels-photo-32498616.jpeg', name: 'Evening Clutch', price: '$59.99' },
                    { img: 'https://images.pexels.com/photos/30662687/pexels-photo-30662687.jpeg', name: 'Strappy Gold Heels', price: '$99.00' },
                    { img: 'https://images.pexels.com/photos/13442882/pexels-photo-13442882.jpeg', name: 'Dangle Earrings', price: '$45.00' },
                    { img: 'https://images.pexels.com/photos/8105118/pexels-photo-8105118.jpeg', name: 'Delicate Necklace', price: '$55.00' },
                    { img: 'https://images.pexels.com/photos/29485132/pexels-photo-29485132.jpeg', name: 'Silver Bangle', price: '$65.00' },
                ]
            },
            men: {
                'Shop Jackets': [
                    { img: 'https://images.pexels.com/photos/826380/pexels-photo-826380.jpeg', name: 'Leather Jacket', price: '$199.99' },
                    { img: 'https://images.pexels.com/photos/10392141/pexels-photo-10392141.jpeg', name: 'Suede Bomber Jacket', price: '$180.00' },
                    { img: 'https://images.pexels.com/photos/6255005/pexels-photo-6255005.jpeg', name: 'Navy Sport Coat', price: '$160.00' },
                    { img: 'https://images.pexels.com/photos/19141892/pexels-photo-19141892.jpeg', name: 'Charcoal Topcoat', price: '$220.00' },
                    { img: 'https://images.pexels.com/photos/16789152/pexels-photo-16789152.jpeg', name: 'Olive Green Harrington', price: '$140.00' },
                ],
                'Shop Shirts': [
                    { img: 'https://images.pexels.com/photos/8979945/pexels-photo-8979945.jpeg', name: 'Fitted Henley Shirt', price: '$55.00' },
                    { img: 'https://images.pexels.com/photos/7533320/pexels-photo-7533320.jpeg', name: 'Black Dress Shirt', price: '$70.00' },
                    { img: 'https://images.pexels.com/photos/5145182/pexels-photo-5145182.jpeg', name: 'Linen Button-Up', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/15397576/pexels-photo-15397576.jpeg', name: 'Burgundy Polo', price: '$60.00' },
                    { img: 'https://images.pexels.com/photos/1889772/pexels-photo-1889772.jpeg', name: 'Dark Floral Print Shirt', price: '$75.00' },
                ],
                'Shop Pants & Jeans': [
                    { img: 'https://images.pexels.com/photos/5254036/pexels-photo-5254036.jpeg', name: 'Slim-Fit Dark Wash Jeans', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/9929648/pexels-photo-9929648.jpeg', name: 'Chinos', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/6311478/pexels-photo-6311478.jpeg', name: 'Wool Trousers', price: '$140.00' },
                    { img: 'https://images.pexels.com/photos/6150583/pexels-photo-6150583.jpeg', name: 'Olive Green Trousers', price: '$105.00' },
                    { img: 'https://images.pexels.com/photos/24222635/pexels-photo-24222635.jpeg', name: 'Modern Fit Grey Jeans', price: '$115.00' }
                ]
            }
        },
        'casual-day-out': {
            title: 'Casual Day Out',
            women: {
                'Shop Jeans': [
                    { img: 'https://images.pexels.com/photos/34234048/pexels-photo-34234048.jpeg', name: 'Boyfriend Jeans', price: '$89.00' },
                    { img: 'https://images.pexels.com/photos/2027132/pexels-photo-2027132.jpeg', name: 'High-Rise Skinny Jeans', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/11567026/pexels-photo-11567026.jpeg', name: 'Black Mom Jeans', price: '$92.00' },
                    { img: 'https://images.pexels.com/photos/7588406/pexels-photo-7588406.jpeg', name: 'Distressed Straight-Leg', price: '$99.00' },
                    { img: 'https://images.pexels.com/photos/7880060/pexels-photo-7880060.jpeg', name: 'White Cropped Jeans', price: '$85.00' },
                ],
                'Shop T-Shirts': [
                    { img: 'https://images.pexels.com/photos/4746812/pexels-photo-4746812.png', name: 'Vintage Graphic Tee', price: '$35.00' },
                    { img: 'https://images.pexels.com/photos/29674146/pexels-photo-29674146.jpeg', name: 'Striped Breton Top', price: '$40.00' },
                    { img: 'https://images.pexels.com/photos/7681188/pexels-photo-7681188.jpeg', name: 'Basic V-Neck Tee', price: '$25.00' },
                    { img: 'https://images.pexels.com/photos/14984388/pexels-photo-14984388.jpeg', name: 'Oversized Pocket Tee', price: '$38.00' },
                    { img: 'https://images.pexels.com/photos/6996131/pexels-photo-6996131.jpeg', name: 'Linen Blend Tee', price: '$42.00' },
                ],
            },
            men: {
                'Shop Hoodies': [
                    { img: 'https://images.pexels.com/photos/6311393/pexels-photo-6311393.jpeg', name: 'Fleece Pullover Hoodie', price: '$79.99' },
                    { img: 'https://images.pexels.com/photos/20536778/pexels-photo-20536778.jpeg', name: 'Zip-Up Hoodie', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/7496130/pexels-photo-7496130.jpeg', name: 'Waffle-Knit Hoodie', price: '$75.00' },
                    { img: 'https://images.pexels.com/photos/24602318/pexels-photo-24602318.jpeg', name: 'Graphic Print Hoodie', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/4064839/pexels-photo-4064839.jpeg', name: 'Tech Fleece Hoodie', price: '$95.00' },
                ],
                'Shop T-Shirts & Shirts': [
                    { img: 'https://images.pexels.com/photos/14681186/pexels-photo-14681186.jpeg', name: 'Classic Crewneck T-Shirt', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/8106264/pexels-photo-8106264.jpeg', name: 'Striped Henley Shirt', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/7671168/pexels-photo-7671168.jpeg', name: 'Cotton Polo Shirt', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/6995732/pexels-photo-6995732.jpeg', name: 'Plaid Flannel Shirt', price: '$100.00' },
                    { img: 'https://images.pexels.com/photos/17251247/pexels-photo-17251247.jpeg', name: 'Short-Sleeve Button-Down', price: '$70.00' },
                ],
            }
        },
        'streetwear-look': {
            title: 'Streetwear Look',
            women: {
                'Shop Outerwear': [
                    { img: 'https://images.pexels.com/photos/19269903/pexels-photo-19269903.jpeg', name: 'Oversized Bomber Jacket', price: '$130.00' },
                    { img: 'https://images.pexels.com/photos/28174872/pexels-photo-28174872.jpeg', name: 'Cropped Denim Jacket', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/10664795/pexels-photo-10664795.jpeg', name: 'Windbreaker', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/24713021/pexels-photo-24713021.jpeg', name: 'Leather Biker Jacket', price: '$200.00' },
                    { img: 'https://images.pexels.com/photos/9210386/pexels-photo-9210386.jpeg', name: 'Plaid Shacket', price: '$95.00' },
                ],
                'Shop Bottoms': [
                    { img: 'https://images.pexels.com/photos/18459166/pexels-photo-18459166.jpeg', name: 'Cargo Pants', price: '$75.00' },
                    { img: 'https://images.pexels.com/photos/17417553/pexels-photo-17417553.jpeg', name: 'Baggy Jeans', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/4611657/pexels-photo-4611657.jpeg', name: 'Sweatpants', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/17065316/pexels-photo-17065316.jpeg', name: 'Parachute Pants', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/34233683/pexels-photo-34233683.jpeg', name: 'Utility Skirt', price: '$70.00' },
                ],
            },
            men: {
                'Shop Jackets': [
                    { img: 'https://images.pexels.com/photos/30158553/pexels-photo-30158553.jpeg', name: 'Denim Trucker Jacket', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/16557378/pexels-photo-16557378.jpeg', name: 'Coach Jacket', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/19248856/pexels-photo-19248856.jpeg', name: 'Varsity Jacket', price: '$150.00' },
                    { img: 'https://placehold.co/280x350/EFF6FF/1E40AF?text=Anorak', name: 'Anorak', price: '$100.00' },
                    { img: 'https://images.pexels.com/photos/21820215/pexels-photo-21820215.jpeg', name: 'Workwear Jacket', price: '$120.00' },
                ],
                'Shop Headwear': [
                    { img: 'https://images.pexels.com/photos/6831104/pexels-photo-6831104.jpeg', name: 'Fisherman Beanie', price: '$25.00' },
                    { img: 'https://images.pexels.com/photos/3266358/pexels-photo-3266358.jpeg', name: 'Baseball Cap', price: '$30.00' },
                    { img: 'https://images.pexels.com/photos/27844049/pexels-photo-27844049.jpeg', name: 'Snapback', price: '$35.00' },
                    { img: 'https://images.pexels.com/photos/2537658/pexels-photo-2537658.jpeg', name: 'Bucket Hat', price: '$32.00' },
                    { img: 'https://images.pexels.com/photos/5588381/pexels-photo-5588381.jpeg', name: 'Cuffed Beanie', price: '$28.00' },
                ],
                'Shop Jeans': [
                    { img: 'https://images.pexels.com/photos/34234048/pexels-photo-34234048.jpeg', name: 'Boyfriend Jeans', price: '$89.00' },
                    { img: 'https://images.pexels.com/photos/2027132/pexels-photo-2027132.jpeg', name: 'High-Rise Skinny Jeans', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/11567026/pexels-photo-11567026.jpeg', name: 'Black Mom Jeans', price: '$92.00' },
                    { img: 'https://images.pexels.com/photos/7588406/pexels-photo-7588406.jpeg', name: 'Distressed Straight-Leg', price: '$99.00' },
                    { img: 'https://images.pexels.com/photos/7880060/pexels-photo-7880060.jpeg', name: 'White Cropped Jeans', price: '$85.00' },
                ],
            }
        },
        'summer-look': {
            title: 'Summer Look',
            women: {
                'Shop Dresses': [
                    { img: 'https://images.pexels.com/photos/4995690/pexels-photo-4995690.jpeg', name: 'Floral Maxi Dress', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/11117981/pexels-photo-11117981.jpeg', name: 'Linen Sundress', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/7647299/pexels-photo-7647299.jpeg', name: 'Gingham Mini Dress', price: '$75.00' },
                    { img: 'https://images.pexels.com/photos/9214359/pexels-photo-9214359.jpeg', name: 'White Eyelet Dress', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/17153151/pexels-photo-17153151.jpeg', name: 'Wrap Dress', price: '$90.00' },
                ],
                'Shop Sandals': [
                    { img: 'https://images.pexels.com/photos/31450993/pexels-photo-31450993.jpeg', name: 'Leather Sandals', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/26925257/pexels-photo-26925257.jpeg', name: 'Espadrille Wedges', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/31083755/pexels-photo-31083755.jpeg', name: 'Oversized Sunglasses', price: '$50.00' },
                    { img: 'https://images.pexels.com/photos/6711855/pexels-photo-6711855.jpeg', name: 'Shell Anklet', price: '$70.00' },
                    { img: 'https://images.pexels.com/photos/18085377/pexels-photo-18085377.jpeg', name: 'Canvas Tote Bag', price: '$75.00' },
                ],
                'Shop Tops': [
                    { img: 'https://images.pexels.com/photos/7623519/pexels-photo-7623519.jpeg', name: 'Linen Crop Top', price: '$45.00' },
                    { img: 'https://images.pexels.com/photos/5885449/pexels-photo-5885449.jpeg', name: 'Ribbed Tank Top', price: '$29.00' },
                    { img: 'https://images.pexels.com/photos/19330216/pexels-photo-19330216.jpeg', name: 'Halter Neck Top', price: '$49.99' },
                    { img: 'https://images.pexels.com/photos/33198226/pexels-photo-33198226.jpeg', name: 'Flowy Camisole', price: '$42.00' },
                    { img: 'https://images.pexels.com/photos/4821352/pexels-photo-4821352.jpeg', name: 'Smocked Tube Top', price: '$35.00' }
                ],
            },
            men: {
                'Shop Shorts': [
                    { img: 'https://images.pexels.com/photos/18153495/pexels-photo-18153495.jpeg', name: 'Linen Shorts', price: '$50.00' },
                    { img: 'https://images.pexels.com/photos/29205117/pexels-photo-29205117.jpeg', name: 'Chino Shorts', price: '$45.00' },
                    { img: 'https://images.pexels.com/photos/24346109/pexels-photo-24346109.jpeg', name: 'Cargo Shorts', price: '$55.00' },
                    { img: 'https://images.pexels.com/photos/18139574/pexels-photo-18139574.jpeg', name: 'Denim Shorts', price: '$60.00' },
                    { img: 'https://images.pexels.com/photos/8553789/pexels-photo-8553789.jpeg', name: 'Hybrid Tech Shorts', price: '$65.00' },
                ],
                'Shop Shirts': [
                    { img: 'https://images.pexels.com/photos/24871909/pexels-photo-24871909.jpeg', name: 'Camp Collar Shirt', price: '$60.00' },
                    { img: 'https://images.pexels.com/photos/10554488/pexels-photo-10554488.jpeg', name: 'Linen Button-Down', price: '$70.00' },
                    { img: 'https://images.pexels.com/photos/3777556/pexels-photo-3777556.jpeg', name: 'Polo Shirt', price: '$55.00' },
                    { img: 'https://images.pexels.com/photos/32189330/pexels-photo-32189330.png', name: 'Short-Sleeve Henley', price: '$45.00' },
                    { img: 'https://images.pexels.com/photos/7902271/pexels-photo-7902271.jpeg', name: 'Floral Print Shirt', price: '$65.00' },
                ],
            }
        },
        'beach-look': {
            title: 'Beach Look',
            women: {
                'Shop Swimwear': [
                    { img: 'https://images.pexels.com/photos/8158561/pexels-photo-8158561.jpeg', name: 'High-Waisted Bikini', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/6129562/pexels-photo-6129562.jpeg', name: 'Classic One-Piece', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/34212106/pexels-photo-34212106.jpeg', name: 'Triangle Bikini', price: '$75.00' },
                    { img: 'https://images.pexels.com/photos/4043677/pexels-photo-4043677.jpeg', name: 'Bandeau Top Bikini', price: '$80.00' },
                    { img: 'https://images.pexels.com/photos/19122322/pexels-photo-19122322.jpeg', name: 'Cut-Out One-Piece', price: '$95.00' },
                ],
                'Shop Cover-ups': [
                    { img: 'https://images.pexels.com/photos/5807050/pexels-photo-5807050.jpeg', name: 'Knit Cover-up', price: '$55.00' },
                    { img: 'https://images.pexels.com/photos/27917740/pexels-photo-27917740.jpeg', name: 'Sarong', price: '$35.00' },
                    { img: 'https://images.pexels.com/photos/3021600/pexels-photo-3021600.jpeg', name: 'Linen Shirt', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/32313811/pexels-photo-32313811.jpeg', name: 'Crochet Dress', price: '$70.00' },
                    { img: 'https://images.pexels.com/photos/6192591/pexels-photo-6192591.jpeg', name: 'Kaftan', price: '$60.00' },
                ],
            },
            men: {
                'Shop Swim Trunks': [
                    { img: 'https://images.pexels.com/photos/9964469/pexels-photo-9964469.jpeg', name: 'Patterned Swim Trunks', price: '$45.00' },
                    { img: 'https://images.pexels.com/photos/28168685/pexels-photo-28168685.jpeg', name: 'Solid Color Trunks', price: '$40.00' },
                    { img: 'https://images.pexels.com/photos/21796437/pexels-photo-21796437.jpeg', name: 'Short-Length Trunks', price: '$50.00' },
                    { img: 'https://images.pexels.com/photos/11697747/pexels-photo-11697747.jpeg', name: 'Volley Shorts', price: '$48.00' },
                    { img: 'https://images.pexels.com/photos/2456029/pexels-photo-2456029.jpeg', name: 'Striped Trunks', price: '$46.00' },
                ],
            }
        },
        'winter-look': {
            title: 'Winter Look',
            women: {
                'Shop Coats': [
                    { img: 'https://images.pexels.com/photos/31529647/pexels-photo-31529647.jpeg', name: 'Wool Overcoat', price: '$250.00' },
                    { img: 'https://images.pexels.com/photos/16121138/pexels-photo-16121138.jpeg', name: 'Down Puffer Coat', price: '$220.00' },
                    { img: 'https://images.pexels.com/photos/31559010/pexels-photo-31559010.jpeg', name: 'Trench Coat', price: '$180.00' },
                    { img: 'https://images.pexels.com/photos/34189321/pexels-photo-34189321.jpeg', name: 'Faux Fur Coat', price: '$190.00' },
                    { img: 'https://images.pexels.com/photos/13431104/pexels-photo-13431104.jpeg', name: 'Shearling Jacket', price: '$280.00' },
                ],
                'Shop Boots': [
                    { img: 'https://images.pexels.com/photos/27204273/pexels-photo-27204273.jpeg', name: 'Leather Ankle Boots', price: '$150.00' },
                    { img: 'https://images.pexels.com/photos/28302556/pexels-photo-28302556.jpeg', name: 'Knee-High Boots', price: '$180.00' },
                    { img: 'https://images.pexels.com/photos/26732212/pexels-photo-26732212.jpeg', name: 'Combat Boots', price: '$160.00' },
                    { img: 'https://images.pexels.com/photos/7026415/pexels-photo-7026415.jpeg', name: 'Winter Snow Boots', price: '$130.00' },
                    { img: 'https://images.pexels.com/photos/16234319/pexels-photo-16234319.jpeg', name: 'Chelsea Boots', price: '$140.00' },
                ],
            },
            men: {
                'Shop Jackets': [
                    { img: 'https://images.pexels.com/photos/16430970/pexels-photo-16430970.jpeg', name: 'Down Puffer Jacket', price: '$220.00' },
                    { img: 'https://images.pexels.com/photos/19987354/pexels-photo-19987354.jpeg', name: 'Wool Peacoat', price: '$260.00' },
                    { img: 'https://images.pexels.com/photos/15061323/pexels-photo-15061323.jpeg', name: 'Parka with Hood', price: '$280.00' },
                    { img: 'https://images.pexels.com/photos/17045118/pexels-photo-17045118.jpeg', name: 'Shearling Jacket', price: '$350.00' },
                    { img: 'https://images.pexels.com/photos/21820213/pexels-photo-21820213.jpeg', name: 'Technical Shell Jacket', price: '$190.00' },
                ],
                'Shop Sweaters': [
                    { img: 'https://images.pexels.com/photos/14903440/pexels-photo-14903440.jpeg', name: 'Cashmere Sweater', price: '$180.00' },
                    { img: 'https://images.pexels.com/photos/8527552/pexels-photo-8527552.jpeg', name: 'Turtleneck Sweater', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/16228066/pexels-photo-16228066.jpeg', name: 'Cable-Knit Sweater', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/5018220/pexels-photo-5018220.jpeg', name: 'Merino Wool V-Neck', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/5588381/pexels-photo-5588381.jpeg', name: 'Fair Isle Sweater', price: '$120.00' },
                ],
            }
        },
        'wedding-look': {
            title: 'Wedding Look',
            women: {
                'Shop Guest Dresses': [
                    { img: 'https://images.pexels.com/photos/14840266/pexels-photo-14840266.jpeg', name: 'Cocktail Dress', price: '$160.00' },
                    { img: 'https://images.pexels.com/photos/20448164/pexels-photo-20448164.jpeg', name: 'Floral Midi Dress', price: '$140.00' },
                    { img: 'https://images.pexels.com/photos/28697710/pexels-photo-28697710.jpeg', name: 'Formal Gown', price: '$250.00' },
                    { img: 'https://images.pexels.com/photos/13722335/pexels-photo-13722335.jpeg', name: 'Jumpsuit', price: '$150.00' },
                    { img: 'https://images.pexels.com/photos/18457831/pexels-photo-18457831.jpeg', name: 'Satin Maxi Dress', price: '$180.00' },
                ],
                'Shop Shoes & Purses': [
                    { img: 'https://images.pexels.com/photos/8788696/pexels-photo-8788696.jpeg', name: 'Strappy Heeled Sandals', price: '$120.00' },
                    { img: 'https://images.pexels.com/photos/4627902/pexels-photo-4627902.jpeg', name: 'Embellished Box Clutch', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/8134257/pexels-photo-8134257.jpeg', name: 'Classic Pumps', price: '$130.00' },
                    { img: 'https://images.pexels.com/photos/19976270/pexels-photo-19976270.jpeg', name: 'Satin Evening Bag', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/27113458/pexels-photo-27113458.jpeg', name: 'Block Heel Sandals', price: '$110.00' }
                ],
                'Shop Jewellery': [
                    { img: 'https://images.pexels.com/photos/11744651/pexels-photo-11744651.jpeg', name: 'Pearl Drop Earrings', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/8100402/pexels-photo-8100402.jpeg', name: 'Delicate Tennis Bracelet', price: '$150.00' },
                    { img: 'https://images.pexels.com/photos/17298688/pexels-photo-17298688.jpeg', name: 'Statement Necklace', price: '$125.00' },
                    
                    { img: 'https://images.pexels.com/photos/25403216/pexels-photo-25403216.jpeg', name: 'Diamond Studs', price: '$200.00' }
                ]
            },
            men: {
                'Shop Formalwear': [
                    { img: 'https://images.pexels.com/photos/15171956/pexels-photo-15171956.jpeg', name: 'Tuxedo', price: '$450.00' },
                    { img: 'https://images.pexels.com/photos/177328/pexels-photo-177328.jpeg', name: 'Black Tie Suit', price: '$400.00' },
                    { img: 'https://images.pexels.com/photos/6276009/pexels-photo-6276009.jpeg', name: 'Blue Dinner Jacket', price: '$350.00' },
                    { img: 'https://images.pexels.com/photos/18031036/pexels-photo-18031036.jpeg', name: 'Linen Suit', price: '$300.00' },
                    { img: 'https://images.pexels.com/photos/12427630/pexels-photo-12427630.jpeg', name: 'Velvet Blazer', price: '$280.00' },
                ],
                'Shop Shoes & Jewellery': [
                    { img: 'https://images.pexels.com/photos/2057484/pexels-photo-2057484.jpeg', name: 'Patent Leather Dress Shoes', price: '$220.00' },
                    { img: 'https://images.pexels.com/photos/32862208/pexels-photo-32862208.jpeg', name: 'Mother of Pearl Cufflinks', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/186037/pexels-photo-186037.jpeg', name: 'Classic Oxford Shoes', price: '$250.00' },
                    { img: 'https://images.pexels.com/photos/10284011/pexels-photo-10284011.jpeg', name: 'Silver Tie Bar', price: '$45.00' },
                    { img: 'https://images.pexels.com/photos/30474416/pexels-photo-30474416.jpeg', name: ' Loafers', price: '$190.00' }
                ],
                'Shop Formal Accessories': [
                    { img: 'https://images.pexels.com/photos/5264925/pexels-photo-5264925.jpeg', name: 'Silk Bow Tie', price: '$60.00' },
                    { img: 'https://images.pexels.com/photos/29998296/pexels-photo-29998296.jpeg', name: 'Linen Pocket Square', price: '$35.00' },
                    { img: 'https://images.pexels.com/photos/28383342/pexels-photo-28383342.jpeg', name: 'Classic Dress Watch', price: '$350.00' },
                    { img: 'https://images.pexels.com/photos/9404774/pexels-photo-9404774.jpeg', name: 'Patterned Silk Tie', price: '$65.00' },
                    { img: 'https://images.pexels.com/photos/5023640/pexels-photo-5023640.jpeg', name: 'Leather Dress Belt', price: '$80.00' }
                ]
            }
        },
        'travel-look': {
            title: 'Travel Look',
            women: {
                'Shop Loungewear': [
                    { img: 'https://images.pexels.com/photos/4993241/pexels-photo-4993241.jpeg', name: 'Comfort Travel Set', price: '$120.00' },
                    { img: 'https://images.pexels.com/photos/29723757/pexels-photo-29723757.jpeg', name: 'Cashmere Jogger Set', price: '$250.00' },
                    { img: 'https://images.pexels.com/photos/6968340/pexels-photo-6968340.jpeg', name: 'Knit Sweater and Pants', price: '$140.00' },
                    { img: 'https://images.pexels.com/photos/9185779/pexels-photo-9185779.jpeg', name: 'Waffle Knit Set', price: '$110.00' },
                    { img: 'https://images.pexels.com/photos/20376361/pexels-photo-20376361.jpeg', name: 'French Terry Set', price: '$130.00' },
                ],
            },
            men: {
                'Shop Joggers': [
                    { img: 'https://images.pexels.com/photos/9775553/pexels-photo-9775553.jpeg', name: 'Tech Fabric Joggers', price: '$85.00' },
                    { img: 'https://images.pexels.com/photos/3754243/pexels-photo-3754243.jpeg', name: 'Fleece Joggers', price: '$70.00' },
                    { img: 'https://images.pexels.com/photos/5319313/pexels-photo-5319313.jpeg', name: 'Cargo Joggers', price: '$90.00' },
                    { img: 'https://images.pexels.com/photos/17720437/pexels-photo-17720437.jpeg', name: 'Woven Travel Pants', price: '$95.00' },
                    { img: 'https://images.pexels.com/photos/15759623/pexels-photo-15759623.jpeg', name: 'Merino Wool Joggers', price: '$120.00' },
                ],
            }
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const lookId = urlParams.get('look');

    const lookTitleEl = document.getElementById('look-title');
    const contentContainer = document.getElementById('look-content-container');
    const womensBtn = document.getElementById('womens-btn');
    const mensBtn = document.getElementById('mens-btn');

    if (!lookId || !looksData[lookId]) {
        contentContainer.innerHTML = `<p>Look not found. Please go back to the home page.</p>`;
        return;
    }

    function renderLook(collection = 'women') {
        const currentLook = looksData[lookId];
        const collectionData = currentLook[collection];
        
        lookTitleEl.textContent = currentLook.title;
        contentContainer.innerHTML = '';

        if (!collectionData || Object.keys(collectionData).length === 0) {
            contentContainer.innerHTML = `<p>No items found for this collection.</p>`;
            return;
        }

        for (const categoryTitle in collectionData) {
            const products = collectionData[categoryTitle];

            const section = document.createElement('div');
            section.className = 'product-section';

            const title = document.createElement('h3');
            title.textContent = categoryTitle;
            section.appendChild(title);

            const carousel = document.createElement('div');
            carousel.className = 'product-carousel';

            // This is the NEW code
            products.forEach(product => {
                const cardLink = document.createElement('a');
                cardLink.className = 'product-card'; // Keep the same class for styling
                cardLink.href = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(product.name)}`;
                cardLink.target = "_blank"; // This opens the link in a new tab
                cardLink.rel = "noopener noreferrer"; // Security best practice

                cardLink.innerHTML = `
                    <img src="${product.img}" alt="${product.name}">
                    <div class="product-card-info">
                        <h4>${product.name}</h4>
                    </div>
              `;
                carousel.appendChild(cardLink);
        }); 
            

        section.appendChild(carousel);
        contentContainer.appendChild(section);
    }
}

    womensBtn.addEventListener('click', () => {
        mensBtn.classList.remove('active');
        womensBtn.classList.add('active');
        renderLook('women');
    });

    mensBtn.addEventListener('click', () => {
        womensBtn.classList.remove('active');
        mensBtn.classList.add('active');
        renderLook('men');
    });

    renderLook('women');
}