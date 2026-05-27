import type { Thread } from '@/lib/types';

export type ConversationGroupKind = 'active' | 'conversation' | 'recent';
export type ConversationGroupReason = 'delegated' | 'topic' | 'status' | 'recent';

export interface ConversationGroup {
  kind: ConversationGroupKind;
  id: string;
  label: string;
  topic?: string;
  icon?: string;
  reason: ConversationGroupReason;
  threads: Thread[];
}

const PREFIX_STRIP = /^(re:|fw:|fwd:|aw|sv:|antw:)\s*/i;
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'as', 'from', 'not', 'no', 'so', 'if', 'when', 'then', 'than', 'also',
  'just', 'only', 'about', 'up', 'down', 'out', 'more', 'most', 'some', 'all', 'any', 'each',
  'every', 'which', 'what', 'who', 'whom', 'where', 'why', 'how', 'please', 'check', 'continue',
]);

const FIVE_MINS_MS = 5 * 60 * 1000;
const TITLE_SHARED_THRESHOLD = 3;
const TITLE_TIME_WINDOW_MS = 90 * 60 * 1000;

export function significantWords(title: string): Set<string> {
  return new Set(
    title
      .replace(PREFIX_STRIP, '')
      .toLowerCase()
      .split(/[\s\-_,;.!?+/#]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

export function topWords(title: string, count = 3): string {
  return [...significantWords(title)].slice(0, count).join(' ');
}

function sharedWordCount(a: string, b: string): number {
  const wa = significantWords(a);
  const wb = significantWords(b);
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared;
}

function byLastActiveDesc(a: Thread, b: Thread): number {
  const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
  const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
  return bTime - aTime;
}

function newestThread(threads: Thread[]): Thread {
  return [...threads].sort(byLastActiveDesc)[0];
}

function isRecentlyActive(thread: Thread): boolean {
  if (thread.status === 'active') return true;
  if (!thread.lastActive) return false;
  return Date.now() - new Date(thread.lastActive).getTime() < FIVE_MINS_MS;
}

function makeTopicGroup(seed: Thread, threads: Thread[]): ConversationGroup {
  return {
    kind: 'conversation',
    id: `topic-${seed.id}`,
    label: 'Conversation',
    topic: topWords(seed.title, 3) || 'related work',
    icon: '∿',
    reason: 'topic',
    threads: [...threads].sort(byLastActiveDesc),
  } satisfies ConversationGroup;
}

export function buildThreadGroups(threads: Thread[]): ConversationGroup[] {
  if (threads.length === 0) return [];

  const unpinned = threads.filter((t) => !t.pinned);
  const groupedIds = new Set<string>();
  const groups: ConversationGroup[] = [];

  // Explicit delegation/parent-child bundles win over title heuristics.
  for (const parent of [...unpinned].sort(byLastActiveDesc)) {
    if (groupedIds.has(parent.id)) continue;
    const children = (parent.linkedChildren ?? [])
      .map((id) => threads.find((t) => t.id === id))
      .filter((t): t is Thread => !!t);
    if (children.length === 0) continue;

    const bundle = [parent, ...children].sort(byLastActiveDesc);
    bundle.forEach((t) => groupedIds.add(t.id));
    groups.push({
      kind: 'conversation',
      id: `delegated-${parent.id}`,
      label: 'Delegated bundle',
      topic: topWords(parent.title, 3) || 'lane work',
      icon: '↱',
      reason: 'delegated',
      threads: bundle,
    });
  }

  // Topic bundles: duplicate/continued sessions become one visible conversation.
  const candidates = unpinned
    .filter((t) => !groupedIds.has(t.id))
    .sort(byLastActiveDesc);

  for (const seed of candidates) {
    if (groupedIds.has(seed.id)) continue;
    const seedTime = seed.lastActive ? new Date(seed.lastActive).getTime() : 0;
    const group: Thread[] = [seed];

    for (const other of candidates) {
      if (other.id === seed.id || groupedIds.has(other.id)) continue;
      const otherTime = other.lastActive ? new Date(other.lastActive).getTime() : 0;
      if (Math.abs(seedTime - otherTime) > TITLE_TIME_WINDOW_MS) continue;
      if (sharedWordCount(seed.title, other.title) >= TITLE_SHARED_THRESHOLD) {
        group.push(other);
      }
    }

    if (group.length >= 2) {
      group.forEach((t) => groupedIds.add(t.id));
      groups.push(makeTopicGroup(seed, group));
    }
  }

  const activeSingles = unpinned
    .filter((t) => !groupedIds.has(t.id) && isRecentlyActive(t))
    .sort(byLastActiveDesc);
  if (activeSingles.length > 0) {
    activeSingles.forEach((t) => groupedIds.add(t.id));
    groups.unshift({
      kind: 'active',
      id: 'group-active',
      label: 'Active singles',
      reason: 'status',
      threads: activeSingles,
    });
  }

  const remaining = unpinned
    .filter((t) => !groupedIds.has(t.id))
    .sort(byLastActiveDesc);
  if (remaining.length > 0) {
    groups.push({
      kind: 'recent',
      id: 'group-recent',
      label: 'Separate sessions',
      reason: 'recent',
      threads: remaining,
    });
  }

  return groups.sort((a, b) => {
    if (a.kind === 'active') return -1;
    if (b.kind === 'active') return 1;
    const aTime = newestThread(a.threads).lastActive ? new Date(newestThread(a.threads).lastActive).getTime() : 0;
    const bTime = newestThread(b.threads).lastActive ? new Date(newestThread(b.threads).lastActive).getTime() : 0;
    return bTime - aTime;
  });
}

export function getConversationBundle(threads: Thread[], threadId: string): ConversationGroup | null {
  const groups = buildThreadGroups(threads);
  return groups.find((group) => group.threads.some((thread) => thread.id === threadId)) ?? null;
}
