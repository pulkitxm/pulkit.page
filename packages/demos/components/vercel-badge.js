import {
  ColliderDesc,
  init,
  JointData,
  RigidBodyDesc,
  RigidBodyType,
  World,
} from "@dimforge/rapier3d-compat";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CatmullRomCurve3,
  Color,
  CubeCamera,
  DoubleSide,
  Group,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { html, refs } from "../runtime/ui.js";

const TAG_URL = "https://jz9qfoze3c.ufs.sh/f/VQYLejfhDIPa7r8TzNmK9DAXNUOTJkIobV6L8Sazg4W3E1FM";
const BAND_URL = "https://jz9qfoze3c.ufs.sh/f/VQYLejfhDIPa93PzymXQVa75bDMgxYPQKcrj0qhZef8u3Aon";
const TIME_STEP = 1 / 60;
const LENGTH_UNIT = 100;
const maxSpeed = 50;
const minSpeed = 10;

const lightformers = [
  { intensity: 2, position: [0, -1, 5], rotation: [0, 0, Math.PI / 3], scale: [100, 0.1, 1] },
  { intensity: 3, position: [-1, -1, 1], rotation: [0, 0, Math.PI / 3], scale: [100, 0.1, 1] },
  { intensity: 3, position: [1, 1, 1], rotation: [0, 0, Math.PI / 3], scale: [100, 0.1, 1] },
  {
    intensity: 10,
    position: [-10, 0, 14],
    rotation: [0, Math.PI / 2, Math.PI / 3],
    scale: [100, 10, 1],
  },
];

let assets;

function loadAssets() {
  assets ??= Promise.all([
    init(),
    new GLTFLoader().loadAsync(TAG_URL),
    new TextureLoader().loadAsync(BAND_URL),
  ]).catch((error) => {
    assets = undefined;
    throw error;
  });
  return assets;
}

function buildGraph(root) {
  const nodes = {};
  const materials = {};
  root.traverse((object) => {
    if (object.name) {
      nodes[object.name] = object;
    }
    if (object.material && !materials[object.material.name]) {
      materials[object.material.name] = object.material;
    }
  });
  return { materials, nodes };
}

function renderEnvironment(renderer) {
  const virtualScene = new Scene();
  virtualScene.background = new Color("black");
  for (const { intensity, position, rotation, scale } of lightformers) {
    const material = new MeshBasicMaterial({ side: DoubleSide, toneMapped: false });
    material.color.set("white").multiplyScalar(intensity);
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    virtualScene.add(mesh);
  }
  const target = new WebGLCubeRenderTarget(256);
  target.texture.type = HalfFloatType;
  const cubeCamera = new CubeCamera(0.1, 1000, target);
  virtualScene.add(cubeCamera);
  const autoClear = renderer.autoClear;
  renderer.autoClear = true;
  cubeCamera.update(renderer, virtualScene);
  renderer.autoClear = autoClear;
  virtualScene.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  return target;
}

export function mount(root) {
  root.innerHTML = html`<div class="h-full w-full">
    <div data-ref="wrapper" style="position: relative; width: 100%; height: 100%; overflow: hidden; pointer-events: auto">
      <div data-ref="inner" style="position: absolute; inset: 0"><canvas data-ref="canvas" style="position: absolute; inset: 0; display: block"></canvas></div>
    </div>
  </div>`;
  const { wrapper, inner, canvas } = refs(root);
  let destroyed = false;
  let frame = 0;
  let cleanup = () => {};

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(Math.max(1, window.devicePixelRatio), 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const camera = new PerspectiveCamera(25, 1, 0.1, 1000);
  camera.position.set(0, 0, 13);
  camera.lookAt(0, 0, 0);
  const size = { height: 0, width: 0 };
  const resizeListeners = [];

  function resize(width, height) {
    if (width === 0 || height === 0) {
      return;
    }
    size.width = width;
    size.height = height;
    renderer.setSize(size.width, size.height);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    for (const listener of resizeListeners) {
      listener();
    }
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const { width, height } = entries.at(-1).contentRect;
    resize(width, height);
  });
  resizeObserver.observe(inner);

  loadAssets()
    .then(([, gltf, loadedTexture]) => {
      if (destroyed) {
        return;
      }
      cleanup = start(gltf, loadedTexture);
    })
    .catch(() => {
      if (destroyed) {
        return;
      }
      resizeObserver.disconnect();
      renderer.dispose();
      root.innerHTML = html`<p class="p-6 text-center text-muted-foreground text-sm" role="alert">
        This demo could not download its 3D assets.
      </p>`;
    });

  function start(gltf, bandTexture) {
    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, Math.PI));
    const environment = renderEnvironment(renderer);
    scene.background = environment.texture;
    scene.environment = environment.texture;
    scene.backgroundBlurriness = 0.75;

    const world = new World({ x: 0, y: -40, z: 0 });
    world.timestep = TIME_STEP;
    world.lengthUnit = LENGTH_UNIT;
    world.integrationParameters.normalizedAllowedLinearError = 0.001 / LENGTH_UNIT;
    world.integrationParameters.normalizedPredictionDistance = 0.002 / LENGTH_UNIT;

    function createBody(type, translation) {
      const desc = new RigidBodyDesc(type)
        .setTranslation(translation[0], translation[1] + 4, translation[2])
        .setLinearDamping(2)
        .setAngularDamping(2)
        .setCanSleep(true);
      return world.createRigidBody(desc);
    }

    const fixed = createBody(RigidBodyType.Fixed, [0, 0, 0]);
    const j1 = createBody(RigidBodyType.Dynamic, [0.5, 0, 0]);
    const j2 = createBody(RigidBodyType.Dynamic, [1, 0, 0]);
    const j3 = createBody(RigidBodyType.Dynamic, [1.5, 0, 0]);
    const card = createBody(RigidBodyType.Dynamic, [2, 0, 0]);
    for (const body of [j1, j2, j3]) {
      world.createCollider(ColliderDesc.ball(0.1), body);
    }
    world.createCollider(ColliderDesc.cuboid(0.8, 1.125, 0.01), card);

    const origin = { x: 0, y: 0, z: 0 };
    world.createImpulseJoint(JointData.rope(1, origin, origin), fixed, j1, true);
    world.createImpulseJoint(JointData.rope(1, origin, origin), j1, j2, true);
    world.createImpulseJoint(JointData.rope(1, origin, origin), j2, j3, true);
    world.createImpulseJoint(JointData.spherical(origin, { x: 0, y: 1.45, z: 0 }), j3, card, true);

    const { nodes, materials } = buildGraph(gltf.scene);
    bandTexture.colorSpace = SRGBColorSpace;
    bandTexture.wrapS = RepeatWrapping;
    bandTexture.wrapT = RepeatWrapping;
    materials.base.map.anisotropy = 16;
    materials.metal.roughness = 0.3;

    const cardObject = new Group();
    const badge = new Group();
    badge.scale.setScalar(2.25);
    badge.position.set(0, -1.2, -0.05);
    const cardMaterial = new MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      map: materials.base.map,
      metalness: 0.5,
      roughness: 0.3,
    });
    badge.add(new Mesh(nodes.card.geometry, cardMaterial));
    badge.add(new Mesh(nodes.clip.geometry, materials.metal));
    badge.add(new Mesh(nodes.clamp.geometry, materials.metal));
    cardObject.add(badge);
    scene.add(cardObject);

    const bodyObjects = new Map([[card, cardObject]]);
    for (const [body, object] of bodyObjects) {
      object.position.copy(body.translation());
      object.quaternion.copy(body.rotation());
    }

    const curve = new CatmullRomCurve3([
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
    ]);
    curve.curveType = "chordal";
    const bandGeometry = new MeshLineGeometry();
    const bandMaterial = new MeshLineMaterial({
      color: new Color("white"),
      depthTest: false,
      lineWidth: 1,
      map: bandTexture,
      repeat: new Vector2(-3, 1),
      resolution: new Vector2(size.width, size.height),
      useMap: 1,
    });
    const band = new Mesh(bandGeometry, bandMaterial);
    scene.add(band);
    const updateResolution = () => bandMaterial.resolution.set(size.width, size.height);
    resizeListeners.push(updateResolution);

    const vec = new Vector3();
    const ang = new Vector3();
    const rot = new Vector3();
    const dir = new Vector3();
    const pointer = new Vector2();
    const raycaster = new Raycaster();
    const lerped = new Map();
    const stepping = { accumulator: 0, previousState: {} };
    const position = new Vector3();
    const rotation = new Quaternion();
    let dragged = false;
    let hovered = false;
    let captured = null;

    function syncCursor() {
      const dragCursor = dragged ? "grabbing" : "grab";
      document.body.style.cursor = hovered ? dragCursor : "auto";
    }

    function setHovered(value) {
      if (value !== hovered) {
        hovered = value;
        syncCursor();
      }
    }

    function updatePointer(event) {
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

    function onPointerMove(event) {
      updatePointer(event);
      setHovered(captured !== null || Boolean(intersect()));
    }

    function onPointerDown(event) {
      updatePointer(event);
      const hit = intersect();
      if (!hit) {
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      captured = event.pointerId;
      dragged = new Vector3().copy(hit.point).sub(vec.copy(card.translation()));
      card.setBodyType(RigidBodyType.KinematicPositionBased, true);
      setHovered(true);
      syncCursor();
    }

    function onPointerUp(event) {
      updatePointer(event);
      if (captured === null) {
        return;
      }
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      captured = null;
      dragged = false;
      card.setBodyType(RigidBodyType.Dynamic, true);
      syncCursor();
      setHovered(Boolean(intersect()));
    }

    function onPointerLeave() {
      if (captured === null) {
        setHovered(false);
      }
    }

    wrapper.addEventListener("pointermove", onPointerMove);
    wrapper.addEventListener("pointerdown", onPointerDown);
    wrapper.addEventListener("pointerup", onPointerUp);
    wrapper.addEventListener("pointercancel", onPointerUp);
    wrapper.addEventListener("pointerleave", onPointerLeave);

    function updateBand(delta) {
      if (dragged) {
        vec.set(pointer.x, pointer.y, 0.5).unproject(camera);
        dir.copy(vec).sub(camera.position).normalize();
        vec.add(dir.multiplyScalar(camera.position.length()));
        for (const body of [card, j1, j2, j3, fixed]) {
          body.wakeUp();
        }
        card.setNextKinematicTranslation({
          x: vec.x - dragged.x,
          y: vec.y - dragged.y,
          z: vec.z - dragged.z,
        });
      }
      for (const body of [j1, j2]) {
        if (!lerped.has(body)) {
          lerped.set(body, new Vector3().copy(body.translation()));
        }
        const current = lerped.get(body);
        const clampedDistance = Math.max(0.1, Math.min(1, current.distanceTo(body.translation())));
        current.lerp(
          body.translation(),
          Math.min(1, delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))),
        );
      }
      curve.points[0].copy(j3.translation());
      curve.points[1].copy(lerped.get(j2));
      curve.points[2].copy(lerped.get(j1));
      curve.points[3].copy(fixed.translation());
      bandGeometry.setPoints(curve.getPoints(32));
      ang.copy(card.angvel());
      rot.copy(card.rotation());
      card.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }

    function stepPhysics(delta) {
      stepping.accumulator += Math.min(Math.max(delta, 0), 0.5);
      while (stepping.accumulator >= TIME_STEP) {
        stepping.previousState = {};
        world.forEachRigidBody((body) => {
          stepping.previousState[body.handle] = {
            position: body.translation(),
            rotation: body.rotation(),
          };
        });
        world.step();
        stepping.accumulator -= TIME_STEP;
      }
      const alpha = stepping.accumulator / TIME_STEP;
      for (const [body, object] of bodyObjects) {
        if (body.isSleeping()) {
          continue;
        }
        const previous = stepping.previousState[body.handle];
        if (previous) {
          object.position.copy(previous.position);
          object.quaternion.copy(previous.rotation);
        }
        object.position.lerp(position.copy(body.translation()), alpha);
        object.quaternion.slerp(rotation.copy(body.rotation()), alpha);
      }
    }

    let last = performance.now();
    function loop(now) {
      const delta = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      updateBand(delta);
      stepPhysics(delta);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame((now) => {
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

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      cleanup();
      renderer.dispose();
    },
  };
}
