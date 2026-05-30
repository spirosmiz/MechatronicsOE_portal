import { useState, useEffect } from 'react';
import { Navigation, Loader2, X, Link, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

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

interface Props {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number | undefined, lng: number | undefined) => void;
  onEnrich?: (data: EnrichedCustomer) => void;
  onAddressFound?: (address: string) => void;
}

function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

export function LocationPicker({ latitude, longitude, onChange, onEnrich, onAddressFound }: Props) {
  const [mapsUrl, setMapsUrl] = useState('');
  const [mapsError, setMapsError] = useState('');
  const [mapsResolving, setMapsResolving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichedUrl, setEnrichedUrl] = useState('');

  // Reverse geocode whenever valid coordinates are set
  useEffect(() => {
    if (latitude == null || longitude == null || !onAddressFound) return;
    const controller = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'el,en;q=0.9' }, signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data: { display_name?: string; address?: Record<string, string> }) => {
        if (controller.signal.aborted) return;
        let address = '';
        if (data.address) {
          const a = data.address;
          const street = [a.road, a.house_number].filter(Boolean).join(' ');
          const place  = a.village || a.suburb || a.neighbourhood || a.town || a.city_district || a.city || a.municipality || '';
          const post   = a.postcode || '';
          address = [street, place, post].filter(Boolean).join(', ');
        }
        if (!address) {
          address = (data.display_name ?? '')
            .replace(/,\s*(Ελλάδα|Greece|ΕΛΛΑΔΑ|Grecia|Grèce)\s*$/, '')
            .trim();
        }
        if (address) onAddressFound(address);
      })
      .catch(() => { /* silently ignore */ });
    return () => controller.abort();
  }, [latitude, longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMapsUrlChange(val: string) {
    setMapsUrl(val);
    setMapsError('');
    setEnrichedUrl('');
    if (!val.trim()) return;

    if (val.startsWith('https://maps.app.goo.gl/') || val.startsWith('https://share.google/')) {
      setMapsResolving(true);
      try {
        const { data } = await api.get<{ resolvedUrl: string }>('/resolve-maps-url', { params: { url: val } });
        const coords = parseGoogleMapsUrl(data.resolvedUrl);
        if (coords) onChange(coords.lat, coords.lng);
        else setMapsError('Link resolved but coordinates could not be extracted. Try the desktop Google Maps URL.');
      } catch {
        setMapsError('Could not resolve this link. Check your connection and try again.');
      } finally {
        setMapsResolving(false);
      }
      return;
    }

    const coords = parseGoogleMapsUrl(val);
    if (coords) onChange(coords.lat, coords.lng);
    else if (val.length > 20) setMapsError('Could not read coordinates. Try copying the URL from the Google Maps desktop site address bar.');
  }

  async function handleEnrich() {
    if (!mapsUrl || !onEnrich) return;
    setEnriching(true);
    try {
      const { data } = await api.post<EnrichedCustomer>('/enrich-customer', { mapsUrl });
      onEnrich(data);
      setEnrichedUrl(mapsUrl);
    } catch {
      setMapsError('Auto-fill failed. The business may not have enough public data available.');
    } finally {
      setEnriching(false);
    }
  }

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => alert('Could not get location. Paste a Google Maps link instead.')
    );
  }

  function clearLocation() {
    onChange(undefined, undefined);
    setMapsUrl('');
    setEnrichedUrl('');
    setMapsError('');
  }

  const canEnrich = !!onEnrich && !!mapsUrl && !mapsResolving && !!latitude && enrichedUrl !== mapsUrl;

  return (
    <div className="col-span-2 space-y-2">
      <div className="flex items-center justify-between">
        <Label>Location (GPS)</Label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          onClick={useMyLocation}
        >
          <Navigation className="w-3 h-3" /> Use my location
        </button>
      </div>

      {/* Google Maps URL input */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            placeholder="Paste Google Maps URL here…"
            value={mapsUrl}
            onChange={(e) => handleMapsUrlChange(e.target.value)}
            disabled={mapsResolving}
          />
          {mapsResolving && <Loader2 className="w-4 h-4 animate-spin self-center text-muted-foreground flex-shrink-0" />}
          {mapsUrl && !mapsResolving && (
            <button
              type="button"
              onClick={() => { setMapsUrl(''); setMapsError(''); setEnrichedUrl(''); onChange(undefined, undefined); }}
              className="px-2 text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {canEnrich && (
          <button
            type="button"
            onClick={handleEnrich}
            disabled={enriching}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 transition-colors"
          >
            {enriching
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching web for business info…</>
              : <><Sparkles className="w-3.5 h-3.5" /> Auto-fill business details</>
            }
          </button>
        )}

        {enrichedUrl === mapsUrl && !enriching && (
          <p className="text-xs text-green-600">Details filled in — review and adjust as needed.</p>
        )}

        <p className="text-xs text-muted-foreground">
          Open{' '}
          <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
            Google Maps <Link className="w-3 h-3" />
          </a>
          , find the business, copy the URL and paste it above.
        </p>
        {mapsError && <p className="text-xs text-amber-600">{mapsError}</p>}
      </div>

      {/* Manual lat/lng inputs */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="any"
          min={-90}
          max={90}
          placeholder="Latitude"
          value={latitude ?? ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined, longitude)}
        />
        <Input
          type="number"
          step="any"
          min={-180}
          max={180}
          placeholder="Longitude"
          value={longitude ?? ''}
          onChange={(e) => onChange(latitude, e.target.value ? parseFloat(e.target.value) : undefined)}
        />
      </div>

      {latitude != null && longitude != null && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
          <button type="button" onClick={clearLocation} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700">
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
