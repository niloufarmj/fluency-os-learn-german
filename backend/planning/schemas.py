from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple


CEFR = Literal["A1", "A2", "B1", "B2", "C1", "C2"]


@dataclass
class GenericPlan:
    from_level: str
    to_level: str
    daily_minutes: int
    estimated_days: int
    vocab_words_per_day: int
    grammar_sequence: List[str]
    reading_themes: List[str]
    roleplay_themes: List[str]
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_level": self.from_level,
            "to_level": self.to_level,
            "daily_minutes": self.daily_minutes,
            "estimated_days": self.estimated_days,
            "vocab_words_per_day": self.vocab_words_per_day,
            "grammar_sequence": self.grammar_sequence,
            "reading_themes": self.reading_themes,
            "roleplay_themes": self.roleplay_themes,
            "notes": self.notes,
        }


def validate_generic_plan(obj: Any) -> Tuple[Optional[GenericPlan], List[str]]:
    errs: List[str] = []
    if not isinstance(obj, dict):
        return None, ["generic_plan must be a JSON object"]

    def req_str(k: str) -> str:
        v = obj.get(k)
        if not isinstance(v, str) or not v.strip():
            errs.append(f"missing/invalid '{k}'")
            return ""
        return v.strip()

    def req_int(k: str) -> int:
        v = obj.get(k)
        if not isinstance(v, int):
            errs.append(f"missing/invalid '{k}' (int)")
            return 0
        return v

    def req_str_list(k: str) -> List[str]:
        v = obj.get(k)
        if not isinstance(v, list) or any(not isinstance(x, str) or not x.strip() for x in v):
            errs.append(f"missing/invalid '{k}' (list[str])")
            return []
        return [x.strip() for x in v]

    plan = GenericPlan(
        from_level=req_str("from_level"),
        to_level=req_str("to_level"),
        daily_minutes=req_int("daily_minutes"),
        estimated_days=req_int("estimated_days"),
        vocab_words_per_day=req_int("vocab_words_per_day"),
        grammar_sequence=req_str_list("grammar_sequence"),
        reading_themes=req_str_list("reading_themes"),
        roleplay_themes=req_str_list("roleplay_themes"),
        notes=str(obj.get("notes") or ""),
    )

    if errs:
        return None, errs
    return plan, []

