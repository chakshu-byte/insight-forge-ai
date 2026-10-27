import { HistoricalTelemetryRecord, ProductType, FailureMode } from '../types';
import { ComponentThresholdProfile, getComponentThresholds } from '../config/componentThresholds';

export interface DatasetSummary {
  totalRecords: number;
  totalFailures: number;
  failureRate: string;
  nominalCount: number;
  typeLCount: number;
  typeMCount: number;
  typeHCount: number;
  typeLFailureRate: string;
  typeMFailureRate: string;
  typeHFailureRate: string;
  twfCount: number;
  hdfCount: number;
  pwfCount: number;
  osfCount: number;
  rnfCount: number;
  topFailureMode: {
    mode: string;
    fullName: string;
    count: number;
    percentage: string;
    description: string;
  };
  paretoBreakdown: Array<{
    mode: string;
    count: number;
    percentage: string;
    cumulativePct: number;
    color: string;
    desc: string;
  }>;
  averages: {
    airTemp: number;
    processTemp: number;
    tempDiff: number;
    rotationalSpeed: number;
    torque: number;
    toolWear: number;
    powerWatts: number;
  };
  ranges: {
    minAirTemp: number;
    maxAirTemp: number;
    minRpm: number;
    maxRpm: number;
    minTorque: number;
    maxTorque: number;
    minWear: number;
    maxWear: number;
  };
}

export interface ParseCsvResult {
  records: HistoricalTelemetryRecord[];
  summary: DatasetSummary;
  filename: string;
  warnings: string[];
  columnCount: number;
  headers: string[];
}


/**
 * Parse a numeric CSV field without silently losing 0 or bad input.
 * Old code used `parseFloat(x) || default`, so a legitimate 0 became the
 * default (a stopped machine looked normal) and "abc" / empty became the
 * default with no warning at all. Now 0 is preserved, NaN/empty/negative
 * values produce a warning that the upload modal shows.
 */
function parseNumberField(raw: string | undefined, fallback: number, field: string, rowIndex: number, warnings: string[]): number {
  if (raw === undefined || raw === null || raw.trim() === '') {
    warnings.push(`Row ${rowIndex}: ${field} is missing, using ${fallback}.`);
    return fallback;
  }
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) {
    warnings.push(`Row ${rowIndex}: ${field} '${raw}' is not a number, using ${fallback}.`);
    return fallback;
  }
  if ((field.includes('speed') || field.includes('torque') || field.includes('wear')) && n < 0) {
    warnings.push(`Row ${rowIndex}: ${field} is negative (${n}), clamped to 0.`);
    return 0;
  }
  if ((field.includes('temperature')) && (n < 200 || n > 400)) {
    warnings.push(`Row ${rowIndex}: ${field} is outside a plausible Kelvin range (${n} K), kept as-is.`);
  }
  return n;
}

/**
 * Robust CSV parser that handles quotes, commas, CRLF/LF linebreaks
 */
export function parseCsvText(csvText: string, filename: string = 'uploaded_dataset.csv'): ParseCsvResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('The uploaded CSV file is empty.');
  }

  // Parse header
  const rawHeaders = parseCsvLine(lines[0]);
  const cleanHeaders = rawHeaders.map(h => h.trim().toLowerCase());

  // Find column indexes
  const colIndex = {
    udi: findColumnIndex(cleanHeaders, ['udi', 'uid', 'id', 'index', 'sl', 'row']),
    productID: findColumnIndex(cleanHeaders, ['product id', 'product_id', 'productid', 'serial', 'serial_number', 'equipment_id', 'id_code']),
    type: findColumnIndex(cleanHeaders, ['type', 'product_type', 'variant', 'quality', 'grade', 'alloy_type']),
    airTemp: findColumnIndex(cleanHeaders, ['air temperature [k]', 'air_temp', 'air temp', 'airtemp', 'air_temperature', 'air_temp_k', 'ambient_temp']),
    processTemp: findColumnIndex(cleanHeaders, ['process temperature [k]', 'process_temp', 'process temp', 'processtemp', 'proc_temp', 'proc_temp_k', 'process_temperature']),
    rotationalSpeed: findColumnIndex(cleanHeaders, ['rotational speed [rpm]', 'rotational_speed', 'rotational speed', 'speed', 'rpm', 'spindle_rpm', 'rotation_speed']),
    torque: findColumnIndex(cleanHeaders, ['torque [nm]', 'torque', 'torque_nm', 'torque[nm]', 'load_torque']),
    toolWear: findColumnIndex(cleanHeaders, ['tool wear [min]', 'tool_wear', 'tool wear', 'toolwear', 'wear', 'wear_min', 'cutting_time']),
    machineFailure: findColumnIndex(cleanHeaders, ['machine failure', 'machine_failure', 'failure', 'failed', 'target', 'is_failure', 'status_failure']),
    twf: findColumnIndex(cleanHeaders, ['twf', 'tool wear failure', 'tool_failure', 'twf_flag']),
    hdf: findColumnIndex(cleanHeaders, ['hdf', 'heat dissipation failure', 'heat_failure', 'thermal_failure', 'hdf_flag']),
    pwf: findColumnIndex(cleanHeaders, ['pwf', 'power failure', 'power_failure_flag', 'wattage_failure', 'pwf_flag']),
    osf: findColumnIndex(cleanHeaders, ['osf', 'overstrain failure', 'strain_failure', 'osf_flag']),
    rnf: findColumnIndex(cleanHeaders, ['rnf', 'random failures', 'random failure', 'random_anomaly', 'rnf_flag']),
    site: findColumnIndex(cleanHeaders, ['site', 'location', 'site_location', 'shaft', 'facility', 'zone', 'pit']),
    subsystem: findColumnIndex(cleanHeaders, ['subsystem', 'component', 'assembly', 'part', 'module']),
    timestamp: findColumnIndex(cleanHeaders, ['timestamp', 'date', 'datetime', 'time', 'logged_at', 'recorded_at']),
    maintenanceStatus: findColumnIndex(cleanHeaders, ['maintenance status', 'maintenance_status', 'status', 'condition', 'health_status']),
    speedWarning: findColumnIndex(cleanHeaders, ['speed warning [rpm]', 'speed_warning_rpm']),
    speedCritical: findColumnIndex(cleanHeaders, ['speed critical [rpm]', 'speed_critical_rpm']),
    torqueWarning: findColumnIndex(cleanHeaders, ['torque warning [nm]', 'torque_warning_nm']),
    torqueCritical: findColumnIndex(cleanHeaders, ['torque critical [nm]', 'torque_critical_nm']),
    airTempWarning: findColumnIndex(cleanHeaders, ['air temperature warning [k]', 'air_temp_warning_k']),
    airTempCritical: findColumnIndex(cleanHeaders, ['air temperature critical [k]', 'air_temp_critical_k']),
    processTempWarning: findColumnIndex(cleanHeaders, ['process temperature warning [k]', 'process_temp_warning_k']),
    processTempCritical: findColumnIndex(cleanHeaders, ['process temperature critical [k]', 'process_temp_critical_k']),
    deltaTWarning: findColumnIndex(cleanHeaders, ['temperature differential warning [k]', 'temperature_differential_warning_k']),
    deltaTCritical: findColumnIndex(cleanHeaders, ['temperature differential critical [k]', 'temperature_differential_critical_k']),
    toolWearWarning: findColumnIndex(cleanHeaders, ['tool wear warning [min]', 'tool_wear_warning_min']),
    toolWearCritical: findColumnIndex(cleanHeaders, ['tool wear critical [min]', 'tool_wear_critical_min']),
    powerMin: findColumnIndex(cleanHeaders, ['power minimum [kw]', 'power_min_kw']),
    powerMax: findColumnIndex(cleanHeaders, ['power maximum [kw]', 'power_max_kw']),
    thresholdSource: findColumnIndex(cleanHeaders, ['threshold source', 'threshold_source']),
    thresholdConfidence: findColumnIndex(cleanHeaders, ['threshold confidence', 'threshold_confidence']),
  };

  const records: HistoricalTelemetryRecord[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = parseCsvLine(lines[i]);
    if (rawCols.length < 2) continue; // skip blank/truncated line

    const udiRaw = colIndex.udi !== -1 ? parseInt(rawCols[colIndex.udi], 10) : NaN;
    const udi = Number.isFinite(udiRaw) ? udiRaw : i;
    const rawType = colIndex.type !== -1 ? rawCols[colIndex.type].trim().toUpperCase() : 'M';
    if (rawType && !rawType.startsWith('L') && !rawType.startsWith('H') && !rawType.startsWith('M')) {
      warnings.push(`Row ${i}: unknown product type '${rawType}', defaulting to M.`);
    }
    const type: ProductType = (rawType.startsWith('L') ? 'L' : rawType.startsWith('H') ? 'H' : 'M');
    const productID = colIndex.productID !== -1 ? rawCols[colIndex.productID].trim() : `${type}${10000 + i}`;

    const airTemp = colIndex.airTemp !== -1 ? parseNumberField(rawCols[colIndex.airTemp], 298.0, 'air temperature', i, warnings) : 298.0;
    const processTemp = colIndex.processTemp !== -1 ? parseNumberField(rawCols[colIndex.processTemp], 308.5, 'process temperature', i, warnings) : 308.5;
    const rotationalSpeed = colIndex.rotationalSpeed !== -1 ? parseNumberField(rawCols[colIndex.rotationalSpeed], 1500, 'rotational speed', i, warnings) : 1500;
    const torque = colIndex.torque !== -1 ? parseNumberField(rawCols[colIndex.torque], 40.0, 'torque', i, warnings) : 40.0;
    const toolWear = colIndex.toolWear !== -1 ? parseNumberField(rawCols[colIndex.toolWear], 50, 'tool wear', i, warnings) : 50;

    // Failure flags
    let twf = colIndex.twf !== -1 ? parseInt(rawCols[colIndex.twf], 10) || 0 : 0;
    let hdf = colIndex.hdf !== -1 ? parseInt(rawCols[colIndex.hdf], 10) || 0 : 0;
    let pwf = colIndex.pwf !== -1 ? parseInt(rawCols[colIndex.pwf], 10) || 0 : 0;
    let osf = colIndex.osf !== -1 ? parseInt(rawCols[colIndex.osf], 10) || 0 : 0;
    let rnf = colIndex.rnf !== -1 ? parseInt(rawCols[colIndex.rnf], 10) || 0 : 0;

    // If there is no machine-failure column and no mode flags at all,
    // the old code defaulted the label to 0 — even for wear 218, which
    // is a failure by physics. Infer from strict AI4I rules instead.
    const noLabelColumns = colIndex.machineFailure === -1 && colIndex.twf === -1 && colIndex.hdf === -1 && colIndex.pwf === -1 && colIndex.osf === -1 && colIndex.rnf === -1;
    let machineFailure = colIndex.machineFailure !== -1
      ? (Number.isFinite(parseInt(rawCols[colIndex.machineFailure], 10)) ? parseInt(rawCols[colIndex.machineFailure], 10) : 0)
      : (twf || hdf || pwf || osf || rnf ? 1 : 0);
    if (noLabelColumns) {
      const deltaT0 = processTemp - airTemp;
      const power0 = torque * (rotationalSpeed * (2 * Math.PI / 60));
      const overstrain0 = toolWear * torque;
      const strainLimit0 = rawType.startsWith('L') ? 11000 : rawType.startsWith('H') ? 13000 : 12000;
      if (toolWear >= 200) twf = 1;
      if (deltaT0 < 8.6 && rotationalSpeed < 1380) hdf = 1;
      if (power0 < 3500 || power0 > 9000) pwf = 1;
      if (overstrain0 > strainLimit0) osf = 1;
      machineFailure = (twf || hdf || pwf || osf || rnf) ? 1 : 0;
    }

    // If explicit failure flags weren't in CSV but machine failure was 1, auto-infer from physics formulas
    if (machineFailure === 1 && !twf && !hdf && !pwf && !osf && !rnf) {
      const deltaT = processTemp - airTemp;
      const power = torque * (rotationalSpeed * (2 * Math.PI / 60));
      const overstrain = toolWear * torque;
      const strainLimit = type === 'L' ? 11000 : type === 'M' ? 12000 : 13000;

      if (toolWear >= 200) twf = 1;
      if (deltaT < 8.6 && rotationalSpeed < 1380) hdf = 1;
      if (power < 3500 || power > 9000) pwf = 1;
      if (overstrain > strainLimit) osf = 1;
      if (!twf && !hdf && !pwf && !osf) rnf = 1;
    }

    const defaultSubsystems = [
      'Heavy Rotary Spindle Head',
      'Torque Transfer Coupling',
      'Coolant Jacket Exchanger',
      'Drive Inverter & Stator',
      'Main Roller Bearing Unit',
      'Pressure Relief Manifold'
    ];
    const defaultSites = [
      'Shaft 4B - Deep Pit Bore',
      'East Tunnel - Primary Crusher',
      'Ventilation Shaft Extraction',
      'Highwall Dragline Rig #2',
      'Underground Longwall Face 7',
      'Continuous Miner Rig A3'
    ];

    const subsystem = colIndex.subsystem !== -1 && rawCols[colIndex.subsystem]?.trim()
      ? rawCols[colIndex.subsystem].trim()
      : defaultSubsystems[i % defaultSubsystems.length];

    const fallbackThresholds = getComponentThresholds(subsystem);
    const thresholdNumber = (column: number, fallback: number | undefined) =>
      column !== -1 && rawCols[column] !== undefined && rawCols[column] !== ''
        ? parseFloat(rawCols[column])
        : fallback;
    const thresholdText = (column: number, fallback: string) =>
      column !== -1 && rawCols[column]?.trim() ? rawCols[column].trim() : fallback;
    const thresholdSource = thresholdText(
      colIndex.thresholdSource,
      fallbackThresholds.rotationalSpeed?.source || 'Component threshold profile'
    );
    const thresholdConfidence = thresholdText(
      colIndex.thresholdConfidence,
      fallbackThresholds.rotationalSpeed?.confidence || 'unavailable'
    ) as ComponentThresholdProfile['rotationalSpeed']['confidence'];
    const thresholds: ComponentThresholdProfile = {
      subsystem,
      rotationalSpeed: { ...fallbackThresholds.rotationalSpeed!, warning: thresholdNumber(colIndex.speedWarning, fallbackThresholds.rotationalSpeed?.warning), critical: thresholdNumber(colIndex.speedCritical, fallbackThresholds.rotationalSpeed?.critical), source: thresholdSource, confidence: thresholdConfidence },
      torque: { ...fallbackThresholds.torque!, warning: thresholdNumber(colIndex.torqueWarning, fallbackThresholds.torque?.warning), critical: thresholdNumber(colIndex.torqueCritical, fallbackThresholds.torque?.critical), source: thresholdSource, confidence: thresholdConfidence },
      airTemperature: { ...fallbackThresholds.airTemperature!, warning: thresholdNumber(colIndex.airTempWarning, fallbackThresholds.airTemperature?.warning), critical: thresholdNumber(colIndex.airTempCritical, fallbackThresholds.airTemperature?.critical), source: thresholdSource, confidence: thresholdConfidence },
      processTemperature: { ...fallbackThresholds.processTemperature!, warning: thresholdNumber(colIndex.processTempWarning, fallbackThresholds.processTemperature?.warning), critical: thresholdNumber(colIndex.processTempCritical, fallbackThresholds.processTemperature?.critical), source: thresholdSource, confidence: thresholdConfidence },
      temperatureDifferential: { ...fallbackThresholds.temperatureDifferential!, warning: thresholdNumber(colIndex.deltaTWarning, fallbackThresholds.temperatureDifferential?.warning), critical: thresholdNumber(colIndex.deltaTCritical, fallbackThresholds.temperatureDifferential?.critical), source: thresholdSource, confidence: thresholdConfidence },
      toolWear: { ...fallbackThresholds.toolWear!, warning: thresholdNumber(colIndex.toolWearWarning, fallbackThresholds.toolWear?.warning), critical: thresholdNumber(colIndex.toolWearCritical, fallbackThresholds.toolWear?.critical), source: thresholdSource, confidence: thresholdConfidence },
      power: { ...fallbackThresholds.power!, min: thresholdNumber(colIndex.powerMin, fallbackThresholds.power?.min), max: thresholdNumber(colIndex.powerMax, fallbackThresholds.power?.max), source: thresholdSource, confidence: thresholdConfidence }
    };

    const siteLocation = colIndex.site !== -1 && rawCols[colIndex.site]?.trim()
      ? rawCols[colIndex.site].trim()
      : defaultSites[i % defaultSites.length];

    const timestamp = colIndex.timestamp !== -1 && rawCols[colIndex.timestamp]?.trim()
      ? rawCols[colIndex.timestamp].trim()
      : new Date(Date.now() - (lines.length - i) * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    const maintenanceStatus = machineFailure === 1 ? 'Failure Tripped' : 'Normal';

    records.push({
      udi,
      productID,
      type,
      airTemp,
      processTemp,
      rotationalSpeed,
      torque,
      toolWear,
      machineFailure,
      twf,
      hdf,
      pwf,
      osf,
      rnf,
      timestamp,
      siteLocation,
      subsystem,
      maintenanceStatus,
      thresholds
    });
  }

  if (records.length === 0) {
    throw new Error('No valid telemetry rows could be parsed from the CSV file.');
  }

  const summary = computeDatasetSummary(records);

  return {
    records,
    summary,
    filename,
    warnings,
    columnCount: rawHeaders.length,
    headers: rawHeaders
  };
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const name of possibleNames) {
      if (h === name || h.includes(name)) {
        return i;
      }
    }
  }
  return -1;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

export function computeDatasetSummary(records: HistoricalTelemetryRecord[]): DatasetSummary {
  const totalRecords = records.length;
  let totalFailures = 0;
  let typeLCount = 0;
  let typeMCount = 0;
  let typeHCount = 0;
  let typeLFailures = 0;
  let typeMFailures = 0;
  let typeHFailures = 0;

  let twfCount = 0;
  let hdfCount = 0;
  let pwfCount = 0;
  let osfCount = 0;
  let rnfCount = 0;

  let sumAir = 0;
  let sumProc = 0;
  let sumRpm = 0;
  let sumTorque = 0;
  let sumWear = 0;
  let sumPower = 0;

  let minAirTemp = Infinity;
  let maxAirTemp = -Infinity;
  let minRpm = Infinity;
  let maxRpm = -Infinity;
  let minTorque = Infinity;
  let maxTorque = -Infinity;
  let minWear = Infinity;
  let maxWear = -Infinity;

  for (const r of records) {
    if (r.type === 'L') {
      typeLCount++;
      if (r.machineFailure === 1) typeLFailures++;
    } else if (r.type === 'H') {
      typeHCount++;
      if (r.machineFailure === 1) typeHFailures++;
    } else {
      typeMCount++;
      if (r.machineFailure === 1) typeMFailures++;
    }

    if (r.machineFailure === 1) totalFailures++;
    if (r.twf === 1) twfCount++;
    if (r.hdf === 1) hdfCount++;
    if (r.pwf === 1) pwfCount++;
    if (r.osf === 1) osfCount++;
    if (r.rnf === 1) rnfCount++;

    sumAir += r.airTemp;
    sumProc += r.processTemp;
    sumRpm += r.rotationalSpeed;
    sumTorque += r.torque;
    sumWear += r.toolWear;

    const power = r.torque * (r.rotationalSpeed * (2 * Math.PI / 60));
    sumPower += power;

    minAirTemp = Math.min(minAirTemp, r.airTemp);
    maxAirTemp = Math.max(maxAirTemp, r.airTemp);
    minRpm = Math.min(minRpm, r.rotationalSpeed);
    maxRpm = Math.max(maxRpm, r.rotationalSpeed);
    minTorque = Math.min(minTorque, r.torque);
    maxTorque = Math.max(maxTorque, r.torque);
    minWear = Math.min(minWear, r.toolWear);
    maxWear = Math.max(maxWear, r.toolWear);
  }

  const failureModes = [
    { mode: 'HDF', fullName: 'Heat Dissipation Failure', count: hdfCount, color: '#f59e0b', desc: 'Cooling thermal choke' },
    { mode: 'PWF', fullName: 'Power Failure', count: pwfCount, color: '#ef4444', desc: 'Over/under wattage trip' },
    { mode: 'OSF', fullName: 'Overstrain Failure', count: osfCount, color: '#8b5cf6', desc: 'Fatigue stress product limit' },
    { mode: 'TWF', fullName: 'Tool Wear Failure', count: twfCount, color: '#06b6d4', desc: 'Flank insert wear boundary' },
    { mode: 'RNF', fullName: 'Random Anomaly', count: rnfCount, color: '#64748b', desc: 'Stochastic transient spike' },
  ].sort((a, b) => b.count - a.count);

  const totalModeCount = failureModes.reduce((acc, m) => acc + m.count, 0) || 1;
  let cumCount = 0;

  const paretoBreakdown = failureModes.map((m) => {
    cumCount += m.count;
    const percentage = ((m.count / totalModeCount) * 100).toFixed(1) + '%';
    const cumulativePct = Math.min(100, Math.round((cumCount / totalModeCount) * 1000) / 10);
    return {
      mode: `${m.mode} (${m.fullName.split(' ')[0]})`,
      count: m.count,
      percentage,
      cumulativePct,
      color: m.color,
      desc: m.desc,
    };
  });

  const topModeObj = failureModes[0] || {
    mode: 'HDF',
    fullName: 'Heat Dissipation Failure',
    count: 0,
    desc: 'Thermal Dissipation Deficit',
  };

  const topFailureMode = {
    mode: topModeObj.mode,
    fullName: topModeObj.fullName,
    count: topModeObj.count,
    percentage: totalModeCount > 0 ? ((topModeObj.count / totalModeCount) * 100).toFixed(1) + '%' : '0%',
    description: topModeObj.desc,
  };

  return {
    totalRecords,
    totalFailures,
    failureRate: ((totalFailures / totalRecords) * 100).toFixed(2) + '%',
    nominalCount: totalRecords - totalFailures,
    typeLCount,
    typeMCount,
    typeHCount,
    typeLFailureRate: typeLCount > 0 ? ((typeLFailures / typeLCount) * 100).toFixed(1) + '%' : '0%',
    typeMFailureRate: typeMCount > 0 ? ((typeMFailures / typeMCount) * 100).toFixed(1) + '%' : '0%',
    typeHFailureRate: typeHCount > 0 ? ((typeHFailures / typeHCount) * 100).toFixed(1) + '%' : '0%',
    twfCount,
    hdfCount,
    pwfCount,
    osfCount,
    rnfCount,
    topFailureMode,
    paretoBreakdown,
    averages: {
      airTemp: Math.round((sumAir / totalRecords) * 10) / 10,
      processTemp: Math.round((sumProc / totalRecords) * 10) / 10,
      tempDiff: Math.round(((sumProc - sumAir) / totalRecords) * 10) / 10,
      rotationalSpeed: Math.round(sumRpm / totalRecords),
      torque: Math.round((sumTorque / totalRecords) * 10) / 10,
      toolWear: Math.round(sumWear / totalRecords),
      powerWatts: Math.round(sumPower / totalRecords),
    },
    ranges: {
      minAirTemp: minAirTemp === Infinity ? 295 : Math.round(minAirTemp * 10) / 10,
      maxAirTemp: maxAirTemp === -Infinity ? 305 : Math.round(maxAirTemp * 10) / 10,
      minRpm: minRpm === Infinity ? 1100 : minRpm,
      maxRpm: maxRpm === -Infinity ? 2900 : maxRpm,
      minTorque: minTorque === Infinity ? 3 : Math.round(minTorque * 10) / 10,
      maxTorque: maxTorque === -Infinity ? 80 : Math.round(maxTorque * 10) / 10,
      minWear: minWear === Infinity ? 0 : minWear,
      maxWear: maxWear === -Infinity ? 250 : maxWear,
    },
  };
}

/**
 * Generate a downloadable sample CSV template for testing
 */
export function generateSampleCsvContent(): string {
  const headers = [
    'UDI',
    'Product ID',
    'Type',
    'Air temperature [K]',
    'Process temperature [K]',
    'Rotational speed [rpm]',
    'Torque [Nm]',
    'Tool wear [min]',
    'Machine failure',
    'TWF',
    'HDF',
    'PWF',
    'OSF',
    'RNF',
    'Subsystem',
    'Site Location'
  ];

  const sampleRows = [
    [1001, 'M14860', 'M', 298.1, 308.6, 1551, 42.8, 214, 1, 1, 0, 0, 0, 0, 'Heavy Rotary Spindle Head', 'Shaft 4B - Deep Pit Bore'],
    [1002, 'L47180', 'L', 298.9, 309.0, 1410, 65.7, 191, 1, 0, 0, 0, 1, 0, 'Torque Transfer Coupling', 'East Tunnel - Primary Crusher'],
    [1003, 'L47220', 'L', 298.2, 308.7, 1334, 54.2, 145, 1, 0, 1, 0, 0, 0, 'Coolant Jacket Exchanger', 'Ventilation Shaft Extraction'],
    [1004, 'H29420', 'H', 298.8, 309.2, 2861, 4.6, 143, 1, 0, 0, 1, 0, 0, 'Drive Inverter & Stator', 'Highwall Dragline Rig #2'],
    [1005, 'M15020', 'M', 297.4, 307.9, 1512, 38.4, 82, 0, 0, 0, 0, 0, 0, 'Heavy Rotary Spindle Head', 'Shaft 4B - Deep Pit Bore'],
    [1006, 'L47350', 'L', 299.1, 309.8, 1480, 41.2, 45, 0, 0, 0, 0, 0, 0, 'Cutter Drum Transmission', 'Continuous Miner Rig A3'],
    [1007, 'H29580', 'H', 300.2, 310.5, 1380, 68.4, 198, 1, 0, 0, 0, 1, 0, 'Drive Inverter & Stator', 'Shaft 2 Level - Ore Slurry Pump'],
    [1008, 'L47440', 'L', 300.8, 311.2, 1240, 71.0, 220, 1, 1, 1, 0, 1, 0, 'Armored Face Conveyor Drive', 'Underground Longwall Face 7'],
    [1009, 'M15210', 'M', 299.5, 309.6, 1535, 39.8, 165, 0, 0, 0, 0, 0, 0, 'Main Roller Bearing Unit', 'East Tunnel - Primary Crusher'],
    [1010, 'L47510', 'L', 298.5, 308.2, 2450, 18.2, 92, 0, 0, 0, 0, 0, 0, 'Pressure Relief Manifold', 'Hydraulic Breaker Station #4'],
    [1011, 'H29730', 'H', 297.8, 308.1, 1620, 36.5, 232, 1, 1, 0, 0, 0, 0, 'Heavy Rotary Spindle Head', 'Highwall Dragline Rig #2'],
    [1012, 'L47590', 'L', 299.9, 310.8, 1720, 48.0, 180, 1, 0, 0, 0, 0, 1, 'Spindle Bearing Hub', 'East Tunnel - Primary Crusher']
  ];

  return [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
}
