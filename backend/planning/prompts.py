from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional


def _next_level(level: str) -> str:
    mapping = {"A1": "A2", "A2": "B1", "B1": "B2", "B2": "C1", "C1": "C2"}
    return mapping.get(level, "B1")


def build_generic_plan_prompt(*, profile: Dict[str, Any], placement_summary: Dict[str, Any]) -> str:
    current = str(profile.get("level") or placement_summary.get("deduced_level") or "A2")
    target = _next_level(current)
    daily_minutes = int(profile.get("daily_time_minutes") or 30)
    priorities = profile.get("priorities") or []
    if not isinstance(priorities, list):
        priorities = []

    constraints = {
        "current_level": current,
        "target_level": target,
        "daily_minutes": daily_minutes,
        "priorities": priorities,
        "today": date.today().isoformat(),
    }

    return (
        "You are an expert German curriculum designer.\n"
        "Create a generic, high-level study plan to move the learner from their current CEFR level to the next CEFR level.\n"
        "The plan must include vocabulary, grammar, reading stories, and roleplay practice.\n"
        "It must account for daily time and estimate total days.\n\n"
        "CONSTRAINTS (JSON):\n"
        f"{json.dumps(constraints, ensure_ascii=False)}\n\n"
        "Return ONLY minified JSON. No markdown. No backticks.\n"
        "JSON schema (must match exactly):\n"
        '{'
        '"from_level":"A2",'
        '"to_level":"B1",'
        '"daily_minutes":30,'
        '"estimated_days":90,'
        '"vocab_words_per_day":12,'
        '"grammar_sequence":["topic1","topic2"],'
        '"reading_themes":["theme1","theme2"],'
        '"roleplay_themes":["theme1","theme2"],'
        '"notes":"short advice"'
        '}'
    )


def build_fix_json_prompt(*, bad_json: str, schema_hint: str) -> str:
    return (
        "Fix the following so it becomes valid minified JSON and matches the required schema.\n"
        "Return ONLY minified JSON. No markdown. No backticks.\n\n"
        f"REQUIRED_SCHEMA_HINT:\n{schema_hint}\n\n"
        f"BAD_OUTPUT:\n{bad_json}"
    )


def build_end_of_day_test_prompt(*, daily_plan: Dict[str, Any]) -> str:
    return (
        "You are an expert German teacher.\n"
        "Create an end-of-day test based strictly on the provided daily plan content.\n"
        "The test must verify vocabulary, grammar, and reading comprehension.\n"
        "Return ONLY minified JSON, no markdown, no backticks.\n\n"
        f"DAILY_PLAN(JSON):\n{json.dumps(daily_plan, ensure_ascii=False)}\n\n"
        "SCHEMA:\n"
        "{"
        '"questions":['
        '{"type":"mc","prompt":"...","options":["A","B","C","D"],"answer_index":0,"explanation":"..."},'
        '{"type":"short","prompt":"...","answer":"...","explanation":"..."}'
        "],"
        '"pass_score":70'
        "}"
    )


def build_grade_end_of_day_test_prompt(*, test: Dict[str, Any], user_answers: Dict[str, Any], level: str) -> str:
    payload = {"test": test, "user_answers": user_answers, "level": level}
    return (
        "You are a strict German language assessor.\n"
        "Grade the user's answers against the answer key.\n"
        "Return ONLY minified JSON, no markdown, no backticks.\n\n"
        f"PAYLOAD(JSON):\n{json.dumps(payload, ensure_ascii=False)}\n\n"
        "SCHEMA:\n"
        "{"
        '"score":85,'
        '"pass":true,'
        '"feedback":"one short paragraph",'
        '"corrections":[{"q":0,"why":"...","correct":"..."}]'
        "}"
    )

