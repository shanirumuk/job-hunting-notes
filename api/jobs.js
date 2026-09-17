import { plainText, safeURL, descriptionText } from '../lib/model.js';
let cached;
let pending;
const TTL = 6 * 60 * 60 * 1000;
export async function fetchJobs(fetcher = fetch) {
  const results = await Promise.allSettled([1,2,3].map(async page => {
    const response = await fetcher(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, {signal: AbortSignal.timeout(12000), headers: {'Accept': 'application/json'}});
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid source response');
    return data.data;
  }));
  const successful = results.filter(r => r.status === 'fulfilled');
  if (!successful.length) throw new Error('Job source is temporarily unavailable. Try again later.');
  const seen = new Set();
  const jobs = successful.flatMap(r => r.value).filter(j => {
    if (!j.slug || !j.title || !j.company_name || !safeURL(j.url) || seen.has(j.slug)) return false;
    seen.add(j.slug); return true;
  }).map(j => ({id: `arbeitnow-${j.slug}`, company: plainText(j.company_name), title: plainText(j.title), location: plainText(j.location || 'Location not stated'), remote: !!j.remote, link: safeURL(j.url), description: descriptionText(j.description).slice(0,24000), publishedAt: Number.isFinite(Number(j.created_at)) && Number(j.created_at) > 0 && Number(j.created_at) < 1e11 ? new Date(Number(j.created_at) * 1000).toISOString() : '', source: 'Arbeitnow', fetchedAt: new Date().toISOString()}));
  return {jobs, fetchedAt: new Date().toISOString(), partial: successful.length < results.length, source: 'Arbeitnow'};
}
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error: 'Method not allowed'}); }
  try {
    if (!cached || Date.now() - cached.time > TTL) {
      pending ||= fetchJobs().then(data => { cached = {time: Date.now(), data}; return data; }).finally(() => { pending = null; });
      await pending;
    }
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');
    return res.status(200).json(cached.data);
  } catch {
    if (cached) return res.status(200).json({...cached.data, stale: true});
    return res.status(503).json({error: 'The job feed is unavailable right now. Your saved roles are safe; try refreshing later.'});
  }
}
