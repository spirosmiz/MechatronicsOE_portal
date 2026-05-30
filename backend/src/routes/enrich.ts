import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

export interface EnrichedCustomer {
  companyName?: string;
  phone?: string;
  email?: string;
  website?: string;
  vatNumber?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

// ── URL helpers ────────────────────────────────────────────────────────────────

const SHORT_URL_PREFIXES = [
  'https://maps.app.goo.gl/',
  'https://share.google/',
];

function isShortUrl(url: string): boolean {
  return SHORT_URL_PREFIXES.some((p) => url.startsWith(p));
}

async function resolveUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  return res.url;
}

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

function extractPlaceNameFromUrl(url: string): string | null {
  const match = url.match(/\/maps\/place\/([^/@?]+)/);
  if (match) return decodeURIComponent(match[1].replace(/\+/g, ' '));
  return null;
}

// ── Google Maps page scraper ───────────────────────────────────────────────────

// Domains that are definitely not the business website
const NON_BUSINESS = /google|goo\.gl|googleapis|gstatic|googletagmanager|youtube|gmail|ytimg|schema\.org|w3\.org|openstreetmap|facebook\.com|instagram\.com|twitter\.com|linkedin\.com|maps\.app|apple\.com|android\.com|whatsapp|viber|tiktok/i;

function findWebsiteInGmapsHtml(html: string): string | undefined {
  // Google Maps embeds the website URL as a quoted string in its JSON data blobs
  const urlRegex = /"(https?:\/\/[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)+\.[a-zA-Z]{2,}(?:\/[^"\\<>\s]{0,80})?)"/g;
  for (const [, url] of html.matchAll(urlRegex)) {
    if (NON_BUSINESS.test(url)) continue;
    try {
      const parsed = new URL(url);
      // Only homepage-like URLs (no deep paths)
      if (parsed.pathname.split('/').filter(Boolean).length <= 1) return url;
    } catch { /* skip */ }
  }
  return undefined;
}

function findPhoneInGmapsHtml(html: string): string | undefined {
  // tel: link (sometimes present in Maps initial HTML)
  const telMatch = html.match(/href="tel:([^"]+)"/i);
  if (telMatch) return cleanPhone(telMatch[1]);

  // Greek numbers embedded in JSON blobs: "+30 210 1234567" or "+30 6912345678"
  const patterns = [
    /"\+30[\s]?\d{3}[\s]?\d{3}[\s]?\d{4}"/,
    /"\+30[\s]?\d{4}[\s]?\d{6}"/,
    /"\+30[\s]?\d{10}"/,
    /"(2\d{9}|6[0-9]\d{8})"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return cleanPhone(m[0].replace(/^"|"$/g, ''));
  }
  return undefined;
}

async function scrapeGoogleMapsPage(url: string): Promise<{ phone?: string; website?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'el,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return {};
    const html = await res.text();
    return {
      phone:   findPhoneInGmapsHtml(html),
      website: findWebsiteInGmapsHtml(html),
    };
  } catch {
    return {};
  }
}

// ── OpenStreetMap Overpass ─────────────────────────────────────────────────────

interface OverpassElement { tags?: Record<string, string> }

async function queryOverpass(lat: number, lng: number): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:10];(node(around:80,${lat},${lng})["name"];way(around:80,${lat},${lng})["name"];);out body;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json() as { elements: OverpassElement[] };
  return data.elements ?? [];
}

function bestOsmTags(elements: OverpassElement[], hint?: string | null): Record<string, string> | null {
  if (!elements.length) return null;
  if (hint) {
    const word = hint.toLowerCase().split(' ')[0];
    const match = elements.find((el) => el.tags?.name?.toLowerCase().includes(word));
    if (match?.tags) return match.tags;
  }
  return elements[0].tags ?? null;
}

// ── Website scraper ────────────────────────────────────────────────────────────

function cleanPhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '').replace(/^00/, '+');
}

function extractFromHtml(html: string): Pick<EnrichedCustomer, 'phone' | 'email' | 'vatNumber' | 'companyName'> {
  // Phone — tel: links first, then Greek number patterns
  const telLinks = [...html.matchAll(/href="tel:([^"]+)"/gi)].map((m) => cleanPhone(m[1]));
  const textPhones = [...html.matchAll(/(?<![\/\w])(\+30[\s\-]?)?(?:2\d{9}|6[0-9]\d{8})(?!\d)/g)]
    .map((m) => cleanPhone(m[0]))
    .filter((p) => p.replace(/\D/g, '').length >= 10);
  const phone = (telLinks[0] ?? textPhones[0]) || undefined;

  // Email — mailto: links first, then bare email pattern
  const mailLinks = [...html.matchAll(/href="mailto:([^"?]+)/gi)].map((m) => m[1].trim());
  const textEmails = [...html.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)].map((m) => m[0]);
  const email = (mailLinks[0] ?? textEmails.find((e) => !e.includes('example') && !e.includes('domain'))) || undefined;

  // Greek VAT — 9 digits near ΑΦΜ / AFM / VAT keywords
  const vatPatterns = [
    /(?:ΑΦΜ|Α\.Φ\.Μ\.|Α\s*Φ\s*Μ|ΑΡ\.?\s*ΦΟΡΟΛ\S*|AFM)[:\s·\-]*(\d{9})/i,
    /(\d{9})\s*[-–]\s*(?:ΑΦΜ|Α\.Φ\.Μ\.)/i,
    /VAT\s*(?:No|Number|#|ID)?[.:\s]*(?:[A-Z]{2})?(\d{9})/i,
    /Tax\s*(?:ID|Number|No)[.:\s]*(?:[A-Z]{2})?(\d{9})/i,
    // Plain 9-digit number near the bottom of the page (common in Greek footers)
    /(?:ΑΦΜ|AFM|ΔΟΥ)[^\d]{0,30}(\d{9})/i,
  ];
  let vatNumber: string | undefined;
  for (const p of vatPatterns) {
    const m = html.match(p);
    if (m) { vatNumber = m[m.length - 1]; break; }
  }

  // Company name from <title> — skip HTTP error pages
  const titleMatch = html.match(/<title[^>]*>([^<]{2,100})<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s*[-|–|·|•]\s*.{0,60}$/, '').trim() : '';
  const companyName = rawTitle && !/^\s*error\s+\d{3}/i.test(rawTitle) ? rawTitle : undefined;

  return { phone, email, vatNumber, companyName };
}

async function scrapeWebsiteThorough(rawUrl: string): Promise<Pick<EnrichedCustomer, 'phone' | 'email' | 'vatNumber' | 'companyName'>> {
  const base = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).origin;

  // Try homepage first, then Greek/English contact pages
  const pages = [base, `${base}/contact`, `${base}/epikoinonia`, `${base}/contact-us`, `${base}/about`, `${base}/sxetika`];

  let phone: string | undefined;
  let email: string | undefined;
  let vatNumber: string | undefined;
  let companyName: string | undefined;

  for (const pageUrl of pages) {
    if (phone && email && vatNumber) break;
    try {
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'el,en;q=0.9',
        },
        signal: AbortSignal.timeout(7000),
        redirect: 'follow',
      });
      const html = await res.text();
      const e = extractFromHtml(html);
      if (!phone   && e.phone)       phone       = e.phone;
      if (!email   && e.email)       email       = e.email;
      if (!vatNumber && e.vatNumber) vatNumber   = e.vatNumber;
      if (!companyName && e.companyName) companyName = e.companyName;
    } catch { /* page unavailable, try next */ }
  }

  return { phone, email, vatNumber, companyName };
}

// ── Route ──────────────────────────────────────────────────────────────────────

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { mapsUrl } = req.body as { mapsUrl?: string };
  if (!mapsUrl) { res.status(400).json({ message: 'mapsUrl required' }); return; }

  // Step 1 — resolve short/share URLs to the full Google Maps URL
  let fullUrl = mapsUrl;
  if (isShortUrl(mapsUrl)) {
    try {
      fullUrl = await resolveUrl(mapsUrl);
    } catch {
      res.status(502).json({ message: 'Could not resolve Maps URL' });
      return;
    }
  }

  const result: EnrichedCustomer = {};
  const coords = extractCoordsFromUrl(fullUrl);
  const placeName = extractPlaceNameFromUrl(fullUrl);

  if (coords) { result.latitude = coords.lat; result.longitude = coords.lng; }
  if (placeName) result.companyName = placeName;

  // Step 2 — scrape the Google Maps page itself for phone + website
  // This is the primary source since most businesses aren't in OSM
  const gmaps = await scrapeGoogleMapsPage(fullUrl);
  if (gmaps.phone) result.phone = gmaps.phone;
  let website: string | undefined = gmaps.website;

  // Step 3 — query OpenStreetMap (may fill gaps or override with higher-quality data)
  if (coords) {
    try {
      const elements = await queryOverpass(coords.lat, coords.lng);
      const tags = bestOsmTags(elements, placeName);
      if (tags) {
        if (tags.name)    result.companyName = tags.name;
        if (tags.phone)   result.phone       = tags.phone;
        if (tags.email)   result.email       = tags.email;
        if (tags.website) website            = tags.website;
        const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
        const city   = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
        if (street || city) result.address = [street, city].filter(Boolean).join(', ');
      }
    } catch { /* Overpass unavailable */ }
  }

  // Step 4 — scrape the business website (homepage + contact pages)
  if (website) {
    result.website = website;
    try {
      const scraped = await scrapeWebsiteThorough(website);
      if (!result.phone      && scraped.phone)       result.phone       = scraped.phone;
      if (!result.email      && scraped.email)       result.email       = scraped.email;
      if (!result.vatNumber  && scraped.vatNumber)   result.vatNumber   = scraped.vatNumber;
      if (!result.companyName && scraped.companyName) result.companyName = scraped.companyName;
    } catch { /* website unreachable */ }
  }

  res.json(result);
});

export default router;
