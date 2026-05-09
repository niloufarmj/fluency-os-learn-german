import json
import os
import re
from typing import Any, Optional, Tuple
from fastapi import HTTPException
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

def _path(filename: str) -> str:
    return os.path.join(DATA_DIR, filename)

def read_json(filename: str):
    p = _path(filename)
    if not os.path.exists(p):
        if filename == "cache.json": return {}
        if filename in ("vocab.json", "daily_logs.json", "resources.json"): return []
        if filename in ("daily_plans.json", "daily_progress.json"): return {}
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(filename: str, data):
    with open(_path(filename), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def strip_fences(text: str) -> str:
    match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if match:
        return match.group(1)
    return text.strip()


def parse_json_strict(text: str) -> Tuple[Any, str]:
    """
    Parse JSON from an LLM response. Returns (obj, '') on success, (None, error_message) on failure.
    """
    try:
        return json.loads(strip_fences(text)), ""
    except Exception as e:
        return None, str(e)

def call_gemini(api_key: str, messages: list, system: str = None, max_tokens: int = 1024) -> str:
    try:
        genai.configure(api_key=api_key)
        
        gemini_msgs = []
        if messages and messages[0].get("role") == "assistant":
            gemini_msgs.append({"role": "user", "parts": ["Let's begin."]})
            
        for m in messages:
            role = "model" if m.get("role") == "assistant" else "user"
            content = m.get("content", "")
            if gemini_msgs and gemini_msgs[-1]["role"] == role:
                gemini_msgs[-1]["parts"][0] += f"\n\n{content}"
            else:
                gemini_msgs.append({"role": role, "parts": [content]})
        
        model_kwargs = {"model_name": "gemini-3-flash-preview"}
        if system:
            model_kwargs["system_instruction"] = system
            
        model = genai.GenerativeModel(**model_kwargs)
        
        safety = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        }
        
        response = model.generate_content(
            gemini_msgs, 
            generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens, temperature=0.7), 
            safety_settings=safety
        )
        return response.text
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gemini API Error: {str(e)}")

def require_key(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="API key required. Set it in Settings.")
    return authorization.replace("Bearer ", "").strip()