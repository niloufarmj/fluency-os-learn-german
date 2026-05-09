from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Header, HTTPException
from pydantic import BaseModel

from planning.prompts import (
    build_end_of_day_test_prompt,
    build_fix_json_prompt,
    build_grade_end_of_day_test_prompt,
)
from utils import call_gemini, parse_json_strict, read_json, require_key, write_json

router = APIRouter()


def _iso_today() -> str:
    return date.today().isoformat()


def _load_map(filename: str) -> Dict[str, Any]:
    obj = read_json(filename)
    return obj if isinstance(obj, dict) else {}


def _save_map(filename: str, obj: Dict[str, Any]) -> None:
    write_json(filename, obj)


def _first_incomplete_date(progress_map: Dict[str, Any]) -> Optional[str]:
    # Return earliest date (lexicographic ISO) that is not completed
    for d in sorted(progress_map.keys()):
        p = progress_map.get(d) or {}
        if not isinstance(p, dict):
            return d
        if not p.get("completed"):
            return d
    return None


def _ensure_progress_entry(progress_map: Dict[str, Any], d: str) -> Dict[str, Any]:
    if d not in progress_map or not isinstance(progress_map.get(d), dict):
        progress_map[d] = {
            "tasks": {"vocab": False, "grammar": False, "reading": False, "roleplay": False},
            "minutes_tracked": 0,
            "test": {"generated": False, "completed": False, "score": None, "attempts": 0},
            "completed": False,
            "created_at": datetime.now().isoformat(),
        }
    return progress_map[d]


def _compute_day_index(daily_plans_map: Dict[str, Any], effective_date: str) -> int:
    # 0-based index by sorted date keys (stable enough for local single-user)
    keys = sorted([k for k in daily_plans_map.keys() if isinstance(k, str)])
    if effective_date in keys:
        return keys.index(effective_date)
    # If not present, assume next
    return len(keys)


def _build_daily_plan_prompt(*, profile: Dict[str, Any], generic_plan: Dict[str, Any], effective_date: str, day_index: int) -> str:
    constraints = {
        "date": effective_date,
        "day_index": day_index,
        "from_level": profile.get("level"),
        "daily_minutes": profile.get("daily_time_minutes", 30),
        "priorities": profile.get("priorities", []),
        "generic_plan": generic_plan,
    }
    return (
        "You are an expert German language tutor and curriculum generator.\n"
        "Generate READY-TO-STUDY content for exactly one study day, strictly aligned with the provided generic plan.\n"
        "The output must include:\n"
        "- vocab list with translations and 3 example sentences each\n"
        "- grammar mini-lesson with explanation, 2–4 examples, and exactly 5 fill-in exercises\n"
        "- one reading story (250–400 words) and 3 comprehension questions with answers\n"
        "- one roleplay scenario with an opening line and 8–12 suggested phrases\n"
        "- 3 YouTube resources (title, channel, url as embed link, and why_relevant)\n"
        "- end_of_day_test_blueprint: topics + what to test\n\n"
        "Return ONLY minified JSON, no markdown, no backticks.\n"
        "CONSTRAINTS(JSON):\n"
        f"{json.dumps(constraints, ensure_ascii=False)}\n\n"
        "SCHEMA:\n"
        "{"
        '"date":"2026-05-09",'
        '"level":"A2",'
        '"focus":"short string",'
        '"vocab":[{"word":"...","translation":"...","part_of_speech":"...","examples":["...","...","..."]}],'
        '"grammar":{"topic":"...","explanation":"...","examples":["..."],"exercises":[{"sentence":"... ___ ...","answer":"...","hint":"..."}]},'
        '"reading":{"title":"...","theme":"...","article":"...","questions":[{"q":"...","a":"..."}]},'
        '"roleplay":{"scenario_title":"...","opening":"...","target_phrases":["..."]},'
        '"youtube":[{"title":"...","channel":"...","url":"https://www.youtube.com/embed/VIDEOID","why_relevant":"..."}],'
        '"end_of_day_test_blueprint":{"topics":["..."],"instructions":"..."}'
        "}"
    )


@router.get("/plan/today")
def get_plan_today(authorization: Optional[str] = Header(None)):
    api_key = require_key(authorization)

    profile = read_json("user_profile.json")
    generic_plan = read_json("generic_plan.json")
    if not isinstance(generic_plan, dict) or not generic_plan:
        raise HTTPException(status_code=400, detail="Generic plan missing. Please re-run onboarding.")

    daily_plans = _load_map("daily_plans.json")
    progress = _load_map("daily_progress.json")

    backlog_date = _first_incomplete_date(progress)
    effective_date = backlog_date or _iso_today()

    _ensure_progress_entry(progress, effective_date)
    _save_map("daily_progress.json", progress)

    if effective_date in daily_plans and isinstance(daily_plans[effective_date], dict):
        return {"effective_date": effective_date, "backlog": backlog_date is not None, "plan": daily_plans[effective_date], "progress": progress[effective_date]}

    day_index = _compute_day_index(daily_plans, effective_date)
    prompt = _build_daily_plan_prompt(profile=profile, generic_plan=generic_plan, effective_date=effective_date, day_index=day_index)
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}], system="You output valid minified JSON only.", max_tokens=4096)
    obj, err = parse_json_strict(raw)
    if err:
        schema_hint = '{"date":"YYYY-MM-DD","level":"A2","focus":"...","vocab":[{"word":"...","translation":"...","part_of_speech":"...","examples":["..."]}],"grammar":{"topic":"...","explanation":"...","examples":["..."],"exercises":[{"sentence":"... ___ ...","answer":"...","hint":"..."}]},"reading":{"title":"...","theme":"...","article":"...","questions":[{"q":"...","a":"..."}]},"roleplay":{"scenario_title":"...","opening":"...","target_phrases":["..."]},"youtube":[{"title":"...","channel":"...","url":"https://www.youtube.com/embed/VIDEOID","why_relevant":"..."}],"end_of_day_test_blueprint":{"topics":["..."],"instructions":"..."}}'
        fix_prompt = build_fix_json_prompt(bad_json=raw, schema_hint=schema_hint)
        fixed = call_gemini(api_key, [{"role": "user", "content": fix_prompt}], system="You output valid minified JSON only.", max_tokens=4096)
        obj, err = parse_json_strict(fixed)
    if err or not isinstance(obj, dict):
        raise HTTPException(status_code=400, detail=f"Failed to generate daily plan JSON: {err or 'not an object'}")

    daily_plans[effective_date] = obj
    _save_map("daily_plans.json", daily_plans)
    return {"effective_date": effective_date, "backlog": backlog_date is not None, "plan": obj, "progress": progress[effective_date]}


class ProgressUpdate(BaseModel):
    date: str
    task: str  # vocab|grammar|reading|roleplay
    completed: bool = True


@router.post("/plan/progress")
def update_progress(req: ProgressUpdate):
    progress = _load_map("daily_progress.json")
    entry = _ensure_progress_entry(progress, req.date)
    tasks = entry.get("tasks") or {}
    if not isinstance(tasks, dict):
        tasks = {}
    tasks[req.task] = bool(req.completed)
    entry["tasks"] = tasks

    if all(bool(tasks.get(k)) for k in ["vocab", "grammar", "reading", "roleplay"]) and entry.get("test", {}).get("completed"):
        entry["completed"] = True

    _save_map("daily_progress.json", progress)
    return entry


@router.post("/plan/test/generate")
def generate_test(date_str: str = Body(..., embed=True), authorization: Optional[str] = Header(None)):
    api_key = require_key(authorization)
    daily_plans = _load_map("daily_plans.json")
    if date_str not in daily_plans or not isinstance(daily_plans[date_str], dict):
        raise HTTPException(status_code=404, detail="Daily plan not found for date.")

    progress = _load_map("daily_progress.json")
    entry = _ensure_progress_entry(progress, date_str)
    test_state = entry.get("test") or {}
    if not isinstance(test_state, dict):
        test_state = {"generated": False, "completed": False, "score": None, "attempts": 0}

    # idempotent: if already generated, return it
    existing = test_state.get("test")
    if test_state.get("generated") and isinstance(existing, dict):
        return existing

    prompt = build_end_of_day_test_prompt(daily_plan=daily_plans[date_str])
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}], system="You output valid minified JSON only.", max_tokens=4096)
    obj, err = parse_json_strict(raw)
    if err:
        schema_hint = '{"questions":[{"type":"mc","prompt":"...","options":["..."],"answer_index":0,"explanation":"..."}],"pass_score":70}'
        fix_prompt = build_fix_json_prompt(bad_json=raw, schema_hint=schema_hint)
        fixed = call_gemini(api_key, [{"role": "user", "content": fix_prompt}], system="You output valid minified JSON only.", max_tokens=4096)
        obj, err = parse_json_strict(fixed)
    if err or not isinstance(obj, dict):
        raise HTTPException(status_code=400, detail=f"Failed to generate test JSON: {err or 'not an object'}")

    test_state["generated"] = True
    test_state["test"] = obj
    entry["test"] = test_state
    progress[date_str] = entry
    _save_map("daily_progress.json", progress)
    return obj


class TestSubmit(BaseModel):
    date: str
    answers: Dict[str, Any]


@router.post("/plan/test/submit")
def submit_test(req: TestSubmit, authorization: Optional[str] = Header(None)):
    api_key = require_key(authorization)
    progress = _load_map("daily_progress.json")
    entry = _ensure_progress_entry(progress, req.date)
    test_state = entry.get("test") or {}
    if not isinstance(test_state, dict) or not test_state.get("generated") or not isinstance(test_state.get("test"), dict):
        raise HTTPException(status_code=400, detail="Test not generated for this date.")

    test_obj = test_state["test"]
    profile = read_json("user_profile.json")
    level = str(profile.get("level") or "A2")

    prompt = build_grade_end_of_day_test_prompt(test=test_obj, user_answers=req.answers, level=level)
    raw = call_gemini(api_key, [{"role": "user", "content": prompt}], system="You output valid minified JSON only.", max_tokens=4096)
    result, err = parse_json_strict(raw)
    if err or not isinstance(result, dict):
        raise HTTPException(status_code=400, detail=f"Failed to grade test JSON: {err or 'not an object'}")

    attempts = int(test_state.get("attempts") or 0) + 1
    test_state["attempts"] = attempts
    test_state["completed"] = bool(result.get("pass"))
    test_state["score"] = result.get("score")
    test_state["last_result"] = result
    entry["test"] = test_state

    tasks = entry.get("tasks") or {}
    if not isinstance(tasks, dict):
        tasks = {}
    if all(bool(tasks.get(k)) for k in ["vocab", "grammar", "reading", "roleplay"]) and test_state["completed"]:
        entry["completed"] = True

    progress[req.date] = entry
    _save_map("daily_progress.json", progress)

    # Persist to logs for visibility
    logs = read_json("daily_logs.json")
    logs.append({"date": datetime.now().isoformat(), "type": "end_of_day_test", "plan_date": req.date, "result": result})
    write_json("daily_logs.json", logs)

    return {"progress": entry, "result": result}

