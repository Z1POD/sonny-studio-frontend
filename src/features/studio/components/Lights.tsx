// src/features/studio/components/Lights.tsx


export interface LightConfig {
  ambient?: number;
  key?: { position: [number, number, number]; intensity: number };
  fill?: { position: [number, number, number]; intensity: number };
  rim?: { position: [number, number, number]; intensity: number };
}

interface LightsProps {
  lighting?: LightConfig;
}

export function Lights({ lighting }: LightsProps) {
  if (!lighting) {
    return (
      <>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[3, 5, 3]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-2, 3, 2]}
          intensity={0.6}
          color="#7aa2ff"
        />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={lighting.ambient ?? 0.5} />
      {lighting.key && (
        <directionalLight
          position={lighting.key.position}
          intensity={lighting.key.intensity}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0001}
        />
      )}
      {lighting.fill && (
        <directionalLight
          position={lighting.fill.position}
          intensity={lighting.fill.intensity}
          color="#7aa2ff"
        />
      )}
      {lighting.rim && (
        <spotLight
          position={lighting.rim.position}
          intensity={lighting.rim.intensity}
          angle={0.3}
          penumbra={1}
          castShadow
        />
      )}
    </>
  );
}