import { ContactShadows, Environment, Lightformer, OrbitControls, useProgress } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { registerCapture } from "../lib/capture";
import { orbitLimits } from "../lib/orbit-limits";
import { zoneCameraPosition } from "../lib/zone-camera";
import { useStudio } from "../store";
import { DEFAULT_STUDIO_BACKGROUND } from "../contract";

import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { Shirt } from "./ProductModel";

function Rig() {
  const product = useStudio((s) => s.product)!;
  const mode = useStudio((s) => s.mode);
  const focus = useStudio((s) => s.cameraFocus);
  const activeZone = useStudio((s) => s.activeZone);
  const autoRotateOn = useStudio((s) => s.autoRotate);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl, scene } = useThree();
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);

  // Smoothly fly to the active print zone (orbiting around the model, not the world origin).
  useEffect(() => {
    if (focus === 0) return;
    const zone = product.printZones.find((z) => z.id === activeZone);
    if (!zone) return;
    const target = new THREE.Vector3(...product.camera.target);
    const dest = new THREE.Vector3(...zoneCameraPosition(zone, product.camera.target, product.camera.position));
    anim.current = { from: camera.position.clone().sub(target), to: dest.clone().sub(target), t: 0 };
    let raf = 0;
    const step = () => {
      const a = anim.current;
      if (!a) return;
      a.t = Math.min(1, a.t + 0.05);
      const e = 1 - Math.pow(1 - a.t, 3);
      const fromS = new THREE.Spherical().setFromVector3(a.from);
      const toS = new THREE.Spherical().setFromVector3(a.to);
      let dTheta = toS.theta - fromS.theta;
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(fromS.radius, toS.radius, e),
        THREE.MathUtils.lerp(fromS.phi, toS.phi, e),
        fromS.theta + dTheta * e,
      );
      camera.position.setFromSpherical(s).add(target);
      if (a.t >= 1) camera.position.copy(dest);
      controls.current?.update();
      if (a.t < 1) raf = requestAnimationFrame(step);
      else anim.current = null;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Multi-angle mockup capture
  useEffect(() => {
    // Capture positions come from the product config (`capture.shots`).
    registerCapture(async (requests) => {
      const saved = camera.position.clone();
      const guides: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData["guide"] && o.visible) {
          guides.push(o);
          o.visible = false;
        }
      });
      const autoRotate = controls.current?.autoRotate ?? false;
      if (controls.current) controls.current.autoRotate = false;
      const target = new THREE.Vector3(...product.camera.target);
      // The canvas is transparent (the page behind it carries the colour), so mockups are composited on the chosen background.
      const background = useStudio.getState().bgColor ?? product.background ?? DEFAULT_STUDIO_BACKGROUND;
      const out = [];
      for (const { angle, position: pos } of requests) {
        camera.position.set(...pos);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        gl.render(scene, camera);
        out.push({ angle, dataUrl: withBackground(gl.domElement, background) });
        await new Promise((r) => setTimeout(r, 16));
      }
      guides.forEach((g) => (g.visible = true));
      camera.position.copy(saved);
      if (controls.current) controls.current.autoRotate = autoRotate;
      controls.current?.update();
      return out;
    });
    return () => registerCapture(null);
  }, [camera, gl, scene, product]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={product.camera.target}
      enablePan={false}
      minDistance={product.camera.minDistance}
      maxDistance={product.camera.maxDistance}
      enableDamping
      dampingFactor={0.08}
      {...orbitLimits(product.camera, product.rotation)}
      autoRotate={
        mode === "preview"
          ? autoRotateOn && product.environment.autoRotateInPreview
          : !!product.rotation?.autoRotateInEdit && autoRotateOn
      }
      autoRotateSpeed={product.rotation?.autoRotateSpeed ?? product.environment.autoRotateSpeed}
      onStart={() => (anim.current = null)}
    />
  );
}

/** PNG data URL of the WebGL canvas painted over a solid background colour. */
function withBackground(source: HTMLCanvasElement, color: string): string {
  const flat = document.createElement("canvas");
  flat.width = source.width;
  flat.height = source.height;
  const ctx = flat.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(source, 0, 0);
  return flat.toDataURL("image/png");
}

/** Mirrors drei's loading state into the studio store so the page can show its loading overlay. */
function LoadingBridge() {
  const { active, progress } = useProgress();
  useEffect(() => {
    useStudio.getState().setModelLoading(active || progress < 100);
    return () => useStudio.getState().setModelLoading(false);
  }, [active, progress]);
  return null;
}

export function StudioCanvas() {
  const product = useStudio((s) => s.product);
  if (!product) return null;
  const { light, camera, environment } = product;
  return (
    <CanvasErrorBoundary modelUrl={product.model.url}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: camera.position, fov: camera.fov, near: 0.05, far: 20 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        onPointerMissed={() => useStudio.getState().select(null)}
        onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          useStudio.getState().setCanvasError("The 3D canvas lost its graphics context.");
        })}
        className="touch-none"
      >
        <ambientLight intensity={light.ambientIntensity} />
        <directionalLight position={light.key.position} intensity={light.key.intensity} castShadow />
        <directionalLight position={light.rim.position} intensity={light.rim.intensity} />
        <Suspense fallback={null}>
          <Shirt />
          <Environment environmentIntensity={environment.intensity}>
            <Lightformer intensity={2} position={[0, 5, 2]} scale={[10, 10, 1]} />
            <Lightformer intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
            <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
          </Environment>
        </Suspense>
        <ContactShadows
          position={[0, environment.contactShadow.y, 0]}
          opacity={environment.contactShadow.opacity}
          blur={environment.contactShadow.blur}
          scale={1.6}
          far={1.2}
        />
        <Rig />
        <LoadingBridge />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
