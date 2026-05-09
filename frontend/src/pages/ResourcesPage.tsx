import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../utils/api';
import type { DailyPlanDetailed, Resource } from '../utils/types';

type YoutubeResource = { title: string; channel: string; url: string; why_relevant?: string };

export function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [planVideos, setPlanVideos] = useState<YoutubeResource[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const [r, p] = await Promise.all([
          apiGet<Resource[]>('/resources'),
          apiGet<{ plan: DailyPlanDetailed }>('/plan/today').catch(() => null),
        ]);
        if (!mounted) return;
        setResources(r);
        if (p) setPlanVideos(p.plan.youtube);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Group resources by topic
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? resources.filter(
          (r) =>
            r.title?.toLowerCase().includes(q) ||
            r.topic?.toLowerCase().includes(q) ||
            r.channel?.toLowerCase().includes(q),
        )
      : resources;
    const groups: Record<string, Resource[]> = {};
    for (const r of filtered) {
      const topic = r.topic || 'General';
      if (!groups[topic]) groups[topic] = [];
      groups[topic]!.push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [resources, search]);

  const filteredPlanVideos = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return planVideos;
    return planVideos.filter(
      (v) => v.title?.toLowerCase().includes(q) || v.channel?.toLowerCase().includes(q),
    );
  }, [planVideos, search]);

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" /> Loading resources…
      </div>
    );
  }

  return (
    <div>
      <h2 className="module-title">Resources</h2>
      <p className="module-sub">Curated YouTube videos and study materials for your German learning</p>

      {error ? <div className="msg-box msg-error">{error}</div> : null}

      <div className="search-wrap" style={{ marginBottom: 24 }}>
        <span className="search-icon">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources by title, topic, or channel…"
        />
      </div>

      {/* Today's recommended videos */}
      {filteredPlanVideos.length > 0 && (
        <div className="resources-section">
          <div className="resources-section-title">
            <span>📅</span> Today&apos;s Recommended Videos
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {filteredPlanVideos.map((v, i) => (
              <div key={i} className="resource-card">
                <div className="text-xs uppercase text-muted" style={{ marginBottom: 8 }}>
                  {v.channel}
                </div>
                {v.url ? (
                  <iframe
                    width="100%"
                    height="180"
                    src={v.url}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    style={{ borderRadius: 8, border: '1px solid var(--border)' }}
                    allowFullScreen
                    title={v.title}
                  />
                ) : null}
                <div className="text-sm" style={{ marginTop: 10, fontWeight: 700 }}>{v.title}</div>
                {v.why_relevant && (
                  <div className="text-xs text-muted" style={{ marginTop: 6 }}>{v.why_relevant}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources grouped by topic */}
      {grouped.length === 0 && filteredPlanVideos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📺</div>
          <div className="serif" style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
            No resources found
          </div>
          <div className="text-sm text-muted">
            {search ? 'Try a different search term.' : 'Resources will appear here as you learn.'}
          </div>
        </div>
      ) : (
        grouped.map(([topic, items]) => (
          <div key={topic} className="resources-section">
            <div className="resources-section-title">
              <span>📚</span> {topic}
              <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                {items.length} video{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {items.map((r, i) => (
                <div key={i} className="resource-card">
                  <div className="text-xs uppercase text-muted" style={{ marginBottom: 8 }}>
                    {r.channel || 'Unknown'}
                  </div>
                  {r.url ? (
                    <iframe
                      width="100%"
                      height="180"
                      src={r.url}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      style={{ borderRadius: 8, border: '1px solid var(--border)' }}
                      allowFullScreen
                      title={r.title || `resource-${i}`}
                    />
                  ) : null}
                  <div className="text-sm" style={{ marginTop: 10, fontWeight: 700 }}>{r.title || ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
