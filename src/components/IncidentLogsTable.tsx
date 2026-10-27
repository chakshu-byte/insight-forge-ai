import React, { useState, useEffect } from 'react';
import { Search, Download, ExternalLink, Filter, AlertTriangle, CheckCircle, FileSpreadsheet, PlusCircle } from 'lucide-react';
import { HistoricalTelemetryRecord, TelemetryState } from '../types';
import type { AgentLogFilter } from '../agent/agentContract';
import { soundEngine } from '../utils/audio';

interface IncidentLogsTableProps {
  records: HistoricalTelemetryRecord[];
  activeDatasetName: string;
  selectedRecordUdi: number | null;
  onLoadRecord: (record: HistoricalTelemetryRecord) => void;
  onOpenUploadModal: () => void;
  agentFilter?: AgentLogFilter | null;
}

export const IncidentLogsTable: React.FC<IncidentLogsTableProps> = ({
  records,
  activeDatasetName,
  selectedRecordUdi,
  onLoadRecord,
  onOpenUploadModal,
  agentFilter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'failures' | 'normal' | 'twf' | 'hdf' | 'pwf' | 'osf' | 'rnf'>('all');
  const [page, setPage] = useState(1);

  // Agent Copilot filter: an external, executed action — not a label.
  // Only the nonce change applies it, so manual pill clicks still work.
  useEffect(() => {
    if (!agentFilter) return;
    setFilterMode(agentFilter.mode);
    setSearchTerm(agentFilter.search);
    setPage(1);
  }, [agentFilter]);
  const pageSize = 15;

  const filteredData = records.filter((row) => {
    const matchesSearch =
      row.productID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.siteLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.subsystem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(row.udi).includes(searchTerm);

    if (!matchesSearch) return false;

    if (filterMode === 'failures') return row.machineFailure === 1;
    if (filterMode === 'normal') return row.machineFailure === 0;
    if (filterMode === 'twf') return row.twf === 1;
    if (filterMode === 'hdf') return row.hdf === 1;
    if (filterMode === 'pwf') return row.pwf === 1;
    if (filterMode === 'osf') return row.osf === 1;
    if (filterMode === 'rnf') return row.rnf === 1;
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    soundEngine.playClick();
    const headers = ['UDI', 'Product ID', 'Type', 'Air Temp [K]', 'Process Temp [K]', 'RPM', 'Torque [Nm]', 'Tool Wear [min]', 'Machine Failure', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF', 'Timestamp', 'Subsystem', 'Location'];
    const rows = filteredData.map(r => [
      r.udi, r.productID, r.type, r.airTemp, r.processTemp, r.rotationalSpeed, r.torque, r.toolWear, r.machineFailure, r.twf, r.hdf, r.pwf, r.osf, r.rnf, `"${r.timestamp}"`, `"${r.subsystem}"`, `"${r.siteLocation}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeDatasetName.replace(/\.[^/.]+$/, '')}_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 md:p-7 backdrop-blur-xl shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 font-mono">
              FIELD RETURN & INCIDENT TELEMETRY LOGS
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {activeDatasetName} ({records.length} items)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real mining equipment field telemetry records with verified root cause failure labels (TWF, HDF, PWF, OSF, RNF)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenUploadModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono transition-all font-bold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            Upload New CSV
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono transition-all"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV ({filteredData.length})
          </button>
        </div>
      </div>

      {/* Controls & Search Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Product ID (e.g. M14860), site location, subsystem..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1 mr-1 text-[11px]">
            <Filter className="w-3 h-3 text-cyan-400" /> Filter:
          </span>
          {[
            { id: 'all', label: `All (${records.length})` },
            { id: 'failures', label: 'Failures Only' },
            { id: 'normal', label: 'Normal' },
            { id: 'twf', label: 'TWF' },
            { id: 'hdf', label: 'HDF' },
            { id: 'pwf', label: 'PWF' },
            { id: 'osf', label: 'OSF' },
            { id: 'rnf', label: 'RNF' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setFilterMode(f.id as any);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                filterMode === f.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full text-xs font-mono text-left border-collapse bg-slate-950/50">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-950">
              <th className="p-3">UDI / ID</th>
              <th className="p-3">Variant</th>
              <th className="p-3">Air / Proc Temp</th>
              <th className="p-3">Speed (RPM)</th>
              <th className="p-3">Torque</th>
              <th className="p-3">Tool Wear</th>
              <th className="p-3">Failure Mode</th>
              <th className="p-3">Subsystem / Site</th>
              <th className="p-3 text-right">Inference Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500">
                  No records match your filter query.
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const hasFailure = row.machineFailure === 1;
                const failureTags = [];
                if (row.twf) failureTags.push('TWF');
                if (row.hdf) failureTags.push('HDF');
                if (row.pwf) failureTags.push('PWF');
                if (row.osf) failureTags.push('OSF');
                if (row.rnf) failureTags.push('RNF');

                const isSelected = selectedRecordUdi === row.udi;

                return (
                  <tr
                    key={row.udi}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/10 border-l-4 border-emerald-400 shadow-inner shadow-emerald-500/10'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="p-3">
                      <div className="font-bold text-slate-200">{row.productID}</div>
                      <div className="text-[10px] text-slate-500">#{row.udi}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                        Type {row.type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div>{row.airTemp.toFixed(1)} K / {row.processTemp.toFixed(1)} K</div>
                      <div className="text-[10px] text-slate-500">ΔT: {(row.processTemp - row.airTemp).toFixed(1)} K</div>
                    </td>
                    <td className="p-3 text-indigo-300 font-semibold">
                      {row.rotationalSpeed} RPM
                    </td>
                    <td className="p-3 text-emerald-300 font-semibold">
                      {row.torque.toFixed(1)} Nm
                    </td>
                    <td className="p-3">
                      <span className={row.toolWear > 200 ? 'text-rose-400 font-bold' : 'text-amber-300'}>
                        {row.toolWear} min
                      </span>
                    </td>
                    <td className="p-3">
                      {hasFailure ? (
                        <div className="flex flex-wrap gap-1">
                          {failureTags.length > 0 ? (
                            failureTags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              FAILURE
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          NOMINAL
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400">
                      <div className="truncate max-w-[180px] text-slate-300">{row.subsystem}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{row.siteLocation}</div>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onLoadRecord(row);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] transition-all border ${
                          isSelected
                            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                            : 'bg-cyan-500/10 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        {isSelected ? 'Loaded Telemetry ✓' : 'Load Telemetry ➔'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs font-mono text-slate-400">
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredData.length)} of {filteredData.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-slate-950 border border-slate-800 disabled:opacity-40 rounded hover:bg-slate-900"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-slate-950 border border-slate-800 disabled:opacity-40 rounded hover:bg-slate-900"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

