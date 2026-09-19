import {
  ColliderDesc,
  JointData,
  type RigidBody,
  RigidBodyDesc,
  RigidBodyType,
  type Rotation,
  type Vector,
  World,
} from "@dimforge/rapier3d-compat";
import { type Object3D, Quaternion, Vector3 } from "three";

const timeStep = 1 / 60;
const lengthUnit = 100;

interface BodyState {
  position: Vector;
  rotation: Rotation;
}

export interface Rope {
  world: World;
  fixed: RigidBody;
  j1: RigidBody;
  j2: RigidBody;
  j3: RigidBody;
  card: RigidBody;
  step(delta: number, bodyObjects: ReadonlyMap<RigidBody, Object3D>): void;
}

export function createRope(): Rope {
  const world = new World({ x: 0, y: -40, z: 0 });
  world.timestep = timeStep;
  world.lengthUnit = lengthUnit;
  world.integrationParameters.normalizedAllowedLinearError = 0.001 / lengthUnit;
  world.integrationParameters.normalizedPredictionDistance = 0.002 / lengthUnit;

  function createBody(type: RigidBodyType, x: number): RigidBody {
    const desc = new RigidBodyDesc(type)
      .setTranslation(x, 4, 0)
      .setLinearDamping(2)
      .setAngularDamping(2)
      .setCanSleep(true);
    return world.createRigidBody(desc);
  }

  const fixed = createBody(RigidBodyType.Fixed, 0);
  const j1 = createBody(RigidBodyType.Dynamic, 0.5);
  const j2 = createBody(RigidBodyType.Dynamic, 1);
  const j3 = createBody(RigidBodyType.Dynamic, 1.5);
  const card = createBody(RigidBodyType.Dynamic, 2);
  for (const body of [j1, j2, j3]) {
    world.createCollider(ColliderDesc.ball(0.1), body);
  }
  world.createCollider(ColliderDesc.cuboid(0.8, 1.125, 0.01), card);

  const origin = { x: 0, y: 0, z: 0 };
  world.createImpulseJoint(JointData.rope(1, origin, origin), fixed, j1, true);
  world.createImpulseJoint(JointData.rope(1, origin, origin), j1, j2, true);
  world.createImpulseJoint(JointData.rope(1, origin, origin), j2, j3, true);
  world.createImpulseJoint(JointData.spherical(origin, { x: 0, y: 1.45, z: 0 }), j3, card, true);

  let accumulator = 0;
  let previousState = new Map<number, BodyState>();
  const position = new Vector3();
  const rotation = new Quaternion();

  function step(delta: number, bodyObjects: ReadonlyMap<RigidBody, Object3D>) {
    accumulator += Math.min(Math.max(delta, 0), 0.5);
    while (accumulator >= timeStep) {
      previousState = new Map();
      world.forEachRigidBody((body) => {
        previousState.set(body.handle, { position: body.translation(), rotation: body.rotation() });
      });
      world.step();
      accumulator -= timeStep;
    }
    const alpha = accumulator / timeStep;
    for (const [body, object] of bodyObjects) {
      if (body.isSleeping()) {
        continue;
      }
      const previous = previousState.get(body.handle);
      if (previous) {
        object.position.copy(previous.position);
        object.quaternion.copy(previous.rotation);
      }
      object.position.lerp(position.copy(body.translation()), alpha);
      object.quaternion.slerp(rotation.copy(body.rotation()), alpha);
    }
  }

  return { world, fixed, j1, j2, j3, card, step };
}
