import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { DailyPlanDetailed, Profile, ReadingResult, TranslateWordResult } from '../utils/types';

type Tab = 'today' | 'library' | 'generate';

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

type StoredStory = {
  id: string;
  title: string;
  theme: string;
  date: string;
  level: string;
  article: string;
  questions: Array<{ q: string; a: string }>;
  icon: string;
};

const STORY_ICONS = ['📖', '🌍', '☕', '🏔️', '🎭', '🌿', '🏙️', '✈️'];

function todayIso() {
  return new Date().toISOString().split('T')[0]!;
}

function wrapWords(text: string) {
  const paras = text.split(/\n+/).filter((p) => p.trim());
  return paras
    .map((p) => {
      const wrapped = p.replace(
        /([a-zA-ZäöüÄÖÜß\-]+)/g,
        (m) => `<span class="w" data-w="${m}">${m}</span>`,
      );
      return `<p>${wrapped}</p>`;
    })
    .join('');
}

function loadLibrary(): StoredStory[] {
  try {
    const raw = localStorage.getItem('fluency_reading_library');
    return raw ? (JSON.parse(raw) as StoredStory[]) : [];
  } catch {
    return [];
  }
}

function saveToLibrary(story: StoredStory) {
  const lib = loadLibrary().filter((s) => s.id !== story.id);
  lib.unshift(story);
  localStorage.setItem('fluency_reading_library', JSON.stringify(lib.slice(0, 20)));
}

export function ReadingPage() {
  const [tab, setTab] = useState<Tab>('today');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<DailyPlanDetailed | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // Library state
  const [library, setLibrary] = useState<StoredStory[]>([]);
  const [activeStory, setActiveStory] = useState<StoredStory | null>(null);

  // Generate tab state
  const [genTopic, setGenTopic] = useState('');
  const [genResult, setGenResult] = useState<ReadingResult | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Word tooltip (shared across tabs)
  const [tooltip, setTooltip] = useState<TooltipState>({ open: false });

  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, planData] = await Promise.all([
          apiGet<Profile>('/profile').catch(() => ({ level: 'A2' } as Profile)),
          apiGet<{ plan: DailyPlanDetailed }>('/plan/today').catch(() => null),
        ]);
        if (!mounted) return;
        setProfile(p);
        if (planData) {
          const pl = planData.plan;
          setPlan(pl);
          // Save today's story to library
          const todayStory: StoredStory = {
            id: `plan-${pl.date || todayIso()}`,
            title: pl.reading.title,
            theme: pl.reading.theme,
            date: pl.date || todayIso(),
            level: pl.level,
            article: pl.reading.article,
            questions: pl.reading.questions,
            icon: '📅',
          };
          saveToLibrary(todayStory);
        }
        setLibrary(loadLibrary());
      } catch {
        setProfile({ level: 'A2' });
      } finally {
        if (mounted) setPlanLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const articleHtml = useMemo(() => {
    const text = activeStory?.article || '';
    return wrapWords(text);
  }, [activeStory?.article]);

  // Word click on article
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const span = t?.closest('.w') as HTMLElement | null;
      if (!span) return;
      const word = span.dataset.w || span.textContent || '';
      // Get the full sentence so the backend can detect separable verbs
      const para = span.closest('p');
      const sentence = para?.textContent?.trim() || undefined;
      const vx = (e as MouseEvent).clientX;
      const vy = (e as MouseEvent).clientY;
      const x = Math.min(vx, window.innerWidth - 290);
      const y = Math.min(vy + 12, window.innerHeight - 150);
      void lookupWord(word, x, y, sentence);
    }
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [profile?.level, activeStory]);

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

  async function lookupWord(word: string, x: number, y: number, sentence?: string) {
    setTooltip({ open: true, word, x, y, loading: true, adding: false, added: false });
    try {
      const body: { word: string; level: string; sentence?: string } = { word, level: profile?.level || 'A2' };
      if (sentence) body.sentence = sentence;
      const d = await apiPost<TranslateWordResult>('/translate-word', body);
      setTooltip({ open: true, word, x, y, loading: false, adding: false, added: false, data: d });
    } catch (e) {
      setTooltip({
        open: true,
        word,
        x,
        y,
        loading: false,
        adding: false,
        added: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function generate() {
    const t = genTopic.trim();
    if (!t) return;
    setGenError(null);
    setGenLoading(true);
    setGenResult(null);
    setTooltip({ open: false });
    try {
      const level = profile?.level || 'A2';
      const d = await apiPost<ReadingResult>('/generate-reading', { topic: t, level });
      setGenResult(d);
      // Save to library
      const story: StoredStory = {
        id: `gen-${Date.now()}`,
        title: t,
        theme: t,
        date: todayIso(),
        level,
        article: d.article || '',
        questions: d.questions || [],
        icon: STORY_ICONS[Math.floor(Math.random() * STORY_ICONS.length)] || '📖',
      };
      saveToLibrary(story);
      setLibrary(loadLibrary());
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenLoading(false);
    }
  }

  function openStory(story: StoredStory) {
    setActiveStory(story);
    setTooltip({ open: false });
  }

  function closeStory() {
    setActiveStory(null);
    setTooltip({ open: false });
  }

  // Reading view (shared between tabs when a story is active)
  if (activeStory) {
    return (
      <div>
        <button className="back-link" onClick={closeStory}>← Back</button>

        <div className="flex items-center gap-12" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: '2rem' }}>{activeStory.icon}</span>
          <div>
            <div className="text-xs text-muted uppercase" style={{ marginBottom: 2 }}>
              {activeStory.level} · {activeStory.date}
            </div>
            <h3 className="serif" style={{ fontSize: '1.6rem', fontWeight: 900 }}>{activeStory.title}</h3>
            <div className="text-sm text-muted">{activeStory.theme}</div>
          </div>
        </div>

        <div ref={bodyRef}>
          <div className="card">
            <div className="section-label">Article</div>
            <div className="article-body" dangerouslySetInnerHTML={{ __html: wrapWords(activeStory.article) }} />
            <div className="text-xs text-muted" style={{ marginTop: 12 }}>
              Click any German word to translate · Use &quot;Add to Deck&quot; to save it
            </div>
          </div>

          {activeStory.questions?.length ? (
            <div className="card mt-12">
              <div className="section-label">Comprehension Questions</div>
              {activeStory.questions.map((q, i) => (
                <Question key={i} q={q.q} a={q.a} idx={i} />
              ))}
            </div>
          ) : null}
        </div>

        {tooltip.open ? <WordTooltip tooltip={tooltip} setTooltip={setTooltip} level={profile?.level || 'A2'} /> : null}
      </div>
    );
  }

  return (
    <div>
      <h2 className="module-title">Reading</h2>
      <p className="module-sub">Read stories that grow with you — click any word for instant translation</p>

      <div className="tab-bar">
        <button className={`tab-btn${tab === 'today' ? ' active' : ''}`} onClick={() => setTab('today')}>
          Today&apos;s Story
        </button>
        <button className={`tab-btn${tab === 'library' ? ' active' : ''}`} onClick={() => setTab('library')}>
          Library {library.length > 0 && <span style={{ marginLeft: 4, background: 'var(--violet-soft)', color: 'var(--violet)', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{library.length}</span>}
        </button>
        <button className={`tab-btn${tab === 'generate' ? ' active' : ''}`} onClick={() => setTab('generate')}>
          Generate
        </button>
      </div>

      {/* ── TODAY'S STORY ── */}
      {tab === 'today' && (
        <div>
          {planLoading ? (
            <div className="spinner-wrap"><div className="spinner" /> Loading today&apos;s story…</div>
          ) : !plan ? (
            <div className="msg-box msg-info">Could not load today&apos;s plan. Check your API key in Settings.</div>
          ) : (
            <>
              <div className="today-focus-bar">
                <span style={{ fontSize: 20 }}>📖</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--mint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Today&apos;s Reading
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{plan.reading.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Theme: {plan.reading.theme}</div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ marginBottom: 20 }}
                onClick={() =>
                  openStory({
                    id: `plan-${plan.date}`,
                    title: plan.reading.title,
                    theme: plan.reading.theme,
                    date: plan.date,
                    level: plan.level,
                    article: plan.reading.article,
                    questions: plan.reading.questions,
                    icon: '📅',
                  })
                }
              >
                Open Story →
              </button>

              <div className="card">
                <div className="section-label">Preview</div>
                <div
                  className="article-body"
                  style={{ maxHeight: 200, overflow: 'hidden', position: 'relative' }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.8 }}>
                    {plan.reading.article.slice(0, 400)}…
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 60,
                      background: 'linear-gradient(transparent, var(--bg-elev))',
                    }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() =>
                    openStory({
                      id: `plan-${plan.date}`,
                      title: plan.reading.title,
                      theme: plan.reading.theme,
                      date: plan.date,
                      level: plan.level,
                      article: plan.reading.article,
                      questions: plan.reading.questions,
                      icon: '📅',
                    })
                  }
                >
                  Read full story →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LIBRARY ── */}
      {tab === 'library' && (
        <div>
          {library.length === 0 ? (
            <div className="msg-box msg-info">
              Your library is empty. Read today&apos;s story or generate new articles to fill it.
            </div>
          ) : (
            <div className="library-grid">
              {library.map((story) => (
                <div
                  key={story.id}
                  className="library-card"
                  onClick={() => openStory(story)}
                >
                  <div className="library-card-icon">{story.icon}</div>
                  <div className="library-card-info">
                    <div className="library-card-title">{story.title}</div>
                    <div className="library-card-meta">
                      {story.level} · {story.date} · {story.theme}
                    </div>
                  </div>
                  <span style={{ color: 'var(--violet)', fontWeight: 700 }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GENERATE ── */}
      {tab === 'generate' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-label">Generate New Article</div>
            <div className="flex gap-8">
              <input
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="e.g. hiking the Alps, Berlin street food, German traditions…"
                onKeyDown={(e) => { if (e.key === 'Enter') void generate(); }}
              />
              <button className="btn btn-primary" onClick={() => void generate()} disabled={genLoading}>
                {genLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>

          {genError ? <div className="msg-box msg-error">{genError}</div> : null}

          {genResult ? (
            <>
              <div className="msg-box msg-success">Article generated — saved to your library!</div>
              <button
                className="btn btn-primary"
                style={{ margin: '12px 0' }}
                onClick={() => {
                  const story = library[0];
                  if (story) openStory(story);
                }}
              >
                Open article →
              </button>
            </>
          ) : null}

          {!genResult && !genLoading && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✍️</div>
              <div className="serif" style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
                Generate a custom article
              </div>
              <div className="text-sm text-muted">
                Type any topic above and get a German article at your level ({profile?.level || 'A2'}) with comprehension questions.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WordTooltip({
  tooltip,
  setTooltip,
  level,
}: {
  tooltip: TooltipState & { open: true };
  setTooltip: (s: TooltipState) => void;
  level: string;
}) {
  return (
    <div
      id="word-tooltip"
      style={{ display: 'block', left: tooltip.x, top: tooltip.y }}
    >
      <div className="tt-word">{tooltip.data?.word || tooltip.word}</div>
      <div className="tt-pos">{tooltip.data?.part_of_speech || ''}</div>
      <div className="text-sm mb-8">
        {tooltip.loading
          ? 'Looking up…'
          : tooltip.error
          ? tooltip.error
          : tooltip.data?.translation || ''}
      </div>
      <button
        className="btn btn-primary btn-sm full-w mt-8"
        disabled={tooltip.loading || !!tooltip.error || !tooltip.data || tooltip.adding || tooltip.added}
        onClick={() => {
          if (!tooltip.data) return;
          const w = tooltip.data.word || tooltip.word;
          setTooltip({ ...tooltip, adding: true });
          void apiPost('/vocab/add', { word: w, level })
            .then(() => setTooltip({ ...tooltip, adding: false, added: true }))
            .catch((e) =>
              setTooltip({
                ...tooltip,
                adding: false,
                error: e instanceof Error ? e.message : String(e),
              }),
            );
        }}
      >
        {tooltip.added ? 'Added ✓' : tooltip.adding ? 'Adding…' : '➕ Add to Deck'}
      </button>
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
