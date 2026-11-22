/**
 * SpringPhysics — 60 fps Damped Spring, Pendulum & Rolling Toy Solver
 * Used for articulated companion follow-through (pupils -> head -> ears -> tail)
 * and Hearthstone-style interactive habitat props.
 */

export interface Spring1DState {
  pos: number;
  vel: number;
}

export interface PendulumState {
  angleDeg: number;
  omegaDeg: number;
}

export interface RollingToyState {
  x: number; // Normalized [-1, 1] across habitat floor
  vx: number;
  rotationDeg: number;
}

/**
 * Semi-implicit Euler damped spring step (stable for 60 fps dt <= 0.05s).
 */
export function stepSpring1D(
  state: Spring1DState,
  target: number,
  stiffness = 140,
  damping = 18,
  dtSec = 1 / 60,
): Spring1DState {
  const dt = Math.min(0.05, Math.max(0.001, dtSec));
  const force = -stiffness * (state.pos - target) - damping * state.vel;
  const nextVel = state.vel + force * dt;
  const nextPos = state.pos + nextVel * dt;
  if (Math.abs(nextPos - target) < 0.0005 && Math.abs(nextVel) < 0.0005) {
    return { pos: target, vel: 0 };
  }
  return { pos: nextPos, vel: nextVel };
}

/**
 * Damped pendulum solver for hanging lanterns,lamps and wind chimes.
 */
export function stepPendulum(
  state: PendulumState,
  dtSec = 1 / 60,
  restoringK = 38,
  damping = 2.8,
): PendulumState {
  const dt = Math.min(0.05, Math.max(0.001, dtSec));
  const accel = -restoringK * state.angleDeg - damping * state.omegaDeg;
  const nextOmega = state.omegaDeg + accel * dt;
  const nextAngle = state.angleDeg + nextOmega * dt;
  if (Math.abs(nextAngle) < 0.05 && Math.abs(nextOmega) < 0.05) {
    return { angleDeg: 0, omegaDeg: 0 };
  }
  return { angleDeg: nextAngle, omegaDeg: nextOmega };
}

/**
 * 1D rolling physics with soft wall bounce and floor friction (yarn ball, pearl, pinecone).
 */
export function stepRollingToy(
  state: RollingToyState,
  dtSec = 1 / 60,
  friction = 1.9,
): RollingToyState {
  const dt = Math.min(0.05, Math.max(0.001, dtSec));
  let vx = state.vx * Math.exp(-friction * dt);
  let x = state.x + vx * dt;
  if (x > 0.85) {
    x = 0.85;
    vx = -Math.abs(vx) * 0.72;
  } else if (x < -0.85) {
    x = -0.85;
    vx = Math.abs(vx) * 0.72;
  }
  if (Math.abs(vx) < 0.008) vx = 0;
  const rotationDeg = (state.rotationDeg + vx * dt * 260) % 360;
  return { x, vx, rotationDeg };
}
