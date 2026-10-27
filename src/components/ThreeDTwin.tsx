import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import type { FailureMode, PredictionResult, TelemetryState } from '../types';

/**
 * 3D twin (Part 1 UI, step 3) — a schematic spindle, not a CAD-accurate model.
 *
 * Built from primitives (shaft, housing, rings, tool tip) so it needs no
 * external model file. Colour follows the live risk: emerald below 30%,
 * amber 30–50% or warning, rose when a failure is flagged. Click a part to
 * select its failure mode; the panel below shows that mode's live risk and
 * threshold note. It is lazy-loaded from MachineDigitalTwin, so the 2D
 * twin stays the default and the three.js chunk only downloads on demand.
 */

interface ThreeDTwinProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
}

const PARTS: Array<{ id: string; mode: FailureMode; label: string; position: [number, number, number]; color: string }> = [
  { id: 'tool', mode: 'TWF', label: 'Tool tip — TWF', position: [0, -1.6, 0], color: '#f59e0b' },
  { id: 'housing', mode: 'HDF', label: 'Coolant housing — HDF', position: [1.4, 0, 0], color: '#06b6d4' },
  { id: 'motor', mode: 'PWF', label: 'Drive motor — PWF', position: [-1.4, 0, 0], color: '#a78bfa' },
  { id: 'coupling', mode: 'OSF', label: 'Torque coupling — OSF', position: [0, 1.4, 0], color: '#f97316' },
];

const Spindle: React.FC<{ prediction: PredictionResult; onSelect: (mode: FailureMode) => void; selected: FailureMode | null }> = ({ prediction, onSelect, selected }) => {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.25;
  });
  const riskColor = prediction.isMachineFailure
    ? '#f43f5e'
    : prediction.machineFailureProbability >= 0.3
    ? '#f59e0b'
    : '#10b981';
  return (
    <group ref={group}>
      {/* Shaft */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 4.2, 32]} />
        <meshStandardMaterial color={riskColor} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Housing rings */}
      <mesh position={[-1.2, 0, 0]}>
        <torusGeometry args={[0.7, 0.18, 16, 48]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 0, 0]}>
        <torusGeometry args={[0.7, 0.18, 16, 48]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Clickable part markers */}
      {PARTS.map((part) => (
        <mesh
          key={part.id}
          position={part.position}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(part.mode);
          }}
        >
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial
            color={part.color}
            emissive={selected === part.mode ? part.color : '#000000'}
            emissiveIntensity={selected === part.mode ? 0.8 : 0}
          />
        </mesh>
      ))}
    </group>
  );
};

export const ThreeDTwin: React.FC<ThreeDTwinProps> = ({ telemetry, prediction }) => {
  const [selected, setSelected] = useState<FailureMode | null>(null);
  const selectedData = selected ? prediction.failures[selected] : null;
  return (
    <div className="space-y-3">
      <div className="h-[320px] sm:h-[380px] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
        <Canvas camera={{ position: [4, 2.5, 5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <Spindle prediction={prediction} onSelect={setSelected} selected={selected} />
          <OrbitControls enablePan={false} />
        </Canvas>
      </div>
      <p className="text-[11px] text-slate-400 font-mono">
        Schematic 3D spindle — drag to orbit, scroll to zoom, click a coloured marker to select its failure mode.
        Shaft colour follows live risk ({(prediction.machineFailureProbability * 100).toFixed(1)}% for {telemetry.productID}).
      </p>
      {selectedData ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-1 font-mono text-xs">
          <div className="font-bold text-slate-200">{selectedData.fullName} ({selectedData.mode})</div>
          <div className="text-slate-300">Risk: {(selectedData.probability * 100).toFixed(1)}% — {selectedData.isTriggered ? 'TRIPPED' : 'Not tripped'}</div>
          <div className="text-slate-400">{selectedData.description}</div>
          <div className="text-amber-300/90">{selectedData.thresholdNote}</div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 font-mono">Click a coloured marker above to inspect its failure mode.</p>
      )}
    </div>
  );
};
