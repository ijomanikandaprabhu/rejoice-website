import type { TrafficSource } from '@/services/youtube/analyticsService';

/**
 * Where the views came from, as a 100%-stacked bar plus a legend.
 *
 * Not a donut: the useful question is "what share is search versus suggested",
 * and a single stacked bar answers it while staying readable at panel width and
 * needing no chart library. A donut would spend more pixels saying the same
 * thing less precisely.
 */

/** YouTube's dimension values are constants, not prose. */
const LABELS: Record<string, string> = {
  YT_SEARCH: 'YouTube search',
  RELATED_VIDEO: 'Suggested videos',
  NO_LINK_OTHER: 'Direct or unknown',
  NO_LINK_EMBEDDED: 'External embeds',
  EXT_URL: 'External links',
  SUBSCRIBER: 'Subscriptions feed',
  PLAYLIST: 'Playlists',
  YT_CHANNEL: 'Channel pages',
  NOTIFICATION: 'Notifications',
  SHORTS: 'Shorts feed',
  HASHTAGS: 'Hashtags',
  ADVERTISING: 'Advertising',
  PROMOTED: 'Promoted',
  CAMPAIGN_CARD: 'Campaign cards',
  END_SCREEN: 'End screens',
  ANNOTATION: 'Cards and annotations',
};

/*
 * Ranked, not decorated: lime for the largest source, violet for the second,
 * then neutral greys stepping down. That is the admin's two-colour rule — lime
 * is the peak, violet is the runner-up — and it is what stops either reading as
 * decoration.
 *
 * Both are fills with no text on them, which is the only way the violet may be
 * used: it measures 3.0-3.5:1 against these panels, enough for a shape and not
 * enough for type.
 */
const FILLS = ['#D6FF3F', '#683FFF', '#3A3A3C', '#2E2E2F', '#252526'];

export function TrafficSources({ sources }: { sources: TrafficSource[] }) {
  const total = sources.reduce((n, s) => n + s.views, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-panel-muted">
        No traffic data for this period.
      </p>
    );
  }

  // Everything past the top four is a long tail of single-digit percentages
  // that would render as invisible slivers, so it is summed into one segment.
  const top = sources.slice(0, 4);
  const restViews = total - top.reduce((n, s) => n + s.views, 0);
  const segments = restViews > 0 ? [...top, { source: 'OTHER', views: restViews }] : top;

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-pill" role="presentation">
        {segments.map((segment, i) => (
          <span
            key={segment.source}
            className="h-full"
            style={{
              width: `${(segment.views / total) * 100}%`,
              backgroundColor: FILLS[i] ?? FILLS[FILLS.length - 1],
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {segments.map((segment, i) => (
          <li key={segment.source} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: FILLS[i] ?? FILLS[FILLS.length - 1] }}
            />
            <span className="min-w-0 flex-1 truncate text-panel-muted">
              {segment.source === 'OTHER'
                ? 'Everything else'
                : (LABELS[segment.source] ?? segment.source)}
            </span>
            <span className="shrink-0 tabular-nums text-panel-fg">
              {Math.round((segment.views / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
