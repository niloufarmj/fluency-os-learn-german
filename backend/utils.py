import json
import os
from typing import Optional
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
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(filename: str, data):
    with open(_path(filename), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")[1:]
        while lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

def call_gemini(api_key: str, messages: list, system: str = None, max_tokens: int = 1024) -> str:
    genai.configure(api_key=api_key)
    gemini_msgs = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [m["content"]]} for m in messages]
    model = genai.GenerativeModel(model_name="gemini-1.5-flash", system_instruction=system)
    
    safety = {
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }
    
    response = model.generate_content(gemini_msgs, generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens, temperature=0.7), safety_settings=safety)
    return response.text

def require_key(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="API key required. Set it in Settings.")
    return authorization.replace("Bearer ", "").strip()