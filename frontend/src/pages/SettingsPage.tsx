import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { Profile } from '../utils/types';
import { useApp } from '../state/AppState';
import { useTheme } from '../state/useTheme';

export function SettingsPage() {
  const { apiKey, setApiKey, refreshProfile } = useApp();
  const { getTheme, setTheme } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('A2');
  const [time, setTime] = useState(30);
  const [key, setKey] = useState(apiKey);

  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await apiGet<Profile>('/profile');
        if (!mounted) return;
        setProfile(p);
        setName(p.name || '');
        setLevel(p.level || 'A2');
        setTime(p.daily_time_minutes || 30);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isDark = getTheme() === 'dark';

  async function testKey() {
    const k = key.trim();
    if (!k) {
      setKeyStatus('Enter an API key first.');
      return;
    }
    setKeyStatus('Testing…');
    setApiKey(k);
    try {
      await apiPost('/generate-vocab-context', { word: 'Hallo', level: 'A1' });
      setKeyStatus('API key is valid!');
    } catch (e) {
      setKeyStatus(`Invalid key or backend error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function save() {
    setSaveStatus('Saving…');
    const k = key.trim();
    if (k) setApiKey(k);

    try {
      const p = await apiPost<Profile>('/profile/update', {
        name: name || undefined,
        level: level || undefined,
        daily_time_minutes: time || undefined,
      });
      setProfile(p);
      setSaveStatus('Settings saved!');
      await refreshProfile();
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <h2 className="module-title">Settings</h2>
      <p className="module-sub">Configure your learning preferences</p>

      <div className="card">
        <div className="setting-group">
          <label className="setting-label">Appearance</label>
          <div className="appearance-btns" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className={`btn ${!isDark ? 'btn-primary' : ''}`} onClick={() => setTheme('light')}>
              ☀️  Light Mode
            </button>
            <button className={`btn ${isDark ? 'btn-primary' : ''}`} onClick={() => setTheme('dark')}>
              🌙  Dark Mode
            </button>
          </div>
        </div>

        <hr className="divider" />

        <div className="setting-group">
          <label className="setting-label">Google Gemini API Key</label>
          <div className="flex gap-8" style={{ display: 'flex', gap: 8 }}>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIzaSy..." />
            <button className="btn" onClick={() => void testKey()}>
              Test
            </button>
          </div>
          {keyStatus ? (
            <div className={`msg-box ${keyStatus.includes('valid') ? 'msg-success' : keyStatus.includes('Testing') ? 'msg-info' : 'msg-error'}`}>
              {keyStatus}
            </div>
          ) : !apiKey ? (
            <div className="msg-box msg-info">Enter your Google Gemini API key to enable all features.</div>
          ) : null}
        </div>

        <hr className="divider" />

        <div className="setting-group">
          <label className="setting-label">Your Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="setting-group">
          <label className="setting-label">CEFR Level</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {['A1', 'A2', 'B1', 'B2'].map((l) => (
              <option key={l} value={l}>
                {l} — {{ A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper Intermediate' }[l as 'A1' | 'A2' | 'B1' | 'B2']}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Daily Time Goal</label>
          <div className="range-row">
            <input
              type="range"
              min={15}
              max={60}
              step={15}
              value={time}
              onChange={(e) => setTime(parseInt(e.target.value, 10))}
            />
            <span className="range-val">{time} min</span>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => void save()}>
          Save Settings
        </button>
        {saveStatus ? (
          <div className={`msg-box ${saveStatus === 'Settings saved!' ? 'msg-success' : saveStatus === 'Saving…' ? 'msg-info' : 'msg-error'}`}>
            {saveStatus}
          </div>
        ) : null}
      </div>
    </div>
  );
}

