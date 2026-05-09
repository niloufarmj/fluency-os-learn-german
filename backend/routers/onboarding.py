from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
from utils import read_json, write_json, call_gemini, parse_json_strict, require_key
from planning.prompts import build_generic_plan_prompt, build_fix_json_prompt
from planning.schemas import validate_generic_plan

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
        "PLACEMENT TEST HISTORY (JSON):\n"
        f"{history_str}\n\n"
        "Based on their answers (including essay text, transcripts of their speech, and multiple-choice selections), "
        "determine their precise CEFR level (A1, A2, B1, B2, or C1).\n\n"
        "Be rigorous, particularly regarding writing and speaking competence. "
        "Forgive minor Speech-to-Text transcription errors.\n\n"
        "If the user indicates they cannot answer anymore (e.g. user_answer is null or a special marker), "
        "treat that as evidence the subsequent questions are above their level.\n\n"
        "Return ONLY minified JSON, no markdown formatting:\n"
        '{"deduced_level":"...", "level_analysis":"...one sentence summary of the reasoning..."}'
    )
    
    # Use the user's provided API key to call the LLM for grading
    system_prompt = "You are a senior German language assessment expert grading a placement exam."
    
    try:
        raw_llm_response = call_gemini(data.apiKey, [{"role": "user", "content": prompt}], system=system_prompt, max_tokens=2048)
        llm_data, llm_err = parse_json_strict(raw_llm_response)
        if llm_err or not isinstance(llm_data, dict):
            schema_hint = '{"deduced_level":"A2","level_analysis":"one sentence"}'
            fix_prompt = build_fix_json_prompt(bad_json=raw_llm_response, schema_hint=schema_hint)
            fixed = call_gemini(
                data.apiKey,
                [{"role": "user", "content": fix_prompt}],
                system="You output valid minified JSON only.",
                max_tokens=2048,
            )
            llm_data, llm_err = parse_json_strict(fixed)
        if llm_err or not isinstance(llm_data, dict):
            raise ValueError("Placement grading JSON invalid: " + (llm_err or "not an object"))
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

    # Create & persist a generic progression plan (current level -> next level)
    try:
        gp_prompt = build_generic_plan_prompt(profile=profile, placement_summary=llm_data)
        gp_raw = call_gemini(
            data.apiKey,
            [{"role": "user", "content": gp_prompt}],
            system="You design robust language learning curricula and you strictly output valid JSON.",
            max_tokens=2048,
        )
        gp_obj, gp_err = parse_json_strict(gp_raw)
        if gp_err:
            schema_hint = (
                '{"from_level":"A2","to_level":"B1","daily_minutes":30,"estimated_days":90,'
                '"vocab_words_per_day":12,"grammar_sequence":["..."],'
                '"reading_themes":["..."],"roleplay_themes":["..."],"notes":"..."}'
            )
            fix_prompt = build_fix_json_prompt(bad_json=gp_raw, schema_hint=schema_hint)
            gp_fixed = call_gemini(
                data.apiKey,
                [{"role": "user", "content": fix_prompt}],
                system="You output valid minified JSON only.",
                max_tokens=2048,
            )
            gp_obj, gp_err = parse_json_strict(gp_fixed)
        plan, plan_errs = validate_generic_plan(gp_obj)
        if plan_errs:
            raise ValueError("GenericPlan validation failed: " + "; ".join(plan_errs))
        write_json("generic_plan.json", plan.to_dict())
    except Exception as e:
        # Non-fatal: the app can still run, and /plan/today can regenerate later.
        logs = read_json("daily_logs.json")
        logs.append({"date": datetime.now().isoformat(), "type": "generic_plan_error", "error": str(e)})
        write_json("daily_logs.json", logs)
    
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