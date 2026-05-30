import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface GemiCompany {
  gemiNumber: string;
  companyName: string;
  vatNumber: string;
  active: boolean;
}

interface Props {
  companyName: string;
  onSelect: (company: GemiCompany) => void;
}

export function GemiLookup({ companyName, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GemiCompany[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function search() {
    const name = companyName.trim();
    if (name.length < 2) { setError('Enter at least 2 characters in the company name first'); return; }
    setLoading(true);
    setError('');
    setOpen(false);
    try {
      const { data } = await api.get<GemiCompany[]>('/gemi-lookup', { params: { name } });
      setResults(data);
      setOpen(true);
      if (data.length === 0) setError('No companies found in ΓΕΜΗ for this name');
    } catch {
      setError('Could not reach ΓΕΜΗ registry. Try again later.');
    } finally {
      setLoading(false);
    }
  }

  function pick(company: GemiCompany) {
    onSelect(company);
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={search}
        disabled={loading}
        title="Search VAT from ΓΕΜΗ by company name"
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50 whitespace-nowrap"
      >
        {loading
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <Search className="w-3 h-3" />}
        ΓΕΜΗ
      </button>

      {error && (
        <p className="absolute top-full mt-1 left-0 text-xs text-amber-600 bg-white border rounded shadow px-2 py-1 z-50 whitespace-nowrap">
          {error}
        </p>
      )}

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-50 w-96 rounded-md border bg-white shadow-lg max-h-64 overflow-y-auto">
          <p className="px-3 py-1.5 text-xs text-muted-foreground border-b bg-gray-50">
            {results.length} result{results.length !== 1 ? 's' : ''} from ΓΕΜΗ — click to fill VAT
          </p>
          {results.map((c) => (
            <button
              key={c.gemiNumber}
              type="button"
              onClick={() => pick(c)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.companyName}</span>
                {c.active
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" title="Active" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" title="Inactive" />}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                ΑΦΜ: <span className="font-mono">{c.vatNumber}</span>
                <span className="ml-2 opacity-60">ΓΕΜΗ: {c.gemiNumber}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
