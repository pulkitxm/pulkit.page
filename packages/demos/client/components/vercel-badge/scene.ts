import { type RigidBody, RigidBodyType } from "@dimforge/rapier3d-compat";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import {
  AmbientLight,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  type Object3D,
  type PerspectiveCamera,
  Raycaster,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from "three";
import type { Cancel } from "../../lib/dom.ts";
import type { Slot } from "../../lib/scheduler.ts";
import { type BadgeAssets, buildGraph } from "./assets.ts";
import { renderEnvironment } from "./environment.ts";
import { createRope } from "./physics.ts";

const maxSpeed = 50;
const minSpeed = 10;

export interface Viewport {
  width: number;
  height: number;
}

export interface BadgeScene {
  assets: BadgeAssets;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  wrapper: HTMLDivElement;
  viewport: Viewport;
  frames: Slot;
  onResize: (listener: () => void) => void;
}

export function startScene({
  assets: { gltf, bandTexture },
  renderer,
  camera,
  canvas,
  wrapper,
  viewport,
  frames,
  onResize,
}: BadgeScene): Cancel {
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, Math.PI));
  const environment = renderEnvironment(renderer);
  scene.background = environment.texture;
  scene.environment = environment.texture;
  scene.backgroundBlurriness = 0.75;

  const rope = createRope();
  const { world, fixed, j1, j2, j3, card } = rope;

  const graph = buildGraph(gltf.scene);
  bandTexture.colorSpace = SRGBColorSpace;
  bandTexture.wrapS = RepeatWrapping;
  bandTexture.wrapT = RepeatWrapping;
  const cardMap = graph.base.map;
  if (cardMap === null) {
    throw new TypeError("Badge card material has no texture");
  }
  cardMap.anisotropy = 16;
  graph.metal.roughness = 0.3;

  const cardObject = new Group();
  const badge = new Group();
  badge.scale.setScalar(2.25);
  badge.position.set(0, -1.2, -0.05);
  const cardMaterial = new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    map: cardMap,
    metalness: 0.5,
    roughness: 0.3,
  });
  badge.add(new Mesh(graph.card.geometry, cardMaterial));
  badge.add(new Mesh(graph.clip.geometry, graph.metal));
  badge.add(new Mesh(graph.clamp.geometry, graph.metal));
  cardObject.add(badge);
  scene.add(cardObject);

  const bodyObjects = new Map<RigidBody, Object3D>([[card, cardObject]]);
  for (const [body, object] of bodyObjects) {
    object.position.copy(body.translation());
    object.quaternion.copy(body.rotation());
  }

  const p0 = new Vector3();
  const p1 = new Vector3();
  const p2 = new Vector3();
  const p3 = new Vector3();
  const curve = new CatmullRomCurve3([p0, p1, p2, p3]);
  curve.curveType = "chordal";
  const bandGeometry = new MeshLineGeometry();
  const bandMaterial = new MeshLineMaterial({
    color: new Color("white"),
    lineWidth: 1,
    map: bandTexture,
    repeat: new Vector2(-3, 1),
    resolution: new Vector2(viewport.width, viewport.height),
    useMap: 1,
  });
  bandMaterial.depthTest = false;
  scene.add(new Mesh(bandGeometry, bandMaterial));
  onResize(() => bandMaterial.resolution.set(viewport.width, viewport.height));

  const vec = new Vector3();
  const ang = new Vector3();
  const rot = new Vector3();
  const dir = new Vector3();
  const pointer = new Vector2();
  const raycaster = new Raycaster();
  const lerped = new Map<RigidBody, Vector3>();
  let dragOffset: Vector3 | undefined;
  let hovered = false;
  let captured: number | undefined;

  function syncCursor() {
    const dragCursor = dragOffset ? "grabbing" : "grab";
    document.body.style.cursor = hovered ? dragCursor : "auto";
  }

  function setHovered(value: boolean) {
    if (value !== hovered) {
      hovered = value;
      syncCursor();
    }
  }

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function intersect() {
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(badge, true)[0];
  }

  function onPointerMove(event: PointerEvent) {
    updatePointer(event);
    setHovered(captured !== undefined || Boolean(intersect()));
  }

  function onPointerDown(event: PointerEvent) {
    updatePointer(event);
    const hit = intersect();
    if (!hit) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    captured = event.pointerId;
    dragOffset = new Vector3().copy(hit.point).sub(vec.copy(card.translation()));
    card.setBodyType(RigidBodyType.KinematicPositionBased, true);
    setHovered(true);
    syncCursor();
  }

  function onPointerUp(event: PointerEvent) {
    updatePointer(event);
    if (captured === undefined) {
      return;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    captured = undefined;
    dragOffset = undefined;
    card.setBodyType(RigidBodyType.Dynamic, true);
    syncCursor();
    setHovered(Boolean(intersect()));
  }

  function onPointerLeave() {
    if (captured === undefined) {
      setHovered(false);
    }
  }

  wrapper.addEventListener("pointermove", onPointerMove);
  wrapper.addEventListener("pointerdown", onPointerDown);
  wrapper.addEventListener("pointerup", onPointerUp);
  wrapper.addEventListener("pointercancel", onPointerUp);
  wrapper.addEventListener("pointerleave", onPointerLeave);

  function lerpedPosition(body: RigidBody): Vector3 {
    const existing = lerped.get(body);
    if (existing) {
      return existing;
    }
    const created = new Vector3().copy(body.translation());
    lerped.set(body, created);
    return created;
  }

  function updateBand(delta: number) {
    if (dragOffset) {
      vec.set(pointer.x, pointer.y, 0.5).unproject(camera);
      dir.copy(vec).sub(camera.position).normalize();
      vec.add(dir.multiplyScalar(camera.position.length()));
      for (const body of [card, j1, j2, j3, fixed]) {
        body.wakeUp();
      }
      card.setNextKinematicTranslation({
        x: vec.x - dragOffset.x,
        y: vec.y - dragOffset.y,
        z: vec.z - dragOffset.z,
      });
    }
    for (const body of [j1, j2]) {
      const current = lerpedPosition(body);
      const clampedDistance = Math.max(0.1, Math.min(1, current.distanceTo(body.translation())));
      current.lerp(
        body.translation(),
        Math.min(1, delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))),
      );
    }
    p0.copy(j3.translation());
    p1.copy(lerpedPosition(j2));
    p2.copy(lerpedPosition(j1));
    p3.copy(fixed.translation());
    bandGeometry.setPoints(curve.getPoints(32));
    ang.copy(card.angvel());
    rot.copy(card.rotation());
    card.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
  }

  let last = performance.now();
  function loop(now: number) {
    const delta = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    updateBand(delta);
    rope.step(delta, bodyObjects);
    renderer.render(scene, camera);
    frames.frame(loop);
  }
  frames.frame((now) => {
    last = now;
    loop(now);
  });

  return () => {
    wrapper.removeEventListener("pointermove", onPointerMove);
    wrapper.removeEventListener("pointerdown", onPointerDown);
    wrapper.removeEventListener("pointerup", onPointerUp);
    wrapper.removeEventListener("pointercancel", onPointerUp);
    wrapper.removeEventListener("pointerleave", onPointerLeave);
    if (hovered) {
      document.body.style.cursor = "auto";
    }
    world.free();
    environment.dispose();
    bandGeometry.dispose();
    bandMaterial.dispose();
    cardMaterial.dispose();
  };
}
