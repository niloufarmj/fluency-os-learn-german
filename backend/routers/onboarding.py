from fastapi import APIRouter, Header
from typing import Optional, List
from pydantic import BaseModel
import json
from utils import read_json, write_json, call_gemini, strip_fences, require_key

router = APIRouter()

class TestState(BaseModel):
    current_level: str
    history: List[dict]

class FinalizeData(BaseModel):
    name: str
    final_level: str
    time_minutes: int
    priorities: List[str]

@router.post("/placement/next-question")
def get_next_question(req: TestState, authorization: Optional[str] = Header(None)):
    api_key = require_key(authorization)
    
    if len(req.history) >= 8:
        return {"status": "complete", "final_level": req.current_level}

    prompt = (
        f"Generate a German multiple-choice question testing grammar or vocabulary at exactly the CEFR {req.current_level} level. "
        "It must have 4 options, and only one correct answer. "
        "Return ONLY minified JSON, no markdown formatting: "
        '{"question":"...","options":["A","B","C","D"],"correct_index":0, "explanation":"..."}'
    )
    
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}])
    return {"status": "continue", "question_data": json.loads(strip_fences(raw))}

@router.post("/placement/finalize")
def finalize_onboarding(data: FinalizeData):
    profile = read_json("user_profile.json")
    profile.update({
        "name": data.name,
        "level": data.final_level,
        "daily_time_minutes": data.time_minutes,
        "priorities": data.priorities,
        "onboarded": True,
        "current_step": 1 # Locks progression to day 1
    })
    write_json("user_profile.json", profile)
    return profile