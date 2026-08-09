/* ==========================================================================
   MEDIEASE — Core JavaScript Engine
   Gemini API Vision, LocalStorage Engine, Speech Assistant & Senior Accessibility
   ========================================================================== */

// ==========================================
// GEMINI API KEY CONFIGURATION
// Paste your Google AI Studio API key here (starts with "AIzaSy").
// Get one at https://aistudio.google.com/apikey
// ONLY for local/hackathon testing — do not ship a hardcoded key to production.
// If left blank, MediEase automatically runs in Local Fallback Mode
// (manual entry UI, no AI extraction).
// ==========================================


const GEMINI_API_KEY = "GEMINI_API_KEY";
const GEMINI_MODEL = "gemini-3.6-flash";

// Global Application State Object
const AppState = {
    currentImageBase64: null,
    currentImageDataURL: null,
    currentFileName: "",
    currentFileSize: "",
    extractedData: null,
    activeSchedule: null,
    history: [],
    usingFallback: false,
    settings: {
        seniorMode: false,
        highContrast: false,
        largeText: false
    }
};

/* ==========================================================================
   1. DOM ELEMENTS & INITIALIZATION
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initAccessibilityControls();
    initScanner();
    initReviewForm();
    initScheduleActions();
    initVoiceAssistant();
    loadStoredData();
    updateUI();
});


function isApiKeyValid() {
    if (typeof GEMINI_API_KEY !== "string") return false;
    const key = GEMINI_API_KEY.trim();
    if (!key) return false;
    if (/^AIzaSy[\w-]{33}$/.test(key)) return true;   // legacy Standard key
    if (/^AQ\.[\w.-]{20,}$/.test(key)) return true;    // current Auth key
    return false;
}

/* Navigation Router */
function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const navContainer = document.getElementById("navLinks");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetView = link.getAttribute("data-view");
            switchView(targetView);

            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            if (navContainer && navContainer.classList.contains("open")) {
                navContainer.classList.remove("open");
            }
        });
    });

    mobileMenuBtn?.addEventListener("click", () => {
        navContainer?.classList.toggle("open");
    });

    document.getElementById("heroScanBtn")?.addEventListener("click", () => switchView("view-scan"));
    document.getElementById("navScanBtn")?.addEventListener("click", () => switchView("view-scan"));
    document.getElementById("logoBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("view-home");
    });
}

function switchView(viewId) {
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    const activeSection = document.getElementById(viewId);
    if (activeSection) {
        activeSection.classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

/* ==========================================================================
   2. GEMINI VISION API INTEGRATION
   ========================================================================== */

async function analyzePrescriptionWithGemini(imageDataURL) {
    if (!isApiKeyValid()) {
        throw new Error("No valid Gemini API key configured.");
    }

    // Extract raw Base64 string and mime type from Data URL
    const mimeTypeMatch = imageDataURL.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
    const base64Data = imageDataURL.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    const systemPrompt = `You are an AI prescription transcription and organization assistant.
Analyze the provided prescription image.
Extract ONLY information that is visibly supported by the prescription.

Extract:
- patient name if visible
- doctor name if visible
- prescription date if visible
- medicine name
- medicine form
- dosage
- quantity
- frequency
- timing
- before/after food instructions
- duration
- special instructions

IMPORTANT SAFETY RULES:
1. Never guess a medicine name.
2. Never guess a dosage.
3. Never guess frequency.
4. Never guess duration.
5. Never change the doctor's instructions.
6. Never diagnose the patient.
7. Never recommend a medicine.
8. If handwriting is unclear, return null for that field.
9. Add unclear fields to uncertainFields list.
10. Preserve original instruction when readable.

Return ONLY valid JSON format adhering to this structure:
{
    "patientName": string or null,
    "doctorName": string or null,
    "prescriptionDate": string or null,
    "medicines": [
        {
            "name": string or null,
            "form": string or null,
            "dosage": string or null,
            "quantity": string or null,
            "frequency": string or null,
            "timings": ["Morning", "Afternoon", "Night"],
            "foodInstruction": string or null,
            "duration": string or null,
            "specialInstructions": string or null,
            "confidence": number (0-100),
            "uncertainFields": [array of string field names]
        }
    ],
    "warnings": [array of string warning descriptions]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const requestPayload = {
        contents: [
            {
                parts: [
                    { text: systemPrompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.1
        }
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
    }

    const responseData = await response.json();
    const candidateText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
        throw new Error("Invalid or empty response received from Gemini AI.");
    }

    // Safely extract JSON structure using regex pattern match
    const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Failed to parse standard JSON response from Gemini AI.");
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    return validateAndSanitizeGeminiOutput(parsedResult);
}

function validateAndSanitizeGeminiOutput(data) {
    return {
        patientName: data?.patientName || null,
        doctorName: data?.doctorName || null,
        prescriptionDate: data?.prescriptionDate || new Date().toISOString().split('T')[0],
        medicines: Array.isArray(data?.medicines) ? data.medicines.map(m => ({
            name: m?.name || "Unidentified Medicine",
            form: m?.form || "Tablet",
            dosage: m?.dosage || "As advised",
            quantity: m?.quantity || "1",
            frequency: m?.frequency || "Daily",
            timings: Array.isArray(m?.timings) && m.timings.length ? m.timings : ["Morning"],
            foodInstruction: m?.foodInstruction || "After food",
            duration: m?.duration || "As prescribed",
            specialInstructions: m?.specialInstructions || "",
            confidence: typeof m?.confidence === 'number' ? m.confidence : 75,
            uncertainFields: Array.isArray(m?.uncertainFields) ? m.uncertainFields : []
        })) : [],
        warnings: Array.isArray(data?.warnings) ? data.warnings : []
    };
}

/* ==========================================================================
   2b. LOCAL FALLBACK ANALYZER (no API key / offline mode)
   ========================================================================== */

function localFallbackAnalyzer() {
    AppState.usingFallback = true;
    return {
        patientName: null,
        doctorName: null,
        prescriptionDate: new Date().toISOString().split('T')[0],
        medicines: [
            {
                name: "",
                form: "Tablet",
                dosage: "",
                quantity: "1",
                frequency: "Daily",
                timings: ["Morning"],
                foodInstruction: "After food",
                duration: "",
                specialInstructions: "",
                confidence: 0,
                uncertainFields: ["name", "dosage", "duration"]
            }
        ],
        warnings: [
            "No Gemini API key detected in settings. Running local fallback transcription analyzer — please fill in the medicine details manually below."
        ]
    };
}

/* ==========================================================================
   3. PRESCRIPTION IMAGE INPUT & PROCESSING
   ========================================================================== */

function initScanner() {
    const fileInput = document.getElementById("prescriptionInput");
    const dropZone = document.getElementById("dropZone");
    const btnAnalyze = document.getElementById("btnAnalyze");
    const btnRemoveImage = document.getElementById("btnRemoveImage");
    const btnZoomImage = document.getElementById("btnZoomImage");

    fileInput?.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    dropZone?.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

    dropZone?.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    btnRemoveImage?.addEventListener("click", (e) => {
        e.stopPropagation();
        resetScannerUI();
    });

    btnZoomImage?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (AppState.currentImageDataURL) {
            const zoomedImg = document.getElementById("zoomedImage");
            if (zoomedImg) zoomedImg.src = AppState.currentImageDataURL;
            document.getElementById("imageZoomModal")?.classList.remove("hidden");
        }
    });

    document.getElementById("btnCloseZoomModal")?.addEventListener("click", () => {
        document.getElementById("imageZoomModal")?.classList.add("hidden");
    });

    btnAnalyze?.addEventListener("click", processScannerImage);
}

function handleSelectedFile(file) {
    if (!file.type.match(/^image\//)) {
        alert("Please upload a valid image file (PNG, JPG, JPEG, WEBP).");
        return;
    }

    AppState.currentFileName = file.name;
    AppState.currentFileSize = (file.size / (1024 * 1024)).toFixed(2) + " MB";

    const reader = new FileReader();
    reader.onload = (e) => {
        AppState.currentImageDataURL = e.target.result;

        // Render Preview
        const previewImg = document.getElementById("imagePreview");
        if (previewImg) previewImg.src = AppState.currentImageDataURL;

        const fileNameEl = document.getElementById("fileNameDisplay");
        if (fileNameEl) fileNameEl.textContent = AppState.currentFileName;

        const fileSizeEl = document.getElementById("fileSizeDisplay");
        if (fileSizeEl) fileSizeEl.textContent = AppState.currentFileSize;

        document.getElementById("dropZoneContent")?.classList.add("hidden");
        document.getElementById("previewContainer")?.classList.remove("hidden");

        const btnAnalyze = document.getElementById("btnAnalyze");
        if (btnAnalyze) btnAnalyze.disabled = false;
    };
    reader.readAsDataURL(file);
}

function resetScannerUI() {
    AppState.currentImageDataURL = null;
    AppState.currentFileName = "";
    AppState.currentFileSize = "";

    const fileInput = document.getElementById("prescriptionInput");
    if (fileInput) fileInput.value = "";

    document.getElementById("previewContainer")?.classList.add("hidden");
    document.getElementById("dropZoneContent")?.classList.remove("hidden");

    const btnAnalyze = document.getElementById("btnAnalyze");
    if (btnAnalyze) btnAnalyze.disabled = true;

    document.getElementById("analysisLoader")?.classList.add("hidden");
}

async function processScannerImage() {
    if (!AppState.currentImageDataURL) {
        alert("Please select or upload a prescription image first.");
        return;
    }

    const loader = document.getElementById("analysisLoader");
    if (loader) {
        loader.classList.remove("hidden");
        loader.scrollIntoView({ behavior: "smooth" });
    }

    AppState.usingFallback = false;
    animateProgressStep(1);

    try {
        animateProgressStep(2);

        let extractedData;
        if (isApiKeyValid()) {
            extractedData = await analyzePrescriptionWithGemini(AppState.currentImageDataURL);
        } else {
            // FIX: graceful degradation instead of throwing/alerting
            console.warn("No Gemini API key detected in settings. Running local fallback transcription analyzer.");
            await simulateStepDelay(300); // small delay so the loader UI doesn't just flash
            extractedData = localFallbackAnalyzer();
        }

        animateProgressStep(4);
        await simulateStepDelay(400);
        animateProgressStep(5);

        AppState.extractedData = extractedData;
        if (loader) loader.classList.add("hidden");
        populateReviewScreen(extractedData);
        switchView("view-review");

    } catch (err) {
        if (loader) loader.classList.add("hidden");
        console.error("Error analyzing prescription:", err);

        // FIX: if the Gemini call itself fails (network/auth/quota error),
        // fall back locally instead of dead-ending the user with only an alert.
        console.warn("Falling back to local manual-entry mode after Gemini error.");
        const fallbackData = localFallbackAnalyzer();
        fallbackData.warnings.unshift(`Gemini request failed (${err.message}). Switched to manual entry.`);
        AppState.extractedData = fallbackData;
        populateReviewScreen(fallbackData);
        switchView("view-review");
    }
}

function animateProgressStep(stepNum) {
    for (let i = 1; i <= 5; i++) {
        const stepEl = document.getElementById(`step${i}`);
        if (!stepEl) continue;
        const iconEl = stepEl.querySelector(".step-icon");

        if (i < stepNum) {
            stepEl.className = "step-item completed";
            if (iconEl) iconEl.textContent = "✓";
        } else if (i === stepNum) {
            stepEl.className = "step-item active";
            if (iconEl) iconEl.textContent = "⏳";
        } else {
            stepEl.className = "step-item";
            if (iconEl) iconEl.textContent = "⚪";
        }
    }
}

function simulateStepDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ==========================================================================
   4. REVIEW & VERIFICATION SCREEN
   ========================================================================== */

function populateReviewScreen(data) {
    const reviewImg = document.getElementById("reviewImage");
    if (reviewImg) reviewImg.src = AppState.currentImageDataURL;

    const patientInput = document.getElementById("reviewPatientName");
    if (patientInput) patientInput.value = data.patientName || "";

    const doctorInput = document.getElementById("reviewDoctorName");
    if (doctorInput) doctorInput.value = data.doctorName || "";

    const dateInput = document.getElementById("reviewPrescriptionDate");
    if (dateInput) dateInput.value = data.prescriptionDate || new Date().toISOString().split('T')[0];

   
    let warningsEl = document.getElementById("reviewWarnings");
    if (!warningsEl) {
        const editorListForWarnings = document.getElementById("medicinesEditorList");
        if (editorListForWarnings && editorListForWarnings.parentNode) {
            warningsEl = document.createElement("div");
            warningsEl.id = "reviewWarnings";
            warningsEl.style.marginBottom = "1rem";
            editorListForWarnings.parentNode.insertBefore(warningsEl, editorListForWarnings);
        }
    }
    if (warningsEl) {
        if (Array.isArray(data.warnings) && data.warnings.length) {
            warningsEl.innerHTML = data.warnings
                .map(w => `<div class="alert-banner" style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:0.75rem 1rem;border-radius:8px;margin-bottom:0.5rem;font-size:0.9rem;">⚠️ ${escapeHtml(w)}</div>`)
                .join("");
            warningsEl.classList.remove("hidden");
        } else {
            warningsEl.innerHTML = "";
            warningsEl.classList.add("hidden");
        }
    }

    const editorList = document.getElementById("medicinesEditorList");
    if (editorList) editorList.innerHTML = "";

    if (Array.isArray(data.medicines)) {
        data.medicines.forEach((med, index) => {
            renderMedicineEditCard(med, index);
        });
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderMedicineEditCard(med, index) {
    const editorList = document.getElementById("medicinesEditorList");
    if (!editorList) return;

    const isUncertain = (med.confidence < 75) || (med.uncertainFields && med.uncertainFields.length > 0);

    const card = document.createElement("div");
    card.className = `medicine-edit-card ${isUncertain ? 'uncertain-highlight' : ''}`;
    card.dataset.index = index;

    card.innerHTML = `
        <div class="med-card-header">
            <strong>Medicine #${index + 1}</strong>
            <div class="confidence-indicator">
                ${isUncertain
                    ? `<span class="badge badge-warning">🟠 Needs Verification — ${typeof med.confidence === 'number' ? med.confidence : 60}%</span>`
                    : `<span class="badge badge-success">🟢 High Confidence — ${typeof med.confidence === 'number' ? med.confidence : 95}%</span>`
                }
                <button type="button" class="btn btn-small btn-danger btn-delete-med" data-index="${index}">🗑️</button>
            </div>
        </div>

        <div class="med-grid-inputs">
            <div class="form-group">
                <label>Medicine Name</label>
                <input type="text" class="med-field-name" value="${med.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Form</label>
                <select class="med-field-form">
                    <option ${med.form === 'Tablet' ? 'selected' : ''}>Tablet</option>
                    <option ${med.form === 'Capsule' ? 'selected' : ''}>Capsule</option>
                    <option ${med.form === 'Syrup' ? 'selected' : ''}>Syrup</option>
                    <option ${med.form === 'Injection' ? 'selected' : ''}>Injection</option>
                    <option ${med.form === 'Drops' ? 'selected' : ''}>Drops</option>
                </select>
            </div>
            <div class="form-group">
                <label>Dosage</label>
                <input type="text" class="med-field-dosage" value="${med.dosage || ''}" placeholder="e.g. 500 mg">
            </div>
            <div class="form-group">
                <label>Timing Slots</label>
                <select class="med-field-timings" multiple style="height: 60px;">
                    <option value="Morning" ${(med.timings || []).includes('Morning') ? 'selected' : ''}>☀️ Morning</option>
                    <option value="Afternoon" ${(med.timings || []).includes('Afternoon') ? 'selected' : ''}>🌤️ Afternoon</option>
                    <option value="Night" ${(med.timings || []).includes('Night') ? 'selected' : ''}>🌙 Night</option>
                </select>
            </div>
            <div class="form-group">
                <label>Food Instruction</label>
                <select class="med-field-food">
                    <option ${med.foodInstruction === 'After food' ? 'selected' : ''}>After food</option>
                    <option ${med.foodInstruction === 'Before food' ? 'selected' : ''}>Before food</option>
                    <option ${med.foodInstruction === 'With food' ? 'selected' : ''}>With food</option>
                </select>
            </div>
            <div class="form-group">
                <label>Duration</label>
                <input type="text" class="med-field-duration" value="${med.duration || ''}" placeholder="e.g. 5 days">
            </div>
        </div>
    `;

    editorList.appendChild(card);

    card.querySelector(".btn-delete-med")?.addEventListener("click", () => {
        card.remove();
    });
}

function initReviewForm() {
    document.getElementById("btnAddMedicineRow")?.addEventListener("click", () => {
        const count = document.querySelectorAll(".medicine-edit-card").length;
        renderMedicineEditCard({
            name: "",
            form: "Tablet",
            dosage: "",
            timings: ["Morning"],
            foodInstruction: "After food",
            duration: "7 days",
            confidence: 100,
            uncertainFields: []
        }, count);
    });

    document.getElementById("btnConfirmSchedule")?.addEventListener("click", () => {
        const confirmedMedicines = [];
        const cards = document.querySelectorAll(".medicine-edit-card");

        cards.forEach((card, idx) => {
            const timingSelect = card.querySelector(".med-field-timings");
            const selectedTimings = timingSelect
                ? Array.from(timingSelect.selectedOptions).map(o => o.value)
                : ["Morning"];

            confirmedMedicines.push({
                id: "med_" + Date.now() + "_" + idx,
                name: card.querySelector(".med-field-name")?.value || "Unidentified Medicine",
                form: card.querySelector(".med-field-form")?.value || "Tablet",
                dosage: card.querySelector(".med-field-dosage")?.value || "1 dose",
                timings: selectedTimings.length ? selectedTimings : ["Morning"],
                foodInstruction: card.querySelector(".med-field-food")?.value || "After food",
                duration: card.querySelector(".med-field-duration")?.value || "Continuous",
                takenStatus: {}
            });
        });

        if (confirmedMedicines.length === 0) {
            alert("Please add at least one medicine to create a schedule.");
            return;
        }

        const patientVal = document.getElementById("reviewPatientName")?.value || "Patient";
        const doctorVal = document.getElementById("reviewDoctorName")?.value || "Doctor";
        const dateVal = document.getElementById("reviewPrescriptionDate")?.value || new Date().toISOString().split('T')[0];

        const scheduleObject = {
            id: "sched_" + Date.now(),
            patientName: patientVal,
            doctorName: doctorVal,
            date: dateVal,
            createdAt: new Date().toISOString(),
            medicines: confirmedMedicines
        };

        AppState.activeSchedule = scheduleObject;
        AppState.history.unshift(scheduleObject);
        saveToLocalStorage();

        renderScheduleDashboard();
        switchView("view-schedule");
    });
}

/* ==========================================================================
   5. MEDICATION SCHEDULE & DASHBOARD
   ========================================================================== */

function renderScheduleDashboard() {
    if (!AppState.activeSchedule) return;

    const sched = AppState.activeSchedule;
    const greetingEl = document.getElementById("patientGreeting");
    if (greetingEl) {
        greetingEl.textContent = `Prescription schedule for ${sched.patientName} (Dr. ${sched.doctorName})`;
    }

    const timelineContainer = document.getElementById("scheduleTimeline");
    if (!timelineContainer) return;
    timelineContainer.innerHTML = "";

    const timeSlots = [
        { id: "Morning", title: "☀️ MORNING", defaultTime: "8:00 AM" },
        { id: "Afternoon", title: "🌤️ AFTERNOON", defaultTime: "2:00 PM" },
        { id: "Night", title: "🌙 NIGHT", defaultTime: "9:00 PM" }
    ];

    let totalDoses = 0;
    let takenDoses = 0;
    let nextMedSpotlightFound = false;

    timeSlots.forEach(slot => {
        const slotMeds = sched.medicines.filter(m => Array.isArray(m.timings) && m.timings.includes(slot.id));
        if (slotMeds.length === 0) return;

        const slotBlock = document.createElement("div");
        slotBlock.className = "time-block";

        let cardsHTML = "";
        slotMeds.forEach(med => {
            totalDoses++;
            const isTaken = med.takenStatus && med.takenStatus[slot.id];
            if (isTaken) takenDoses++;

            if (!isTaken && !nextMedSpotlightFound) {
                updateSpotlightCard(med, slot);
                nextMedSpotlightFound = true;
            }

            cardsHTML += `
                <div class="schedule-card ${isTaken ? 'taken' : ''}">
                    <div class="med-info">
                        <div class="med-title">💊 ${med.name}</div>
                        <div class="med-meta">${med.dosage} • 1 ${med.form} <span class="tag-food">${med.foodInstruction}</span></div>
                    </div>
                    <div class="med-action">
                        <button class="btn ${isTaken ? 'btn-outline' : 'btn-success'} btn-toggle-dose"
                                data-med-id="${med.id}" data-slot="${slot.id}">
                            ${isTaken ? '✓ Taken (Undo)' : 'Mark as Taken'}
                        </button>
                    </div>
                </div>
            `;
        });

        slotBlock.innerHTML = `
            <div class="time-block-title">
                <span>${slot.title}</span>
                <span class="time-badge">${slot.defaultTime}</span>
            </div>
            ${cardsHTML}
        `;

        timelineContainer.appendChild(slotBlock);
    });

    if (!nextMedSpotlightFound) {
        clearSpotlightCard();
    }

    // Update Dashboard Stats
    const totalEl = document.getElementById("statTotal");
    if (totalEl) totalEl.textContent = totalDoses;

    const takenEl = document.getElementById("statTaken");
    if (takenEl) takenEl.textContent = takenDoses;

    const remEl = document.getElementById("statRemaining");
    if (remEl) remEl.textContent = totalDoses - takenDoses;

    const progressPct = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

    const fillEl = document.getElementById("progressBarFill");
    if (fillEl) fillEl.style.width = progressPct + "%";

    const pctTextEl = document.getElementById("progressPercentage");
    if (pctTextEl) pctTextEl.textContent = progressPct + "%";

    updateCaregiverView(progressPct);
}

function updateSpotlightCard(med, slot) {
    const spotTime = document.getElementById("spotlightTime");
    if (spotTime) spotTime.textContent = slot.defaultTime;

    const spotName = document.getElementById("spotlightMedName");
    if (spotName) spotName.textContent = med.name;

    const spotDosage = document.getElementById("spotlightMedDosage");
    if (spotDosage) spotDosage.textContent = `${med.dosage} (${med.form})`;

    const spotTag = document.getElementById("spotlightFoodTag");
    if (spotTag) spotTag.textContent = med.foodInstruction;

    const btn = document.getElementById("spotlightActionBtn");
    if (btn) {
        btn.disabled = false;
        btn.onclick = () => toggleDoseStatus(med.id, slot.id);
    }
}

function clearSpotlightCard() {
    const spotTime = document.getElementById("spotlightTime");
    if (spotTime) spotTime.textContent = "--:--";

    const spotName = document.getElementById("spotlightMedName");
    if (spotName) spotName.textContent = "All Medicines Taken!";

    const spotDosage = document.getElementById("spotlightMedDosage");
    if (spotDosage) spotDosage.textContent = "You have completed all scheduled doses for today.";

    const spotTag = document.getElementById("spotlightFoodTag");
    if (spotTag) spotTag.textContent = "Great job!";

    const btn = document.getElementById("spotlightActionBtn");
    if (btn) btn.disabled = true;
}

function initScheduleActions() {
    document.getElementById("scheduleTimeline")?.addEventListener("click", (e) => {
        if (e.target.classList.contains("btn-toggle-dose")) {
            const medId = e.target.dataset.medId;
            const slot = e.target.dataset.slot;
            toggleDoseStatus(medId, slot);
        }
    });
}

function toggleDoseStatus(medId, slot) {
    if (!AppState.activeSchedule) return;

    const med = AppState.activeSchedule.medicines.find(m => m.id === medId);
    if (med) {
        if (!med.takenStatus) med.takenStatus = {};
        med.takenStatus[slot] = !med.takenStatus[slot];
        saveToLocalStorage();
        renderScheduleDashboard();
    }
}

/* ==========================================================================
   6. VOICE ASSISTANT (WEB SPEECH API)
   ========================================================================== */

function initVoiceAssistant() {
    const btnActivate = document.getElementById("btnActivateVoice");
    const modal = document.getElementById("voiceModal");
    const btnClose = document.getElementById("btnCloseVoiceModal");
    const userTranscriptText = document.getElementById("userTranscriptText");

    btnActivate?.addEventListener("click", () => {
        modal?.classList.remove("hidden");
        startSpeechRecognition();
    });

    btnClose?.addEventListener("click", () => {
        modal?.classList.add("hidden");
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    });

    document.querySelectorAll(".voice-quick-questions .chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const question = chip.dataset.question;
            if (userTranscriptText) userTranscriptText.textContent = `"${question}"`;
            processVoiceQuery(question);
        });
    });

    document.getElementById("btnSendVoiceText")?.addEventListener("click", () => {
        const textInput = document.getElementById("voiceTextInput");
        if (textInput && textInput.value.trim()) {
            if (userTranscriptText) userTranscriptText.textContent = `"${textInput.value}"`;
            processVoiceQuery(textInput.value);
            textInput.value = "";
        }
    });
}

function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const statusText = document.getElementById("voiceStatusText");

    if (!SpeechRecognition) {
        if (statusText) statusText.textContent = "Voice recognition not supported in this browser. Use text input below.";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => {
        if (statusText) statusText.textContent = "Listening... Please ask your question out loud.";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const userTranscriptText = document.getElementById("userTranscriptText");
        if (userTranscriptText) userTranscriptText.textContent = `"${transcript}"`;
        processVoiceQuery(transcript);
    };

    recognition.onerror = () => {
        if (statusText) statusText.textContent = "Could not hear speech clearly. Try typing below or click a quick question.";
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn("Speech recognition busy or already active:", e);
    }
}

function processVoiceQuery(query) {
    const q = query.toLowerCase();
    let reply = "I can only answer questions based on your verified prescription schedule.";

    if (!AppState.activeSchedule) {
        reply = "You do not have an active medication schedule created yet. Please scan a prescription first.";
    } else {
        const meds = AppState.activeSchedule.medicines || [];

        if (q.includes("tonight") || q.includes("night") || q.includes("evening")) {
            const nightMeds = meds.filter(m => Array.isArray(m.timings) && m.timings.includes("Night"));
            if (nightMeds.length) {
                const names = nightMeds.map(m => `${m.name} ${m.dosage}`).join(" and ");
                reply = `Tonight you are scheduled to take: ${names}.`;
            } else {
                reply = "You have no medicines scheduled for tonight.";
            }
        } else if (q.includes("next")) {
            const remaining = meds.filter(m => !m.takenStatus || !Object.values(m.takenStatus).some(Boolean));
            if (remaining.length) {
                reply = `Your next scheduled medicine is ${remaining[0].name} ${remaining[0].dosage}.`;
            } else {
                reply = "You have completed all medicines for today!";
            }
        } else if (q.includes("morning")) {
            const morningMeds = meds.filter(m => Array.isArray(m.timings) && m.timings.includes("Morning"));
            reply = `Your morning medicines are: ${morningMeds.map(m => m.name).join(", ")}.`;
        } else if (q.includes("today") || q.includes("all")) {
            reply = `Today you have ${meds.length} medicines scheduled: ${meds.map(m => m.name).join(", ")}.`;
        }
    }

    const respText = document.getElementById("assistantResponseText");
    if (respText) respText.textContent = `"${reply}"`;
    speakOutLoud(reply);
}

function speakOutLoud(text) {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    }
}

/* ==========================================================================
   7. ACCESSIBILITY CONTROLS (SENIOR MODE, HIGH CONTRAST, LARGE TEXT)
   ========================================================================== */

function initAccessibilityControls() {
    const btnSenior = document.getElementById("btnSeniorMode");
    const btnContrast = document.getElementById("btnHighContrast");
    const btnLarge = document.getElementById("btnLargeText");

    btnSenior?.addEventListener("click", () => {
        AppState.settings.seniorMode = !AppState.settings.seniorMode;
        btnSenior.setAttribute("aria-pressed", AppState.settings.seniorMode);
        document.body.classList.toggle("senior-mode", AppState.settings.seniorMode);
        saveToLocalStorage();
    });

    btnContrast?.addEventListener("click", () => {
        AppState.settings.highContrast = !AppState.settings.highContrast;
        btnContrast.setAttribute("aria-pressed", AppState.settings.highContrast);
        document.body.classList.toggle("high-contrast-mode", AppState.settings.highContrast);
        saveToLocalStorage();
    });

    btnLarge?.addEventListener("click", () => {
        AppState.settings.largeText = !AppState.settings.largeText;
        btnLarge.setAttribute("aria-pressed", AppState.settings.largeText);
        document.body.classList.toggle("large-text-mode", AppState.settings.largeText);
        saveToLocalStorage();
    });
}

/* ==========================================================================
   8. CAREGIVER & HISTORY VIEWS
   ========================================================================== */

function updateCaregiverView(adherenceScore) {
    if (!AppState.activeSchedule) return;

    const cgPatient = document.getElementById("cgPatientName");
    if (cgPatient) cgPatient.textContent = AppState.activeSchedule.patientName;

    const cgDate = document.getElementById("cgRxDate");
    if (cgDate) cgDate.textContent = AppState.activeSchedule.date;

    const cgAdherence = document.getElementById("cgAdherenceScore");
    if (cgAdherence) cgAdherence.textContent = adherenceScore + "%";

    const logList = document.getElementById("cgDoseLogList");
    if (!logList) return;
    logList.innerHTML = "";

    (AppState.activeSchedule.medicines || []).forEach(m => {
        const item = document.createElement("div");
        item.className = "dose-log-item";
        item.style.padding = "0.5rem 0";
        item.style.borderBottom = "1px solid #e2e8f0";

        const isLogged = m.takenStatus && Object.values(m.takenStatus).some(Boolean);
        const takenText = isLogged ? "🟢 Dose Logged" : "🟠 Pending";

        item.innerHTML = `<strong>${m.name}</strong> (${m.dosage}) — ${takenText}`;
        logList.appendChild(item);
    });
}

function renderHistoryGrid() {
    const grid = document.getElementById("historyGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (AppState.history.length === 0) {
        grid.innerHTML = "<p>No saved prescription history found.</p>";
        return;
    }

    AppState.history.forEach((sched, index) => {
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML = `
            <h3>${sched.patientName}</h3>
            <p><strong>Doctor:</strong> ${sched.doctorName}</p>
            <p><strong>Date:</strong> ${sched.date}</p>
            <p><strong>Medicines:</strong> ${sched.medicines ? sched.medicines.length : 0}</p>
            <button class="btn btn-small btn-primary btn-load-history" data-index="${index}">View Schedule</button>
        `;

        card.querySelector(".btn-load-history")?.addEventListener("click", () => {
            AppState.activeSchedule = AppState.history[index];
            renderScheduleDashboard();
            switchView("view-schedule");
        });

        grid.appendChild(card);
    });

    document.getElementById("btnClearHistory")?.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all saved prescription history?")) {
            AppState.history = [];
            AppState.activeSchedule = null;
            saveToLocalStorage();
            renderHistoryGrid();
            renderScheduleDashboard();
        }
    });
}

/* ==========================================================================
   9. LOCAL STORAGE PERSISTENCE
   ========================================================================== */

function saveToLocalStorage() {
    try {
        localStorage.setItem("mediease_state", JSON.stringify({
            activeSchedule: AppState.activeSchedule,
            history: AppState.history,
            settings: AppState.settings
        }));
    } catch (e) {
        console.error("Failed to write to LocalStorage:", e);
    }
}

function loadStoredData() {
    const saved = localStorage.getItem("mediease_state");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            AppState.activeSchedule = parsed.activeSchedule || null;
            AppState.history = parsed.history || [];
            AppState.settings = parsed.settings || AppState.settings;

            // Restore accessibility settings
            if (AppState.settings.seniorMode) {
                document.body.classList.add("senior-mode");
                document.getElementById("btnSeniorMode")?.setAttribute("aria-pressed", "true");
            }
            if (AppState.settings.highContrast) {
                document.body.classList.add("high-contrast-mode");
                document.getElementById("btnHighContrast")?.setAttribute("aria-pressed", "true");
            }
            if (AppState.settings.largeText) {
                document.body.classList.add("large-text-mode");
                document.getElementById("btnLargeText")?.setAttribute("aria-pressed", "true");
            }

            if (AppState.activeSchedule) {
                renderScheduleDashboard();
            }
            renderHistoryGrid();
        } catch (e) {
            console.error("Failed to restore LocalStorage data:", e);
        }
    }
}

function updateUI() {
    const apiStatusText = document.getElementById("apiStatusText");
    if (!apiStatusText) return;

    if (!isApiKeyValid()) {
        apiStatusText.innerHTML = `<span style="color: var(--danger, #ef4444);">⚠️ No API key — Local Fallback Mode (manual entry)</span>`;
    } else {
        apiStatusText.innerHTML = `<span style="color: var(--success, #22c55e);">Gemini Flash Vision Connected</span>`;
    }
}
