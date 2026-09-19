import { init } from "@dimforge/rapier3d-compat";
import {
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Texture,
  TextureLoader,
} from "three";
import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const tagUrl = "https://jz9qfoze3c.ufs.sh/f/VQYLejfhDIPa7r8TzNmK9DAXNUOTJkIobV6L8Sazg4W3E1FM";
const bandUrl = "https://jz9qfoze3c.ufs.sh/f/VQYLejfhDIPa93PzymXQVa75bDMgxYPQKcrj0qhZef8u3Aon";

export interface BadgeAssets {
  gltf: GLTF;
  bandTexture: Texture;
}

export interface BadgeGraph {
  card: Mesh;
  clip: Mesh;
  clamp: Mesh;
  base: MeshStandardMaterial;
  metal: MeshStandardMaterial;
}

let assets: Promise<BadgeAssets> | undefined;

export function loadAssets(): Promise<BadgeAssets> {
  assets ??= Promise.all([
    init(),
    new GLTFLoader().loadAsync(tagUrl),
    new TextureLoader().loadAsync(bandUrl),
  ])
    .then(([, gltf, bandTexture]) => ({ gltf, bandTexture }))
    .catch((error: unknown) => {
      assets = undefined;
      throw error;
    });
  return assets;
}

function pick<T>(
  entries: ReadonlyMap<string, unknown>,
  name: string,
  guard: (value: unknown) => value is T,
): T {
  const value = entries.get(name);
  if (!guard(value)) {
    throw new TypeError(`Badge model is missing "${name}"`);
  }
  return value;
}

const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;
const isStandardMaterial = (value: unknown): value is MeshStandardMaterial =>
  value instanceof MeshStandardMaterial;

export function buildGraph(root: Object3D): BadgeGraph {
  const nodes = new Map<string, Object3D>();
  const materials = new Map<string, Material>();
  root.traverse((object) => {
    if (object.name) {
      nodes.set(object.name, object);
    }
    if (
      object instanceof Mesh &&
      object.material instanceof Material &&
      !materials.has(object.material.name)
    ) {
      materials.set(object.material.name, object.material);
    }
  });
  return {
    card: pick(nodes, "card", isMesh),
    clip: pick(nodes, "clip", isMesh),
    clamp: pick(nodes, "clamp", isMesh),
    base: pick(materials, "base", isStandardMaterial),
    metal: pick(materials, "metal", isStandardMaterial),
  };
}
