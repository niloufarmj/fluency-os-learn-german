import json
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from routers import onboarding
from routers import plan
from utils import read_json, write_json, call_gemini, parse_json_strict, require_key

app = FastAPI(title="FluencyOS Backend")

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the Onboarding router
app.include_router(onboarding.router)
app.include_router(plan.router)

# ── Request Models ────────────────────────────────────────────────────────────

class VocabContextRequest(BaseModel):
    word: str
    level: str

class VocabAddRequest(BaseModel):
    word: str
    level: str

class VocabReviewRequest(BaseModel):
    word: str
    quality: int  # 0–5

class ChatScenarioRequest(BaseModel):
    scenario: str
    level: str
    history: List[Dict[str, str]]

class EndChatReviewRequest(BaseModel):
    transcript: List[Dict[str, str]]
    level: str

class GenerateReadingRequest(BaseModel):
    topic: str
    level: str

class ExplainGrammarRequest(BaseModel):
    topic: str
    level: str

class TranslateWordRequest(BaseModel):
    word: str
    level: Optional[str] = "A2"

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    level: Optional[str] = None
    daily_time_minutes: Optional[int] = None
    streak: Optional[int] = None

class TimeTrackRequest(BaseModel):
    date: str
    minutes: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/daily-plan")
def get_daily_plan():
    profile = read_json("user_profile.json")
    level = profile.get("level", "A2")
    total_min = profile.get("daily_time_minutes", 30)
    current_step = profile.get("current_step", 1) # Progression Lock

    vocab_min = max(5, int(total_min * 0.20))
    grammar_min = max(10, int(total_min * 0.35))
    reading_min = total_min - vocab_min - grammar_min

    syllabus = read_json("syllabus.json")
    level_topics = [t for t in syllabus if t.get("level") == level]
    
    # Ensure they don't jump ahead. If they are on step 1, they get topic index 0.
    topic_index = min(current_step - 1, len(level_topics) - 1)
    
    if level_topics:
        active_topic = level_topics[topic_index]["topic"]
    else:
        active_topic = "General Review"

    return {
        "tasks": [
            {"type": "vocab_review", "duration_min": vocab_min, "count": 20},
            {"type": "grammar", "duration_min": grammar_min, "topic": active_topic, "step": current_step},
            {"type": "reading", "duration_min": reading_min, "level": level},
            # Require an end-of-day test to unlock the next step
            {"type": "end_of_day_test", "duration_min": 5, "topic": active_topic} 
        ]
    }

@app.post("/generate-vocab-context")
def generate_vocab_context(req: VocabContextRequest, authorization: Optional[str] = Header(None)):
    cache = read_json("cache.json")
    cache_key = f"vocab:{req.word.lower()}:{req.level}"
    if cache_key in cache:
        return cache[cache_key]

    api_key = require_key(authorization)
    prompt = (
        f"You are a German language tutor. Generate exactly 3 example sentences in German "
        f"using the word '{req.word}', strictly at CEFR {req.level} level. "
        "Return ONLY minified JSON, no markdown, no backticks: "
        '{"sentences":["...","...","..."],"translation":"...","part_of_speech":"..."}'
    )
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}])
    result, err = parse_json_strict(raw)
    if err or not isinstance(result, dict):
        raise HTTPException(status_code=400, detail="Gemini returned invalid JSON.")

    cache[cache_key] = result
    write_json("cache.json", cache)
    return result

@app.post("/track-time")
def track_time(req: TimeTrackRequest):
    logs = read_json("daily_logs.json")
    # Find today's log or create a new one
    today_log = next((l for l in logs if l.get("date", "").startswith(req.date.split("T")[0])), None)
    
    if today_log:
        today_log["active_minutes"] = today_log.get("active_minutes", 0) + req.minutes
    else:
        logs.append({
            "date": req.date,
            "type": "daily_activity",
            "active_minutes": req.minutes
        })
    write_json("daily_logs.json", logs)
    return {"status": "success"}

@app.post("/chat-scenario")
def chat_scenario(req: ChatScenarioRequest, authorization: Optional[str] = Header(None)):
    api_key = require_key(authorization)
    system_prompt = (
        f"You are playing the role of a native German speaker in this scenario: {req.scenario}. "
        f"Respond ONLY in German. Limit each response to 2–3 sentences. "
        f"Use strictly {req.level} CEFR vocabulary. Stay in character at all times. "
        "Do not add English translations or explanations."
    )
    reply = call_gemini(api_key, req.history, system=system_prompt)
    return {"reply": reply}


@app.post("/end-chat-review")
def end_chat_review(req: EndChatReviewRequest, authorization: Optional[str] = Header(None)):
    api_key = require_key(authorization)
    transcript_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in req.transcript
    )
    prompt = (
        f"Analyze this German conversation transcript. The student is at CEFR {req.level}.\n\n"
        f"{transcript_text}\n\n"
        "Return ONLY minified JSON, no markdown, no backticks: "
        '{"mistakes":[{"original":"...","correction":"...","explanation":"..."}],'
        '"score":7,"summary":"one sentence summary"}'
    )
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}], max_tokens=2048)
    result, err = parse_json_strict(raw)
    if err or not isinstance(result, dict):
        raise HTTPException(status_code=400, detail="Gemini returned invalid JSON.")

    logs = read_json("daily_logs.json")
    logs.append({
        "date": datetime.now().isoformat(),
        "type": "roleplay",
        "score": result.get("score", 0),
        "transcript": req.transcript,
    })
    write_json("daily_logs.json", logs)
    return result


@app.post("/generate-reading")
def generate_reading(req: GenerateReadingRequest, authorization: Optional[str] = Header(None)):
    cache = read_json("cache.json")
    cache_key = f"reading:{req.topic.lower()}:{req.level}"
    if cache_key in cache:
        return cache[cache_key]

    api_key = require_key(authorization)
    prompt = (
        f"Write a 250-word German article about '{req.topic}'. "
        f"Language MUST be strictly CEFR {req.level}. "
        "After the article, add 3 comprehension questions in German with answers. "
        "Return ONLY minified JSON, no markdown, no backticks: "
        '{"article":"...","questions":[{"q":"...","a":"..."}]}'
    )
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}], max_tokens=2048)
    result, err = parse_json_strict(raw)
    if err or not isinstance(result, dict):
        raise HTTPException(status_code=400, detail="Gemini returned invalid JSON.")

    cache[cache_key] = result
    write_json("cache.json", cache)
    return result


@app.get("/vocab")
def get_vocab():
    return read_json("vocab.json")


@app.post("/vocab/add")
def add_vocab(req: VocabAddRequest, authorization: Optional[str] = Header(None)):
    vocab = read_json("vocab.json")

    for entry in vocab:
        if entry["word"].lower() == req.word.lower():
            return entry

    new_entry = {
        "word": req.word,
        "level": req.level,
        "next_review": date.today().isoformat(),
        "interval_days": 1,
        "ease_factor": 2.5,
        "sentences": [],
        "translation": "",
        "part_of_speech": "",
        "added_date": date.today().isoformat(),
    }

    if authorization:
        try:
            ctx = generate_vocab_context(
                VocabContextRequest(word=req.word, level=req.level),
                authorization=authorization,
            )
            new_entry["sentences"] = ctx.get("sentences", [])
            new_entry["translation"] = ctx.get("translation", "")
            new_entry["part_of_speech"] = ctx.get("part_of_speech", "")
        except Exception:
            pass

    vocab.append(new_entry)
    write_json("vocab.json", vocab)
    return new_entry


@app.post("/vocab/review")
def review_vocab(req: VocabReviewRequest):
    vocab = read_json("vocab.json")

    for entry in vocab:
        if entry["word"].lower() == req.word.lower():
            q = max(0, min(5, req.quality))
            ef = float(entry.get("ease_factor", 2.5))
            interval = int(entry.get("interval_days", 1))

            if q < 3:
                interval = 1
            else:
                interval = max(1, round(interval * ef))

            new_ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            new_ef = max(1.3, round(new_ef, 2))

            entry["ease_factor"] = new_ef
            entry["interval_days"] = interval
            entry["next_review"] = (date.today() + timedelta(days=interval)).isoformat()
            entry["last_reviewed"] = date.today().isoformat()

            write_json("vocab.json", vocab)
            return entry

    raise HTTPException(status_code=404, detail=f"Word '{req.word}' not found in vocab.")


@app.get("/profile")
def get_profile():
    profile = read_json("user_profile.json")
    logs = read_json("daily_logs.json")
    
    # Dynamic streak calculation
    streak = 0
    today_str = date.today().isoformat()
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    
    logged_dates = set(log.get("date", "").split("T")[0] for log in logs if "date" in log)
    
    if today_str in logged_dates or yesterday_str in logged_dates:
        # Calculate backward
        check_date = date.today() if today_str in logged_dates else date.today() - timedelta(days=1)
        while check_date.isoformat() in logged_dates:
            streak += 1
            check_date -= timedelta(days=1)
            
    profile["streak"] = streak
    return profile


@app.post("/profile/update")
def update_profile(req: ProfileUpdateRequest):
    profile = read_json("user_profile.json")
    if req.name is not None:
        profile["name"] = req.name
    if req.level is not None:
        profile["level"] = req.level
    if req.daily_time_minutes is not None:
        profile["daily_time_minutes"] = req.daily_time_minutes
    if req.streak is not None:
        profile["streak"] = req.streak
    write_json("user_profile.json", profile)
    return profile


@app.post("/explain-grammar")
def explain_grammar(req: ExplainGrammarRequest, authorization: Optional[str] = Header(None)):
    cache = read_json("cache.json")
    cache_key = f"grammar:{req.topic.lower()}:{req.level}"
    if cache_key in cache:
        return cache[cache_key]

    api_key = require_key(authorization)
    prompt = (
        f"You are a German language teacher. Explain the grammar topic '{req.topic}' "
        f"for a CEFR {req.level} student. "
        "Provide a clear explanation, then exactly 5 fill-in-the-blank practice exercises. "
        "Return ONLY minified JSON, no markdown, no backticks: "
        '{"explanation":"...","examples":["...","..."],'
        '"exercises":[{"sentence":"Ich ___ nach Hause.","answer":"gehe","hint":"to go"}]}'
    )
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}], max_tokens=2048)
    result, err = parse_json_strict(raw)
    if err or not isinstance(result, dict):
        raise HTTPException(status_code=400, detail="Gemini returned invalid JSON.")

    cache[cache_key] = result
    write_json("cache.json", cache)
    return result


@app.post("/translate-word")
def translate_word(req: TranslateWordRequest, authorization: Optional[str] = Header(None)):
    cache = read_json("cache.json")
    cache_key = f"translate:{req.word.lower()}"
    if cache_key in cache:
        return cache[cache_key]

    api_key = require_key(authorization)
    prompt = (
        f"Translate the German word '{req.word}' to English. "
        "Return ONLY minified JSON, no markdown, no backticks: "
        '{"word":"...","translation":"...","part_of_speech":"..."}'
    )
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}])
    result, err = parse_json_strict(raw)
    if err or not isinstance(result, dict):
        raise HTTPException(status_code=400, detail="Gemini returned invalid JSON.")

    cache[cache_key] = result
    write_json("cache.json", cache)
    return result


@app.get("/syllabus")
def get_syllabus():
    return read_json("syllabus.json")


@app.get("/logs")
def get_logs():
    return read_json("daily_logs.json")


@app.get("/resources")
def get_resources(topic: str = None):
    resources = read_json("resources.json")
    if not isinstance(resources, list):
        resources = []
    if topic:
        return [r for r in resources if r.get("topic") == topic]
    return resources