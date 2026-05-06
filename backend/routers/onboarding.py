from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
from utils import read_json, write_json, call_gemini, strip_fences, require_key

router = APIRouter()

# --- Models ---

class QuestionHistoryEntry(BaseModel):
    questionId: int
    level: str
    type: str
    category: str
    q: str
    passages: Optional[str] = None # For reading
    correct_answer: Optional[Any] = None # For MC/blank
    user_answer: Optional[Any] = None # MC index, text string, or STT transcript
    score: Optional[int] = None # For speaking/writing evaluation later

class FinalGradingSubmission(BaseModel):
    name: str
    time_minutes: int
    priorities: List[str]
    apiKey: str # The user's key to run the grading
    history: List[QuestionHistoryEntry]

# --- Endpoints ---

@router.get("/placement/get-test")
def get_placement_test():
    test_data = read_json("placement_test.json")
    return test_data if isinstance(test_data, list) else []

@router.post("/placement/grade-and-finalize")
def grade_and_finalize_onboarding(data: FinalGradingSubmission):
    # Construct a detailed prompt for the LLM based on the complete history
    history_str = json.dumps([h.dict() for h in data.history], ensure_ascii=False)
    
    prompt = (
        f"Analyze the following complete German language placement test history for a student named '{data.name}'.\n\n"
        f"Priorities: {', '.join(data.priorities)}\n\n"
        "Based on their answers (including essay text, transcripts of their speech, and multiple-choice selections), "
        "determine their precise CEFR level (A1, A2, B1, B2, or C1).\n\n"
        "Be rigorous, particularly regarding writing and speaking competence. "
        "Forgive minor Speech-to-Text transcription errors.\n\n"
        "Return ONLY minified JSON, no markdown formatting:\n"
        '{"deduced_level":"...", "level_analysis":"...one sentence summary of the reasoning..."}'
    )
    
    # Use the user's provided API key to call the LLM for grading
    system_prompt = "You are a senior German language assessment expert grading a placement exam."
    
    try:
        raw_llm_response = call_gemini(data.apiKey, [{"role": "user", "content": prompt}], system=system_prompt, max_tokens=2048)
        llm_data = json.loads(strip_fences(raw_llm_response))
    except Exception as e:
        return {"error": f"LLM grading failed: {str(e)}"}
    
    calculated_level = llm_data.get("deduced_level", "A1")
    
    # Save the updated profile with the LLM-deduced level
    profile = read_json("user_profile.json")
    profile.update({
        "name": data.name,
        "level": calculated_level,
        "level_analysis": llm_data.get("level_analysis", ""),
        "daily_time_minutes": data.time_minutes,
        "priorities": data.priorities,
        "onboarded": True,
        "current_step": 1 
    })
    write_json("user_profile.json", profile)
    
    # Store the full test history as a log entry for future reference
    logs = read_json("daily_logs.json")
    logs.append({
        "date": datetime.now().isoformat(),
        "type": "placement_exam",
        "name": data.name,
        "final_level": calculated_level,
        "history": [h.dict() for h in data.history]
    })
    write_json("daily_logs.json", logs)
    
    return profile