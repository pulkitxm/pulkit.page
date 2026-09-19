import {
  Color,
  CubeCamera,
  DoubleSide,
  HalfFloatType,
  Material,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
} from "three";

type Triple = readonly [number, number, number];

interface Lightformer {
  intensity: number;
  position: Triple;
  rotation: Triple;
  scale: Triple;
}

const lightformers: readonly Lightformer[] = [
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

export function renderEnvironment(renderer: WebGLRenderer): WebGLCubeRenderTarget {
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
    if (object instanceof Mesh) {
      object.geometry.dispose();
      if (object.material instanceof Material) {
        object.material.dispose();
      }
    }
  });
  return target;
}
