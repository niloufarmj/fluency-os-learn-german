# 🇩🇪 FluencyOS

**FluencyOS** is a locally-hosted, AI-powered German language learning system. It replaces traditional textbooks with a dynamic, adaptive curriculum driven by Google's Gemini 1.5 Flash LLM. 

By combining a lightweight Python/FastAPI backend with a vanilla HTML/JS frontend, FluencyOS offers a production-grade language learning experience without the overhead of massive web frameworks. It runs entirely on your local machine, keeping your data private in local JSON files.

## ✨ What This App Does

FluencyOS is designed to cover all four core language skills: **Reading, Writing, Listening, and Speaking**. 

*   **Intelligent Onboarding:** A static, comprehensive CEFR placement test evaluates your baseline across all skills. It uses AI to analyze your essay and spoken responses to place you correctly (A1–C1).
*   **Dynamic Roleplay:** Engage in real-time, text-to-text or speech-to-text conversations with AI characters (e.g., a Munich train conductor or a strict landlord). The AI strictly adheres to your CEFR level and grades your conversation afterward.
*   **Spaced Repetition (SRS) Vocabulary:** Add words you don't know, and the AI will automatically generate example sentences at your exact reading level. The app tests you right before you are about to forget them.
*   **Zero-Cost Audio:** Utilizing the browser's native Web Speech API, FluencyOS features full Text-to-Speech (TTS) for listening comprehension and native Speech-to-Text (STT) for pronunciation evaluation—costing $0 in API fees.
*   **Curated Media:** Embeds topic-specific YouTube resources (like *Easy German*) alongside AI-generated grammar explanations.
*   **Progression System:** Locks you into a daily syllabus, requiring you to master current topics before unlocking the next.

---

## 📂 Project Structure

Ensure your files are organized exactly like this before running the application:

```text
fluency-os/
│
├── backend/
│   ├── main.py              # Main FastAPI application
│   ├── utils.py             # JSON file handlers & Gemini API wrapper
│   ├── requirements.txt     # Python dependencies
│   ├── data/                # Local database (JSON files)
│   │   ├── cache.json
│   │   ├── daily_logs.json
│   │   ├── placement_test.json
│   │   ├── resources.json
│   │   ├── syllabus.json
│   │   ├── user_profile.json
│   │   └── vocab.json
│   └── routers/
│       └── onboarding.py    # Placement test logic & final grading
│
└── frontend/
    ├── index.html           # Main application interface
    ├── styles.css           # Global stylesheet
    └── js/
        ├── app.js           # Core application boot & routing
        ├── state.js         # Global state & time tracking
        └── modules/
            └── onboarding.js # Onboarding UI & Speech Recognition logic
```

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
1.  **Python 3.8+** installed on your machine.
2.  A modern web browser with Speech Recognition support (**Google Chrome, Safari, or Microsoft Edge** are highly recommended).
3.  A **Google Gemini API Key** (You can get a free one from Google AI Studio).

---

## 🚀 Installation & Setup

### 1. Install Backend Dependencies
Open your terminal, navigate to the `backend/` folder, and install the required Python packages:

```bash
cd fluency-os/backend
pip install -r requirements.txt
```
*(Your `requirements.txt` should include: `fastapi`, `uvicorn`, `google-generativeai`, and `pydantic`)*.

### 2. Start the Backend Server
Run the FastAPI application using Uvicorn. This acts as the bridge between your local JSON files and the Gemini API.

```bash
uvicorn main:app --reload
```
You should see output indicating the server is running on `http://127.0.0.1:8000`. Keep this terminal window open!

### 3. Launch the Frontend
Because the frontend is built with vanilla HTML/JS, **there is no build step or node server required**. 
Simply navigate to your `frontend/` folder in your file explorer and double-click `index.html` to open it in your browser.

---

## 🎓 First-Time Boot & Usage

1.  **The Onboarding Screen:** When you first open `index.html`, you will be greeted by the setup screen.
2.  **Enter your API Key:** You *must* enter your Google Gemini API key during step 1 so the AI can evaluate your writing and speaking responses at the end of the test.
3.  **Take the Placement Test:** The app will guide you through a multi-skill test. **Make sure to grant Microphone permissions** when prompted for the speaking portions!
4.  **Dashboard:** Once the AI evaluates your test and assigns your CEFR level, you will unlock the main dashboard, your daily syllabus, and all app modules.

---

## 🛑 Troubleshooting

*   **"Request Failed" or API Errors:** Ensure your Python backend is actively running (`uvicorn main:app --reload`) and that your terminal hasn't thrown any syntax errors.
*   **Microphone Not Working:** The Web Speech API requires a secure context or `localhost`. Because you are opening a local file (`file:///`), Chrome usually allows this, but ensure you haven't blocked microphone access in your browser settings.
*   **Blank Screen on Load:** Open your browser's Developer Tools (F12) and check the Console. Ensure the paths to your `styles.css` and `.js` files in `index.html` are correct (e.g., `<script src="js/state.js"></script>`).
*   **Resetting the App:** If you want to retake the placement test or wipe your progress, simply open `backend/data/user_profile.json` and change `"onboarded": true` to `"onboarded": false`, or delete the file entirely.