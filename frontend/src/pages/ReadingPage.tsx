import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { Profile, ReadingResult, TranslateWordResult } from '../utils/types';

type TooltipState =
  | { open: false }
  | {
      open: true;
      x: number;
      y: number;
      word: string;
      loading: boolean;
      adding?: boolean;
      added?: boolean;
      data?: TranslateWordResult;
      error?: string;
    };

function wrapWords(text: string) {
  const paras = text.split(/\n+/).filter((p) => p.trim());
  return paras
    .map((p) => {
      // Wrap German-ish words (same as legacy)
      const wrapped = p.replace(/([a-zA-ZäöüÄÖÜß\-]+)/g, (m) => `<span class="w" data-w="${m}">${m}</span>`);
      return `<p>${wrapped}</p>`;
    })
    .join('');
}

export function ReadingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ open: false });

  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await apiGet<Profile>('/profile');
        if (!mounted) return;
        setProfile(p);
      } catch {
        setProfile({ level: 'A2' });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const articleHtml = useMemo(() => wrapWords(result?.article || ''), [result?.article]);

  async function generate() {
    const t = topic.trim();
    if (!t) return;
    setError(null);
    setLoading(true);
    setResult(null);
    setTooltip({ open: false });
    try {
      const level = profile?.level || 'A2';
      const d = await apiPost<ReadingResult>('/generate-reading', { topic: t, level });
      setResult(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function lookupWord(word: string, x: number, y: number) {
    setTooltip({ open: true, word, x, y, loading: true, adding: false, added: false });
    try {
      const d = await apiPost<TranslateWordResult>('/translate-word', { word, level: profile?.level || 'A2' });
      setTooltip({ open: true, word, x, y, loading: false, adding: false, added: false, data: d });
    } catch (e) {
      setTooltip({ open: true, word, x, y, loading: false, adding: false, added: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('#word-tooltip')) return;
      if (target.closest('.w')) return;
      setTooltip({ open: false });
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const span = t?.closest('.w') as HTMLElement | null;
      if (!span) return;
      const word = span.dataset.w || span.textContent || '';
      const vx = (e as MouseEvent).clientX;
      const vy = (e as MouseEvent).clientY;
      const x = Math.min(vx, window.innerWidth - 290);
      const y = Math.min(vy + 12, window.innerHeight - 150);
      void lookupWord(word, x, y);
    }
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [profile?.level]);

  return (
    <div>
      <h2 className="module-title">Reading</h2>
      <p className="module-sub">AI-generated articles — click any word for instant translation</p>

      <div className="card mb-16">
        <div className="section-label">Generate Article</div>
        <div className="flex gap-8">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. hiking the Alps, Berlin street food…" />
          <button className="btn btn-primary" onClick={() => void generate()} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {error ? <div className="msg-box msg-error">{error}</div> : null}

      <div id="read-body" ref={bodyRef}>
        {!result ? null : (
          <>
            <div className="card">
              <div className="section-label">Article</div>
              <div className="article-body" dangerouslySetInnerHTML={{ __html: articleHtml }} />
            </div>
            <div className="card mt-12">
              <div className="section-label">Comprehension Questions</div>
              {result.questions?.length ? (
                result.questions.map((q, i) => <Question key={i} q={q.q} a={q.a} idx={i} />)
              ) : (
                <p className="text-muted text-sm">No questions available.</p>
              )}
            </div>
          </>
        )}
      </div>

      {tooltip.open ? (
        <div
          id="word-tooltip"
          style={{
            display: 'block',
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="tt-word">{tooltip.data?.word || tooltip.word}</div>
          <div className="tt-pos">{tooltip.data?.part_of_speech || ''}</div>
          <div className="text-sm mb-8">
            {tooltip.loading ? 'Looking up…' : tooltip.error ? tooltip.error : tooltip.data?.translation || ''}
          </div>
          <button
            className="btn btn-primary btn-sm full-w mt-8"
            disabled={tooltip.loading || !!tooltip.error || !tooltip.data || tooltip.adding || tooltip.added}
            onClick={() => {
              if (!tooltip.data) return;
              const w = tooltip.data.word || tooltip.word;
              const level = profile?.level || 'A2';
              setTooltip((t) => (t.open ? { ...t, adding: true } : t));
              void apiPost('/vocab/add', { word: w, level })
                .then(() => setTooltip((t) => (t.open ? { ...t, adding: false, added: true } : t)))
                .catch((e) =>
                  setTooltip((t) =>
                    t.open ? { ...t, adding: false, error: e instanceof Error ? e.message : String(e) } : t,
                  ),
                );
            }}
          >
            {tooltip.added ? 'Added ✓' : tooltip.adding ? 'Adding…' : '➕ Add to Deck'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Question({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="question-item">
      <div className="q-text">
        {idx + 1}. {q}
      </div>
      <div className="reveal-btn" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide answer ▴' : 'Show answer ▾'}
      </div>
      {open ? <div className="a-text">{a}</div> : null}
    </div>
  );
}

