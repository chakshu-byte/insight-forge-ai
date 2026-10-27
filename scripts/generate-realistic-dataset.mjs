import { writeFileSync } from 'node:fs';

const headers = [
  'UDI', 'Product ID', 'Type', 'Air temperature [K]', 'Process temperature [K]',
  'Rotational speed [rpm]', 'Torque [Nm]', 'Tool wear [min]', 'Machine failure',
  'TWF', 'HDF', 'PWF', 'OSF', 'RNF', 'Subsystem', 'Site Location',
  'Speed warning [rpm]', 'Speed critical [rpm]', 'Torque warning [Nm]', 'Torque critical [Nm]',
  'Air temperature warning [K]', 'Air temperature critical [K]',
  'Process temperature warning [K]', 'Process temperature critical [K]',
  'Temperature differential warning [K]', 'Temperature differential critical [K]',
  'Tool wear warning [min]', 'Tool wear critical [min]',
  'Power minimum [kW]', 'Power maximum [kW]', 'Threshold source', 'Threshold confidence'
];

const sites = [
  ['North Pit - Crusher 02', 'Primary Crushing'],
  ['East Ridge - Mill 04', 'Grinding Mill'],
  ['South Yard - Drill 07', 'Rotary Drill'],
  ['West Bench - Haul 03', 'Haul Drive'],
  ['Central Plant - Line 01', 'Conveyor Drive'],
  ['Ore Processing - Pump 05', 'Slurry Pump']
];

const rows = [headers.join(',')];
const round = (value, digits = 1) => value.toFixed(digits);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const thresholds = {
  'Primary Crushing': [1650, 1850, 58, 72, 303, 308, 315, 320, 9, 8.6, 160, 210, 3.5, 9],
  'Grinding Mill': [1700, 1900, 55, 68, 303, 308, 316, 321, 9, 8.6, 155, 205, 3.8, 8.8],
  'Rotary Drill': [1450, 1650, 62, 78, 304, 309, 318, 323, 9, 8.6, 170, 220, 3.2, 9.2],
  'Haul Drive': [1750, 1950, 50, 65, 305, 310, 320, 325, 9, 8.6, 165, 215, 4, 9.5],
  'Conveyor Drive': [1600, 1800, 48, 62, 304, 309, 314, 319, 9, 8.6, 150, 200, 3.4, 8.5],
  'Slurry Pump': [1500, 1700, 45, 60, 302, 307, 312, 317, 9, 8.6, 145, 195, 3, 8]
};

for (let index = 0; index < 2000; index += 1) {
  const udi = 200001 + index;
  const type = index % 10 < 5 ? 'L' : index % 10 < 8 ? 'M' : 'H';
  const phase = index % 240;
  const cycle = Math.sin(index * 0.17);
  const slowCycle = Math.sin(index * 0.031);
  const airTemp = clamp(296.8 + slowCycle * 2.2 + Math.sin(index * 0.13) * 0.7, 294.8, 303.8);
  let processDelta = 10.4 + Math.sin(index * 0.11) * 0.7;
  let speed = 1500 + Math.round(cycle * 125 + Math.sin(index * 0.047) * 95);
  let torque = 40 + cycle * 5 + slowCycle * 3;
  let wear = Math.round(18 + (phase / 240) * 205 + (index % 7) * 2);
  let twf = 0;
  let hdf = 0;
  let pwf = 0;
  let osf = 0;
  let rnf = 0;

  // Correlated operating regimes model common field failure signatures.
  const regime = index % 37;
  if (regime === 3 || regime === 19) {
    wear = 205 + (index % 35);
    twf = 1;
  } else if (regime === 7) {
    processDelta = 7.6 + (index % 8) * 0.12;
    speed = 1240 + (index % 11) * 13;
    torque = 52 + (index % 9) * 1.5;
    hdf = 1;
  } else if (regime === 11 || regime === 29) {
    speed = 2650 + (index % 8) * 38;
    torque = 4.5 + (index % 6) * 0.55;
    pwf = 1;
  } else if (regime === 15) {
    wear = 175 + (index % 20);
    torque = type === 'L' ? 66 + (index % 6) * 1.4 : 62 + (index % 6) * 1.3;
    osf = 1;
  } else if (regime === 23) {
    speed = 2780 + (index % 5) * 24;
    torque = 74 + (index % 4) * 1.2;
    rnf = 1;
  }

  const processTemp = airTemp + processDelta;
  const power = torque * speed * 2 * Math.PI / 60;
  const machineFailure = twf || hdf || pwf || osf || rnf ? 1 : 0;
  const site = sites[index % sites.length];
  const componentThresholds = thresholds[site[1]];
  const productId = `${type}${String(30000 + index).padStart(5, '0')}`;
  const fields = [
    udi, productId, type, round(airTemp), round(processTemp), speed,
    round(torque), wear, machineFailure, twf, hdf, pwf, osf, rnf,
    site[1], site[0], ...componentThresholds,
    'Generated from dataset operating envelope; verify against OEM/site limits', 'data-derived'
  ];
  rows.push(fields.join(','));
}

writeFileSync('assets/realistic-field-return-telemetry-2000.csv', `${rows.join('\n')}\n`);
console.log(`Generated ${rows.length - 1} records.`);
