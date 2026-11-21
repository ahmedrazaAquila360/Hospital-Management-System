// Pre-renders the bundled 3D dentition as still images for devices that can't run the
// interactive WebGL view (no GPU, WebGL blocked, or slow software rendering). Writes
// public/models/fallback/*.webp plus views.json with, for every image, where each
// tooth's label sits — so the fallback viewer can show clickable, status-coloured labels.
//
// Uses three.js from node_modules and a Playwright Chromium install.
// Usage: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/render-dentition-fallback.mjs
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(".");
const OUT = "public/models/fallback";
const MODEL = "/public/models/dentition-bp3d.glb";
const SIZE = { width: 1200, height: 760 };
const YAWS = [-60, -45, -30, -15, 0, 15, 30, 45, 60];

const { chromium } = await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE ?? "playwright", "index.mjs")).href);

const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const W = ${SIZE.width}, H = ${SIZE.height};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
// Same studio lighting as the live viewer.
scene.add(new THREE.HemisphereLight("#ffffff", "#e8dcd4", 0.55));
for (const [p, i, c] of [[[40, 110, 140], 1.35, "#ffffff"], [[-110, 20, 80], 0.45, "#f4f7ff"], [[110, -30, 70], 0.35, "#ffffff"], [[0, 60, -160], 0.5, "#ffffff"]]) {
  const l = new THREE.DirectionalLight(c, i);
  l.position.set(...p);
  scene.add(l);
}

const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync("${MODEL}");
const model = gltf.scene;
scene.add(model);
model.updateMatrixWorld(true);
// Teeth and gums only (the jaw bone is an optional layer in the live viewer).
for (const name of ["maxilla", "mandible"]) { const o = model.getObjectByName(name); if (o) o.visible = false; }

// Tooth label anchors, as in the live viewer: just buccal of each crown.
const teeth = [];
model.traverse((o) => {
  const m = /^tooth_(\\d\\d)$/.exec(o.name);
  if (!m) return;
  const enamel = model.getObjectByName(o.name + "_enamel");
  const box = new THREE.Box3().setFromBufferAttribute(enamel.geometry.attributes.position);
  // Quantized positions: account for the mesh's own (dequantization) transform.
  box.applyMatrix4(enamel.matrix);
  const h = box.max.y, hz = (box.max.z - box.min.z) / 2;
  const q = o.getWorldQuaternion(new THREE.Quaternion());
  const p = o.getWorldPosition(new THREE.Vector3());
  teeth.push({
    n: Number(m[1]),
    upper: Number(m[1]) < 30,
    anchor: new THREE.Vector3(0, h * 0.45, hz + 5).applyQuaternion(q).add(p),
    normal: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
    crown: new THREE.Vector3(0, h * 0.55, 0).applyQuaternion(q).add(p),
  });
});

function frameBox(which) {
  const box = new THREE.Box3();
  const r = new THREE.Vector3(5, 6, 5);
  for (const t of teeth) if (which === "full" || (which === "upper") === t.upper) box.union(new THREE.Box3(t.crown.clone().sub(r), t.crown.clone().add(r)));
  return box;
}
const TAN = Math.tan((16 * Math.PI) / 180);
const fit = (w, h) => 1.1 * Math.max(60, h / 2 / TAN, w / 2 / (TAN * (W / H)));
const camera = new THREE.PerspectiveCamera(32, W / H, 1, 2000);

function shot(which, pose) {
  const box = frameBox(which);
  const t = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  // Upper occlusal views look up at the upper arch: hide the lower one, and vice versa.
  model.traverse((o) => {
    const m = /^(tooth_(\\d)\\d|gingiva_(upper|lower))$/.exec(o.name);
    if (!m) return;
    const upper = m[2] ? Number(m[2]) <= 2 : m[3] === "upper";
    o.visible = which === "full" || (which === "upper") === upper;
  });
  if (pose.kind === "front") {
    const d = fit(s.x + 10, s.y + s.z * 0.15 + 8);
    const yaw = (pose.yaw * Math.PI) / 180;
    camera.position.set(Math.sin(yaw) * d, t.y + d * 0.08, t.z + Math.cos(yaw) * d);
  } else {
    const d = fit(s.x + 26, s.z + 28);
    camera.position.set(0, t.y + (which === "upper" ? -d : d), t.z + d * 0.12);
  }
  camera.lookAt(t);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  const anchors = {};
  const v = new THREE.Vector3(), toCam = new THREE.Vector3();
  for (const tooth of teeth) {
    if (which !== "full" && (which === "upper") !== tooth.upper) continue;
    toCam.subVectors(camera.position, tooth.anchor).normalize();
    if (tooth.normal.dot(toCam) < -0.45) continue; // behind the arch from this side
    v.copy(tooth.anchor).project(camera);
    anchors[tooth.n] = [Math.round(((v.x + 1) / 2) * 1000) / 10, Math.round(((1 - v.y) / 2) * 1000) / 10];
  }
  return { image: renderer.domElement.toDataURL("image/webp", 0.82), anchors };
}
window.renderAll = (yaws) => ({
  front: yaws.map((yaw) => ({ yaw, ...shot("full", { kind: "front", yaw }) })),
  upper: [shot("upper", { kind: "occlusal" })],
  lower: [shot("lower", { kind: "occlusal" })],
});
window.ready = true;
</script></body></html>`;

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    const body = await readFile(join(ROOT, decodeURIComponent(req.url.split("?")[0])));
    res.writeHead(200, { "content-type": TYPES[extname(req.url)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: SIZE });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const result = await page.evaluate((yaws) => window.renderAll(yaws), YAWS);
await browser.close();
server.close();

await mkdir(OUT, { recursive: true });
const manifest = {
  width: SIZE.width,
  height: SIZE.height,
  // The images are renders of BodyParts3D-derived data (CC BY-SA 2.1 JP): credit travels with them.
  credit: { text: "Anatomy: BodyParts3D © DBCLS, CC BY-SA 2.1 JP (modified)", url: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" },
  views: {},
};
let bytes = 0;
for (const [view, frames] of Object.entries(result)) {
  manifest.views[view] = frames.map((f, i) => {
    const file = `${view}${view === "front" ? `-${String(i).padStart(2, "0")}` : ""}.webp`;
    const data = Buffer.from(f.image.split(",")[1], "base64");
    bytes += data.length;
    void writeFile(join(OUT, file), data);
    return { src: `/models/fallback/${file}`, yaw: f.yaw ?? null, anchors: f.anchors };
  });
}
await writeFile(join(OUT, "views.json"), JSON.stringify(manifest));
console.log(`rendered ${YAWS.length + 2} views (${(bytes / 1024).toFixed(0)} KB) into ${OUT}`);
