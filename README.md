# 💊 MediEase — Your Prescription, Simplified

> Turn messy, handwritten, or printed prescriptions into clear, visual daily medication schedules — powered by AI, built for everyone, especially seniors and caregivers.

![Status](https://img.shields.io/badge/status-hackathon--build-blue)
![PWA](https://img.shields.io/badge/PWA-installable-0284c7)
![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash--Lite-4285F4)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🧠 The Problem

Prescriptions are often illegible, confusing, or written in medical shorthand that's hard for patients — especially elderly patients — to follow correctly. Missed doses, wrong timings, and confusing dosage instructions are a leading cause of poor treatment outcomes. Caregivers, meanwhile, have no easy way to track whether a loved one is actually sticking to their medication schedule.

## ✨ The Solution

**MediEase** uses AI vision to read a photo of any prescription — handwritten or printed — and instantly converts it into a **clear, interactive, visual daily medication routine**. It doesn't stop at translation: it flags anything it's *not confident about* for human review, so nothing risky slips through silently.

Built accessibility-first, MediEase includes senior mode, high-contrast themes, large-text support, and a hands-free voice assistant — because the people who need this most are often the ones least served by typical tech UX.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🤖 **AI Prescription Scanning** | Upload or snap a photo of a prescription; Gemini 2.5 Flash-Lite Vision extracts medicine names, dosages, frequency, and timing. |
| ⚠️ **Confidence & Verification** | Instead of silently guessing on unclear handwriting, MediEase explicitly flags low-confidence extractions for the user to confirm or correct. |
| 📅 **Visual Medication Schedule** | Extracted data is converted into an easy-to-follow daily routine view — no more deciphering "1-0-1 p.c." on your own. |
| 🎙️ **Voice Assistant** | A hands-free assistant (Web Speech API) lets users ask questions about their medications out loud and hear spoken responses. |
| 👴 **Senior & Accessibility Mode** | One-tap toggles for large text, high-contrast display, and simplified layouts. |
| 👨‍👩‍👧 **Caregiver View** | A dedicated monitoring dashboard so family members or caregivers can track adherence and dose logs. |
| 🕘 **Prescription History** | Every scanned prescription and schedule is saved locally for later reference. |
| 🛡️ **Graceful Degradation** | If no AI key is configured or the request fails, MediEase falls back to a manual-entry flow — the app never breaks the user's workflow. |
| 📲 **Installable PWA** | Fully installable as a Progressive Web App with offline support via a service worker. |

---

## 🖥️ How It Works

```
📄 Messy Prescription
        ↓
✨ Gemini 2.5 Flash-Lite AI (Vision)
        ↓
🔍 Uncertainty Verification (user confirms unclear fields)
        ↓
📅 Visual Medication Routine
```

1. **Scan** — Upload or capture a photo of a prescription.
2. **Extract** — The image is sent to the Gemini Vision API, which parses medicine names, dosages, frequency, and instructions into structured JSON.
3. **Review** — Any field the AI is uncertain about is flagged for the user to double-check before it's trusted.
4. **Schedule** — Confirmed data is transformed into a clean, interactive daily routine.
5. **Track & Share** — Patients follow their schedule; caregivers can view adherence via the Caregiver dashboard.

> **⚠️ Important:** MediEase does not replace a doctor. It exists purely to make a doctor's existing instructions easier to read and follow.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no framework — fast, dependency-light)
- **AI:** Google Gemini 2.5 Flash-Lite (Vision) via `generativelanguage.googleapis.com`
- **Voice:** Web Speech API (`SpeechRecognition` + `speechSynthesis`)
- **Storage:** Browser `localStorage` for schedules and history
- **Offline / Installable:** Service Worker + Web App Manifest (PWA)
- **Fonts:** Plus Jakarta Sans (Google Fonts)

---

## 📂 Project Structure

```
mediease/
├── index.html          # App shell — Home, Scan, Review, Schedule, Caregiver, History views
├── style.css            # Full design system + responsive/accessible styling
├── script.js             # Core app logic, Gemini API integration, voice assistant, storage
├── service_worker.js    # Offline caching for PWA support
├── manifest.json        # PWA manifest (icons, theme, display mode)
└── README.md
```

---

## ⚡ Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/mediease.git
cd mediease
```

### 2. Add your Gemini API key
Open `script.js` and set your key:
```js
const GEMINI_API_KEY = "AIzaSy..."; // your Gemini API key
const GEMINI_MODEL = "gemini-2.5-flash-lite";
```
> Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
>
> **No key?** No problem — MediEase automatically falls back to a manual-entry mode so you can still demo the full scheduling and accessibility experience.

### 3. Run locally
Because it uses a Service Worker, serve it over HTTP rather than opening the file directly:
```bash
npx serve .
# or
python3 -m http.server 8000
```
Then visit `http://localhost:8000` (or the port shown).

### 4. Install as a PWA (optional)
Open the app in Chrome/Edge → click **Install App** in the address bar, or use "Add to Home Screen" on mobile.

---

## 🎯 Why It Matters

- 💊 **Medication non-adherence** contributes to a significant share of preventable hospital readmissions worldwide.
- 👴 Elderly patients — who take the most medications — are often the least comfortable with confusing apps or dense text.
- 🗣️ Illegible handwriting and medical jargon create real risk of dosing errors.

MediEase tackles all three: **AI does the hard reading**, **the UI does the hard explaining**, and **accessibility features make sure no one is left out.**

---

## 🔮 Roadmap / Future Improvements

- 🔔 Push notifications & dose reminders
- 🌐 Multi-language prescription support
- 🩺 Direct integration with pharmacy / EHR systems
- 📊 Adherence analytics for caregivers
- ☁️ Optional cloud sync across devices

---

## 👥 Team

Built with ❤️ for [Hackathon Name] — feel free to update this section with your team members and roles.

| Name | Role |
|---|---|
| — | — |
| — | — |

---

## 📄 License

This project is licensed under the MIT License — see the `LICENSE` file for details.

---

<p align="center"><strong>MediEase — because understanding your medication shouldn't be the hardest part of getting better.</strong></p>
