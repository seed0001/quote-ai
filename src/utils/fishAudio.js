// Route through the local app server. Direct browser calls to Fish Audio can be
// rejected by cross-origin policy; the Vite proxy keeps the key request local
// to the app origin and forwards it server-side.
const FISH_API_BASE = '/api/fish';

const authHeaders = (apiKey) => ({
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

export async function fetchAllFishVoices(apiKey, onProgress) {
  const voices = [];
  const pageSize = 100;
  let pageNumber = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${FISH_API_BASE}/model`);
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('page_number', String(pageNumber));
    url.searchParams.set('sort_by', 'task_count');

    const response = await fetch(url, { headers: authHeaders(apiKey) });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.message || `Fish Audio voice request failed (${response.status}).`);
    }

    const data = await response.json();
    const pageItems = Array.isArray(data.items) ? data.items : [];
    voices.push(...pageItems);
    hasMore = Boolean(data.has_more) && pageItems.length > 0;
    onProgress?.(voices.length, data.total || voices.length);
    pageNumber += 1;

    // Defensive guard against a malformed pagination response.
    if (pageNumber > 100) break;
  }

  return voices
    .filter((voice) => voice?._id && voice?.state !== 'failed')
    .map((voice) => ({
      id: voice._id,
      title: voice.title || 'Untitled Voice',
      author: voice.author?.nickname || '',
      languages: Array.isArray(voice.languages) ? voice.languages : [],
      tags: Array.isArray(voice.tags) ? voice.tags : [],
      coverImage: voice.cover_image || '',
      visibility: voice.visibility || '',
    }));
}

export async function generateFishSpeech({ apiKey, voiceId, text, model = 's2.1-pro-free' }) {
  if (!voiceId) throw new Error('Choose a Fish Audio voice first.');

  const response = await fetch(`${FISH_API_BASE}/v1/tts`, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
      model,
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: 'mp3',
      normalize: true,
      latency: 'normal',
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || `Fish Audio speech request failed (${response.status}).`);
  }

  return response.blob();
}
