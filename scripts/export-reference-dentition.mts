// Exports DentalHub's built-in schematic dentition as a GLB that follows the 3D model
// contract in docs/dental-3d-model-spec.md: same node names, tooth frames, units and
// arch position. Give it to a 3D artist as the template to replace mesh-for-mesh, or
// use it to test the GLB loading path. It is NOT an anatomical model.
//
// Usage: pnpm exec tsx scripts/export-reference-dentition.mts [out.glb]
import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { proceduralAnatomy } from "../src/components/dental-chart/three/anatomy";

// GLTFExporter reads its binary Blob through FileReader, which Node doesn't have.
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

const out = process.argv[2] ?? "dentalhub-reference-dentition.glb";
const anatomy = proceduralAnatomy();

const layerMaterial = (name: string) =>
  new THREE.MeshStandardMaterial({ name, color: "#ffffff", vertexColors: true, roughness: 0.45 });
const materials = {
  enamel: layerMaterial("enamel"),
  dentin: layerMaterial("dentin"),
  pulp: new THREE.MeshStandardMaterial({ name: "pulp", color: "#d4767c", roughness: 0.55 }),
  gingiva: layerMaterial("gingiva"),
};

const scene = new THREE.Scene();
scene.name = "dentalhub_dentition";

for (const [n, tooth] of anatomy.teeth) {
  const placement = anatomy.layout.get(n)!;
  const node = new THREE.Object3D();
  node.name = `tooth_${n}`;
  node.position.copy(placement.position);
  node.quaternion.copy(placement.quaternion);

  const enamel = new THREE.Mesh(tooth.enamel.geometry, materials.enamel);
  enamel.name = `tooth_${n}_enamel`;
  // One dentin mesh per tooth: root plus coronal dentin.
  const dentin = new THREE.Mesh(mergeGeometries(tooth.dentin.map((d) => d.geometry))!, materials.dentin);
  dentin.name = `tooth_${n}_dentin`;
  node.add(enamel, dentin);
  if (tooth.pulp) {
    const pulp = new THREE.Mesh(tooth.pulp.geometry, materials.pulp);
    pulp.name = `tooth_${n}_pulp`;
    node.add(pulp);
  }
  scene.add(node);
}

for (const [jaw, part] of Object.entries(anatomy.gums)) {
  if (!part) continue;
  const mesh = new THREE.Mesh(part.geometry, materials.gingiva);
  mesh.name = `gingiva_${jaw}`;
  scene.add(mesh);
}

const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
await writeFile(out, Buffer.from(glb));
console.log(`wrote ${out} (${(glb.byteLength / 1024 / 1024).toFixed(1)} MB, ${anatomy.teeth.size} teeth)`);
