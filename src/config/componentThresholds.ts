export type Threshold = {
  warning?: number;
  critical?: number;
  min?: number;
  max?: number;
  unit: string;

  source: string;
  sourceUrl?: string;

  confidence: "verified" | "data-derived" | "unavailable";
};

export type ComponentThresholdProfile = {
  subsystem: string;

  rotationalSpeed?: Threshold;
  torque?: Threshold;
  airTemperature?: Threshold;
  processTemperature?: Threshold;
  temperatureDifferential?: Threshold;
  toolWear?: Threshold;
  vibration?: Threshold;
  power?: Threshold;
};

const derived = (threshold: Omit<Threshold, "source" | "confidence">): Threshold => ({
  ...threshold,
  source: "Generated from dataset operating envelope; verify against OEM/site limits",
  confidence: "data-derived",
});

export const COMPONENT_THRESHOLDS: Record<
  string,
  ComponentThresholdProfile
> = {
  "Primary Crushing": {
    subsystem: "Primary Crushing",
    rotationalSpeed: derived({ warning: 1650, critical: 1850, unit: "RPM" }),
    torque: derived({ warning: 58, critical: 72, unit: "Nm" }),
    airTemperature: derived({ warning: 303, critical: 308, unit: "K" }),
    processTemperature: derived({ warning: 315, critical: 320, unit: "K" }),
    temperatureDifferential: derived({ warning: 9, critical: 8.6, unit: "K" }),
    toolWear: derived({ warning: 160, critical: 210, unit: "min" }),
    power: derived({ min: 3.5, max: 9, unit: "kW" }),
  },

  "Grinding Mill": {
    subsystem: "Grinding Mill",
    rotationalSpeed: derived({ warning: 1700, critical: 1900, unit: "RPM" }),
    torque: derived({ warning: 55, critical: 68, unit: "Nm" }),
    airTemperature: derived({ warning: 303, critical: 308, unit: "K" }),
    processTemperature: derived({ warning: 316, critical: 321, unit: "K" }),
    temperatureDifferential: derived({ warning: 9, critical: 8.6, unit: "K" }),
    toolWear: derived({ warning: 155, critical: 205, unit: "min" }),
    power: derived({ min: 3.8, max: 8.8, unit: "kW" }),
  },

  "Rotary Drill": {
    subsystem: "Rotary Drill",
    rotationalSpeed: derived({ warning: 1450, critical: 1650, unit: "RPM" }),
    torque: derived({ warning: 62, critical: 78, unit: "Nm" }),
    airTemperature: derived({ warning: 304, critical: 309, unit: "K" }),
    processTemperature: derived({ warning: 318, critical: 323, unit: "K" }),
    temperatureDifferential: derived({ warning: 9, critical: 8.6, unit: "K" }),
    toolWear: derived({ warning: 170, critical: 220, unit: "min" }),
    power: derived({ min: 3.2, max: 9.2, unit: "kW" }),
  },

  "Haul Drive": {
    subsystem: "Haul Drive",
    rotationalSpeed: derived({ warning: 1750, critical: 1950, unit: "RPM" }),
    torque: derived({ warning: 50, critical: 65, unit: "Nm" }),
    airTemperature: derived({ warning: 305, critical: 310, unit: "K" }),
    processTemperature: derived({ warning: 320, critical: 325, unit: "K" }),
    temperatureDifferential: derived({ warning: 9, critical: 8.6, unit: "K" }),
    toolWear: derived({ warning: 165, critical: 215, unit: "min" }),
    power: derived({ min: 4, max: 9.5, unit: "kW" }),
  },

  "Conveyor Drive": {
    subsystem: "Conveyor Drive",
    rotationalSpeed: derived({ warning: 1600, critical: 1800, unit: "RPM" }),
    torque: derived({ warning: 48, critical: 62, unit: "Nm" }),
    airTemperature: derived({ warning: 304, critical: 309, unit: "K" }),
    processTemperature: derived({ warning: 314, critical: 319, unit: "K" }),
    temperatureDifferential: derived({ warning: 9, critical: 8.6, unit: "K" }),
    toolWear: derived({ warning: 150, critical: 200, unit: "min" }),
    power: derived({ min: 3.4, max: 8.5, unit: "kW" }),
  },

  "Slurry Pump": {
    subsystem: "Slurry Pump",
    rotationalSpeed: derived({ warning: 1500, critical: 1700, unit: "RPM" }),
    torque: derived({ warning: 45, critical: 60, unit: "Nm" }),
    airTemperature: derived({ warning: 302, critical: 307, unit: "K" }),
    processTemperature: derived({ warning: 312, critical: 317, unit: "K" }),
    temperatureDifferential: derived({ warning: 9, critical: 8.6, unit: "K" }),
    toolWear: derived({ warning: 145, critical: 195, unit: "min" }),
    power: derived({ min: 3, max: 8, unit: "kW" }),
  },
};

export const getComponentThresholds = (subsystem: string): ComponentThresholdProfile =>
  COMPONENT_THRESHOLDS[subsystem] || COMPONENT_THRESHOLDS["Primary Crushing"];