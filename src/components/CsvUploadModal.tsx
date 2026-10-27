import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Download,
  Database,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { parseCsvText, generateSampleCsvContent, ParseCsvResult, DatasetSummary } from '../utils/csvParser';
import { HistoricalTelemetryRecord } from '../types';
import { soundEngine } from '../utils/audio';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetLoaded: (result: ParseCsvResult) => void;
  activeDatasetName: string;
  totalRecordsCount: number;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onDatasetLoaded,
  activeDatasetName,
  totalRecordsCount
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseCsvResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('File content is empty.');
        }
        const result = parseCsvText(text, file.name);
        setParseResult(result);
        soundEngine.playAlert('success');
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to parse CSV file. Please check format.');
        soundEngine.playAlert('critical');
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Error reading file from disk.');
      setIsLoading(false);
      soundEngine.playAlert('critical');
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleLoadSample = () => {
    soundEngine.playClick();
    const sampleCsv = generateSampleCsvContent();
    const result = parseCsvText(sampleCsv, 'ai4i_sample_mining_fleet.csv');
    setParseResult(result);
    setErrorMessage(null);
  };

  const handleDownloadTemplate = () => {
    soundEngine.playClick();
    const sampleCsv = generateSampleCsvContent();
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'field_failure_dataset_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyDataset = () => {
    if (parseResult) {
      soundEngine.playAlert('success');
      onDatasetLoaded(parseResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Dark Blur Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
                UPLOAD FIELD FAILURE RETURN DATASET (CSV)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Import product telemetry, root cause failure modes (TWF, HDF, PWF, OSF, RNF), and operational attributes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 font-sans">
          {/* Active Dataset Status Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Currently Active Dataset:</span>
              <span className="font-bold text-cyan-300">{activeDatasetName}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                {totalRecordsCount} records
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 text-[11px] underline transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download CSV Template
              </button>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-3 ${
              dragActive
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-700 hover:border-cyan-500/50 bg-slate-950/40 hover:bg-slate-950/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UploadCloud className="w-7 h-7" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-200">
                Click to browse or drag and drop your field return CSV dataset here
              </p>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Supports standard AI4I format, custom failure logs, torque/wear sensor attributes (.csv, .tsv)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                Auto Header Mapping
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                5 Failure Modes Support
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                Instant Analytics & AI Chat Sync
              </span>
            </div>
          </div>

          {/* Quick Demo Sample Action */}
          <div className="flex items-center justify-center gap-3 text-xs font-mono">
            <span className="text-slate-500">Don't have a dataset ready?</span>
            <button
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Load Standard Fleet Sample (12 Records)
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5">Parse Error</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Parsed Result Preview */}
          {parseResult && parseResult.warnings.length > 0 && (
            <div className="rounded-xl p-4 bg-amber-950/40 border border-amber-500/40 space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                {parseResult.warnings.length} parsing warning{parseResult.warnings.length === 1 ? '' : 's'} — some values were replaced or clamped, check your file before applying:
              </div>
              <ul className="text-xs text-amber-200/90 space-y-1 max-h-32 overflow-y-auto list-disc pl-5">
                {parseResult.warnings.slice(0, 50).map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              {parseResult.warnings.length > 50 && (
                <p className="text-xs text-amber-200/70">…and {parseResult.warnings.length - 50} more warnings (full list is in the parse result).</p>
              )}
            </div>
          )}
          {parseResult && (
            <div className="space-y-4 rounded-xl p-5 bg-slate-950 border border-slate-800 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-100">{parseResult.filename}</span>
                  <span className="text-xs text-slate-400">({parseResult.records.length} records parsed)</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {parseResult.columnCount} columns mapped
                  </span>
                </div>
              </div>

              {/* High-Level Metric Rollups */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">TOTAL PRODUCTS</div>
                  <div className="text-base font-bold text-slate-100">{parseResult.summary.totalRecords}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">FAILURE RATE</div>
                  <div className="text-base font-bold text-rose-400">{parseResult.summary.failureRate}</div>
                  <div className="text-[10px] text-slate-500">{parseResult.summary.totalFailures} failures</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">TOP FAILURE MODE</div>
                  <div className="text-base font-bold text-amber-400">{parseResult.summary.topFailureMode.mode}</div>
                  <div className="text-[10px] text-slate-500">{parseResult.summary.topFailureMode.count} units ({parseResult.summary.topFailureMode.percentage})</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">PRODUCT TYPES (L/M/H)</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {parseResult.summary.typeLCount} / {parseResult.summary.typeMCount} / {parseResult.summary.typeHCount}
                  </div>
                  <div className="text-[10px] text-slate-500">L Risk: {parseResult.summary.typeLFailureRate}</div>
                </div>
              </div>

              {/* Failure Mode Distribution Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">Parsed Failure Modes Breakdown:</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {parseResult.summary.paretoBreakdown.map((item) => (
                    <span
                      key={item.mode}
                      className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 flex items-center gap-1.5 text-[11px]"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <strong className="text-slate-200">{item.mode}:</strong>
                      <span className="text-cyan-300 font-bold">{item.count}</span>
                      <span className="text-slate-400 text-[10px]">({item.percentage})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Sample Rows Table Preview */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">Data Sample Preview (First 4 rows):</div>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-[11px] text-left border-collapse bg-slate-900/50">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950">
                        <th className="p-2">ID</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Air/Proc Temp</th>
                        <th className="p-2">RPM</th>
                        <th className="p-2">Torque</th>
                        <th className="p-2">Wear</th>
                        <th className="p-2">Failure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parseResult.records.slice(0, 4).map((r) => (
                        <tr key={r.udi} className="hover:bg-slate-900/80">
                          <td className="p-2 font-bold text-slate-200">{r.productID}</td>
                          <td className="p-2">Type {r.type}</td>
                          <td className="p-2">{r.airTemp.toFixed(1)} / {r.processTemp.toFixed(1)} K</td>
                          <td className="p-2 text-indigo-300">{r.rotationalSpeed} RPM</td>
                          <td className="p-2 text-emerald-300">{r.torque.toFixed(1)} Nm</td>
                          <td className="p-2 text-amber-300">{r.toolWear} min</td>
                          <td className="p-2">
                            {r.machineFailure === 1 ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                FAILURE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400">
                                NORMAL
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/90">
          <div className="text-xs text-slate-400 font-mono">
            {parseResult ? `Ready to apply ${parseResult.records.length} records.` : 'Upload a CSV to update mining analytics.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!parseResult}
              onClick={handleApplyDataset}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-mono text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply & Activate Dataset
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
