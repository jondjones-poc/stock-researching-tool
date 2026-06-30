'use client';

import { useMemo, useState } from 'react';
import {
  WORLD_MARKET_COUNTRY_PRESETS,
  centroidFromCountryCodes,
  type WorldMarketDataSource,
} from '../../config/worldMarkets';

interface WorldMarketsAddIndexFormProps {
  onAdded: () => void;
}

export default function WorldMarketsAddIndexForm({ onAdded }: WorldMarketsAddIndexFormProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [indexName, setIndexName] = useState('');
  const [dataSource, setDataSource] = useState<WorldMarketDataSource>('FMP');
  const [symbol, setSymbol] = useState('');
  const [fredSeriesId, setFredSeriesId] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [icon, setIcon] = useState('📊');
  const [note, setNote] = useState('');

  const centroid = useMemo(
    () => centroidFromCountryCodes(selectedCountries),
    [selectedCountries]
  );

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const resetForm = () => {
    setName('');
    setIndexName('');
    setDataSource('FMP');
    setSymbol('');
    setFredSeriesId('');
    setSelectedCountries([]);
    setIcon('📊');
    setNote('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/world-market-indices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          indexName,
          dataSource,
          symbol,
          fredSeriesId: dataSource === 'FRED' ? fredSeriesId : undefined,
          countryCodes: selectedCountries,
          lat: centroid.lat,
          lng: centroid.lng,
          icon: icon || centroid.icon,
          note: note || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.hint ? `${data.error}. ${data.hint}` : data.details || data.error || 'Failed to add index');
      }

      resetForm();
      setOpen(false);
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add index');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add index
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add market index</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            Map countries use ISO 3166-1 alpha-3 codes (e.g. USA, GBR). Selected countries are coloured on the world map.
          </p>

          {error && (
            <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Region name *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. United States"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Index name *</span>
              <input
                required
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                placeholder="e.g. S&P 500"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Data source *</span>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value as WorldMarketDataSource)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="FMP">FMP (daily index / ETF symbol)</option>
                <option value="FRED">FRED (monthly OECD series)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Symbol *</span>
              <input
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={dataSource === 'FMP' ? 'e.g. ^GSPC' : 'e.g. CHINA (label only)'}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </label>
            {dataSource === 'FRED' && (
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">FRED series ID *</span>
                <input
                  required
                  value={fredSeriesId}
                  onChange={(e) => setFredSeriesId(e.target.value)}
                  placeholder="e.g. SPASTT01CNQ661N"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Icon (emoji)</span>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={8}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Map marker (auto)</span>
              <div className="mt-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400 font-mono">
                {selectedCountries.length > 0
                  ? `${centroid.lat.toFixed(2)}, ${centroid.lng.toFixed(2)}`
                  : 'Select countries below'}
              </div>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Map countries * <span className="font-normal text-gray-500">(ISO alpha-3)</span>
            </span>
            <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              {WORLD_MARKET_COUNTRY_PRESETS.map((country) => {
                const selected = selectedCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      toggleCountry(country.code);
                      if (!icon || icon === '📊') {
                        setIcon(country.icon ?? '📊');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {country.icon} {country.code} — {country.name}
                  </button>
                );
              })}
            </div>
            {selectedCountries.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Selected: {selectedCountries.join(', ')}
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </label>

          <button
            type="submit"
            disabled={saving || selectedCountries.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save index'}
          </button>
        </form>
      )}
    </div>
  );
}
