// This file assumes 'PoseLandmarker' is available via the CDN script tag in measurement.html
import { PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js';

const videoElement = document.getElementById('webcam-video');
const canvasElement = document.getElementById('scan-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startScanBtn = document.getElementById('start-scan-btn');
const instructionOverlay = document.getElementById('instruction-overlay');
const scanFeedback = document.getElementById('scan-feedback');
const captureFrontBtn = document.getElementById('capture-front-btn');
const bodyTypeResult = document.getElementById('body-type-result');
const finalBodyType = document.getElementById('final-body-type');
const scanDetails = document.getElementById('scan-details');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendBtn = document.getElementById('chatbot-send-btn');
const chatbotMessages = document.getElementById('chatbot-messages');

let poseLandmarker = undefined;
let runningMode = "VIDEO";
let measurementData = {};

/**
 * AI/CV Functions
 */
const initializeLandmarker = async () => {
    scanFeedback.innerHTML = '<p>Status: Loading AI model...</p>';
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        poseLandmarker = await PoseLandmarker.create(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                delegate: "GPU"
            },
            runningMode: runningMode,
            numPoses: 1,
        });
        scanFeedback.innerHTML = '<p style="color: green;">Status: Pose estimation model loaded. Ready!</p>';
        startScanBtn.disabled = false;
    } catch (e) {
        scanFeedback.innerHTML = `<p style="color: red;">Error loading model: ${e}.</p>`;
    }
};

const startWebcam = async () => {
    instructionOverlay.style.opacity = '0';
    instructionOverlay.style.pointerEvents = 'none';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        videoElement.addEventListener('loadeddata', () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            window.requestAnimationFrame(detectPoseLoop); 
            captureFrontBtn.disabled = false;
            scanFeedback.innerHTML = '<p>Status: Camera active. Please align your body.</p>';
        });

    } catch (error) {
        scanFeedback.innerHTML = `<p style="color: red;">Error accessing camera: ${error.name}.</p>`;
        console.error("Camera access denied or failed:", error);
        instructionOverlay.style.opacity = '1';
        instructionOverlay.style.pointerEvents = 'auto';
    }
};

let lastVideoTime = -1;
const detectPoseLoop = () => {
    if (!poseLandmarker || videoElement.paused || videoElement.ended) return;

    let startTimeMs = performance.now();
    
    if (videoElement.currentTime !== lastVideoTime) {
        const results = poseLandmarker.detectForVideo(videoElement, startTimeMs);
        lastVideoTime = videoElement.currentTime;
        drawLandmarks(results);
    }
    window.requestAnimationFrame(detectPoseLoop);
}

const drawLandmarks = (results) => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        // Simple indicator: Draw the nose landmark
        const nose = results.landmarks[0][0]; 
        if (nose) {
            const x = nose.x * canvasElement.width;
            const y = nose.y * canvasElement.height;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'red';
            canvasCtx.fill();
        }
    }
}

const simulateMeasurementCapture = () => {
    // In a real app, this function would take landmark data and convert it 
    // to real-world measurements (chest, waist, hip, etc.).

    // Simulation: Assign random but realistic measurements
    measurementData = {
        chest: Math.floor(Math.random() * (100 - 80 + 1) + 80), 
        waist: Math.floor(Math.random() * (85 - 65 + 1) + 65),
        hips: Math.floor(Math.random() * (110 - 90 + 1) + 90),
    };
    
    // Simulate body type logic (simple ratio-based)
    const ratio = measurementData.waist / measurementData.hips;
    let bodyType;

    if (ratio < 0.7) {
        bodyType = "Hourglass";
    } else if (measurementData.chest > measurementData.hips) {
        bodyType = "Inverted Triangle";
    } else if (measurementData.hips > measurementData.chest * 1.05) {
        bodyType = "Pear";
    } else {
        bodyType = "Rectangle";
    }
    
    displayBodyType(bodyType, measurementData);
};

const displayBodyType = (type, measurements) => {
    // Hide scan UI and show results
    document.getElementById('scan-page-title').textContent = "Body Profile Saved!";
    scanDetails.classList.add('hidden');
    bodyTypeResult.classList.remove('hidden');
    finalBodyType.textContent = type;

    // Stop video stream (important for privacy and performance)
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
    }

    // You would typically save this data to a backend here:
    console.log("Measurements Captured:", measurements);
};

/**
 * Chatbot Functions
 */
const handleChatbotSend = () => {
    const userMessage = chatbotInput.value.trim();
    if (userMessage === '') return;

    // Display user message
    chatbotMessages.innerHTML += `<p style="text-align: right; color: #5C67E3;">You: ${userMessage}</p>`;
    chatbotInput.value = '';
    
    // Simple AI response simulation
    setTimeout(() => {
        let response;
        const bodyType = finalBodyType.textContent;

        if (userMessage.toLowerCase().includes('body type')) {
            response = `Your last estimated body type is **${bodyType}**. I can recommend styles to flatter this shape!`;
        } else if (userMessage.toLowerCase().includes('lighting')) {
            response = "Ensure you have bright, even lighting and avoid shadows or backlighting for the most accurate scan.";
        } else if (userMessage.toLowerCase().includes('help')) {
            response = "I guide the scan! If you have trouble, make sure you are wearing tight-fitting clothes and stand 2 meters from the camera.";
        } else {
            response = "I'm the Measurement Guide! I can help with scanning issues or tell you your estimated body type if the scan is complete.";
        }
        
        chatbotMessages.innerHTML += `<p style="text-align: left; color: #333;">Chatbot: ${response}</p>`;
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }, 1000);
};

// --- Event Listeners ---
startScanBtn.addEventListener('click', startWebcam);

captureFrontBtn.addEventListener('click', () => {
    scanFeedback.innerHTML = '<p>Status: Front view captured. Please turn to the **side view**.</p>';
    captureFrontBtn.textContent = 'Capture Side View';
    
    // On the second click, complete the process
    if (captureFrontBtn.dataset.step === 'side') {
        scanFeedback.innerHTML = '<p>Status: Processing measurements... This may take a moment.</p>';
        captureFrontBtn.disabled = true;

        setTimeout(() => {
            simulateMeasurementCapture();
        }, 3000);
    } else {
        captureFrontBtn.dataset.step = 'side';
    }
});

chatbotSendBtn.addEventListener('click', handleChatbotSend);
chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleChatbotSend();
    }
});

// Initial load
initializeLandmarker();