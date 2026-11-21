"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildCrownGeometry, buildRootGeometry, toothSpec } from "@/components/dental-chart/three/tooth-geometry";

export type GlassToothSceneProps = {
  /** Surface the tooth sits on — picks the rim treatment so the edge always reads. */
  tone: "light" | "dark";
  animate: boolean;
  /** Pause rendering while the canvas is off screen. */
  active: boolean;
};

// Lower first molar from the clinical chart's procedural dentition: two splayed roots.
function buildToothGeometry() {
  const spec = toothSpec(36);
  const parts = [buildCrownGeometry(spec, 1, true), buildRootGeometry(spec, 1)].map((g) => {
    const c = g.index ? g.toNonIndexed() : g;
    c.deleteAttribute("normal");
    return c;
  });
  let geo = mergeGeometries(parts)!;
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  geo.translate(-center.x, -center.y, -center.z);
  const height = box.max.y - box.min.y;
  geo.scale(2 / height, 2 / height, 2 / height);
  return geo;
}

const RIM_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const RIM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  uniform float uInvert;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    // uInvert = 0 → bright at the silhouette (rim); 1 → dense towards the centre (body).
    float f = pow(mix(1.0 - facing, facing, uInvert), uPower);
    gl_FragColor = vec4(uColor, clamp(f * uIntensity, 0.0, 1.0));
  }
`;

function fresnelMaterial(color: string, power: number, intensity: number, invert: boolean, additive: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: RIM_VERTEX,
    fragmentShader: RIM_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
      uInvert: { value: invert ? 1 : 0 },
    },
  });
}

// Soft luminous haze inside the crown and roots — the "energised glass" look.
function buildHaze() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);

  const rand = mulberry32(11);
  const puffs = [
    [0, 0.45, 0.05, 0.9],
    [-0.18, 0.3, -0.05, 0.7],
    [0.2, 0.28, 0.08, 0.65],
    [0.05, 0.6, -0.1, 0.6],
    [-0.16, -0.25, 0, 0.55],
    [0.17, -0.3, 0.02, 0.5],
    [0, 0.05, 0, 0.7],
  ].map(([x, y, z, scale]) => ({
    position: [x + (rand() - 0.5) * 0.05, y, z] as [number, number, number],
    scale: scale * (0.9 + rand() * 0.2),
    opacity: 0.16 + rand() * 0.12,
  }));
  return { texture, puffs };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Tooth({ tone, animate }: { tone: GlassToothSceneProps["tone"]; animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => buildToothGeometry(), []);
  const haze = useMemo(() => buildHaze(), []);
  const dark = tone === "dark";
  const body = useMemo(() => fresnelMaterial(dark ? "#0b56b8" : "#0a5cc2", 1.15, dark ? 0.85 : 0.9, true, false), [dark]);
  const rim = useMemo(
    () => (dark ? fresnelMaterial("#8fe9ff", 2.4, 1.15, false, true) : fresnelMaterial("#f1fbff", 2.2, 0.95, false, false)),
    [dark]
  );

  useFrame(({ clock, pointer }, delta) => {
    const g = group.current;
    if (!g) return;
    if (animate) {
      g.rotation.y += delta * 0.32;
      g.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.04;
    }
    // Lean gently towards the pointer.
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.12 - pointer.y * 0.12, 0.05);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -0.06 + pointer.x * 0.08, 0.05);
  });

  return (
    <group ref={group} rotation={[0.12, -0.5, -0.06]}>
      {/* Inner wall of the glass, for a sense of thickness. */}
      <mesh geometry={geometry} renderOrder={0}>
        <meshPhysicalMaterial
          side={THREE.BackSide}
          color={dark ? "#3f9be6" : "#5aaef0"}
          roughness={0.2}
          transparent
          opacity={dark ? 0.45 : 0.55}
          depthWrite={false}
          envMapIntensity={1.2}
        />
      </mesh>
      {/* Deep-blue body, densest at the centre and clearing towards the edges. */}
      <mesh geometry={geometry} scale={0.96} material={body} renderOrder={1} />
      {haze.puffs.map((p, i) => (
        <sprite key={i} position={p.position} scale={p.scale} renderOrder={2}>
          <spriteMaterial
            map={haze.texture}
            color={dark ? "#7fe0ff" : "#8fd9ff"}
            transparent
            opacity={p.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
      {/* Glossy outer surface carrying the studio reflections. */}
      <mesh geometry={geometry} renderOrder={3}>
        <meshPhysicalMaterial
          color={dark ? "#9ad8ff" : "#a9dcff"}
          roughness={0.04}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.03}
          iridescence={0.5}
          iridescenceIOR={1.3}
          envMapIntensity={2.2}
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </mesh>
      {/* Reflection-only layer: black diffuse, additive, so studio highlights stay bright. */}
      <mesh geometry={geometry} renderOrder={4}>
        <meshPhysicalMaterial
          color="#000000"
          roughness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.04}
          envMapIntensity={2.4}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geometry} scale={1.003} material={rim} renderOrder={5} />
    </group>
  );
}

export default function GlassToothScene({ tone, animate, active }: GlassToothSceneProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 0.1, far: 50, position: [0, 0.15, 4.7] }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-4, -1, 2]} intensity={0.9} color="#7fd8ff" />
      <Environment resolution={128} frames={1}>
        <color attach="background" args={["#0b3f7f"]} />
        <Lightformer intensity={3} position={[0, 4, 6]} scale={[10, 2, 1]} />
        <Lightformer intensity={2.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.5} scale={[2, 8, 1]} color="#c9f1ff" />
        <Lightformer intensity={1.6} position={[6, -1, 3]} rotation-y={-Math.PI / 2.5} scale={[2, 6, 1]} color="#7fd0ff" />
        <Lightformer intensity={0.8} position={[0, -5, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} color="#21bce8" />
      </Environment>
      <Tooth tone={tone} animate={animate} />
    </Canvas>
  );
}
