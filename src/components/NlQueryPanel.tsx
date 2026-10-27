import React, { useState } from 'react';
import type { HistoricalTelemetryRecord } from '../types';
import { runNlQuery } from '../utils/nlQuery';

interface NlQueryPanelProps {
  datasetRows: HistoricalTelemetryRecord[];
  activeDatasetName: string;
  onLoadRecord?: (record: HistoricalTelemetryRecord) => void;
}

const EXAMPLES = [
  'how many HDF failures?',
  'average torque for HDF failures',
  'list records with wear > 200',
  'highest tool wear among failures',
  'how many type L failures?',
];

export const NlQueryPanel: React.FC<NlQueryPanelProps> = ({ datasetRows, activeDatasetName, onLoadRecord }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ReturnType<typeof runNlQuery> | null>(null);

  const handleRun = (q: string) => {
    setQuery(q);
    setResult(runNlQuery(q, datasetRows));
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 md:p-7 backdrop-blur-xl shadow-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-100 font-mono">ASK THE DATASET — NATURAL LANGUAGE QUERY</h2>
        <p className="text-xs text-slate-400">
          Deterministic local parser, no LLM. Active dataset: {activeDatasetName} ({datasetRows.length} rows).
          Every number comes from filtering those rows — if a pattern is not understood, it says so.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleRun(query);
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. how many HDF failures?"
          className="flex-1 min-w-[220px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
          aria-label="Natural language dataset query"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-mono font-bold text-xs"
        >
          Ask →
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleRun(example)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono"
          >
            {example}
          </button>
        ))}
      </div>

      {result && (
        <div className="space-y-3">
          <p className={`text-sm font-mono ${result.matched ? 'text-slate-100' : 'text-amber-300'}`}>
            {result.answer}
          </p>
          {result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-2">Product</th>
                    <th className="p-2">Type</th>
                    <th className="p-2 text-right">Wear</th>
                    <th className="p-2 text-right">Torque</th>
                    <th className="p-2 text-right">RPM</th>
                    <th className="p-2 text-right">ΔT</th>
                    <th className="p-2">Modes</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => {
                    const modes = [
                      row.twf ? 'TWF' : null,
                      row.hdf ? 'HDF' : null,
                      row.pwf ? 'PWF' : null,
                      row.osf ? 'OSF' : null,
                      row.rnf ? 'RNF' : null,
                    ].filter(Boolean).join(', ') || '—';
                    return (
                      <tr key={row.udi} className="border-b border-slate-800/60">
                        <td className="p-2 text-slate-200">{row.productID}</td>
                        <td className="p-2">{row.type}</td>
                        <td className="p-2 text-right">{row.toolWear}</td>
                        <td className="p-2 text-right">{row.torque}</td>
                        <td className="p-2 text-right">{row.rotationalSpeed}</td>
                        <td className="p-2 text-right">{(row.processTemp - row.airTemp).toFixed(1)} K</td>
                        <td className="p-2">{modes}</td>
                        <td className="p-2">
                          {onLoadRecord && (
                            <button
                              type="button"
                              onClick={() => onLoadRecord(row)}
                              className="text-cyan-300 hover:text-cyan-200"
                            >
                              Load →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
