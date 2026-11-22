import React, { useEffect, useRef, useState } from 'react';
import {
  CALM_PALETTES,
  clampLookCoordinate,
  SPECIES_CATALOG,
  stepSpring1D,
  type CreatureViewModelInputs,
} from '@aurikat/core-engine';

interface ProceduralCreatureRigProps {
  inputs: CreatureViewModelInputs;
  size?: number;
  onTap?: () => void;
  onPet?: () => void;
  sleeping?: boolean;
  eating?: boolean;
  ariaLabel?: string;
}

interface RigSpringState {
  pupilX: { pos: number; vel: number };
  pupilY: { pos: number; vel: number };
  headX: { pos: number; vel: number };
  headY: { pos: number; vel: number };
  earTilt: { pos: number; vel: number };
  tailWag: { pos: number; vel: number };
  squash: { pos: number; vel: number };
}

/**
 * ProceduralCreatureRig v2.1 — Articulated Layered SVG Companion with 60 fps Damped Spring Follow-Through.
 * - Independent articulated limbs/parts (pupils -> head -> ears/gills -> tail -> paws) with CSS transform-origin
 * - Continuous mouse/finger petting detection over head (triggers purr, closed happy eyes & floating hearts)
 * - Elastic squash-and-stretch impulse on click/poke
 * - Supports sleeping posture (Zzz) and snack eating animation
 * - Keeps 1:1 parity with ICreatureRigAdapter v2 (Rive View Models)
 */
export const ProceduralCreatureRig: React.FC<ProceduralCreatureRigProps> = ({
  inputs,
  size = 210,
  onTap,
  onPet,
  sleeping = false,
  eating = false,
  ariaLabel = 'AuriKat compañero interactivo',
}) => {
  const [blinking, setBlinking] = useState(false);
  const [isPetting, setIsPetting] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; dx: number }[]>([]);
  const petDistanceRef = useRef(0);
  const lastPetPointRef = useRef<{ x: number; y: number } | null>(null);
  const petTimeoutRef = useRef<number | null>(null);

  const springRef = useRef<RigSpringState>({
    pupilX: { pos: 0, vel: 0 },
    pupilY: { pos: 0, vel: 0 },
    headX: { pos: 0, vel: 0 },
    headY: { pos: 0, vel: 0 },
    earTilt: { pos: 0, vel: 0 },
    tailWag: { pos: 0, vel: 0 },
    squash: { pos: 0, vel: 0 },
  });

  const [, setTick] = useState(0);

  // Natural blink timer
  useEffect(() => {
    if (inputs.motionScale <= 0.05 || sleeping) {
      setBlinking(false);
      return;
    }
    const timer = window.setInterval(() => {
      setBlinking(true);
      window.setTimeout(() => setBlinking(false), 145);
    }, 3900);
    return () => window.clearInterval(timer);
  }, [inputs.motionScale, sleeping]);

  // 60 fps Damped Spring Follow-Through Loop (Pupils lead -> Head follows -> Ears/Tail lag organically)
  useEffect(() => {
    const lx = inputs.action === 'look_away' ? -0.85 : clampLookCoordinate(inputs.lookX);
    const ly = clampLookCoordinate(inputs.lookY);

    if (inputs.motionScale <= 0.05) {
      springRef.current = {
        pupilX: { pos: lx, vel: 0 },
        pupilY: { pos: ly, vel: 0 },
        headX: { pos: lx, vel: 0 },
        headY: { pos: ly, vel: 0 },
        earTilt: { pos: lx * 8, vel: 0 },
        tailWag: { pos: 0, vel: 0 },
        squash: { pos: 0, vel: 0 },
      };
      setTick((t) => t + 1);
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.005, (now - lastTime) / 1000));
      lastTime = now;
      const s = springRef.current;

      const wave =
        sleeping
          ? Math.sin(now * 0.002) * 3
          : isPetting || inputs.emotion === 'happy' || inputs.action === 'celebrate_soft'
            ? Math.sin(now * 0.011) * 14
            : Math.sin(now * 0.0038) * 6;

      s.pupilX = stepSpring1D(s.pupilX, lx, 220, 22, dt);
      s.pupilY = stepSpring1D(s.pupilY, ly, 220, 22, dt);
      s.headX = stepSpring1D(s.headX, lx, 115, 16, dt);
      s.headY = stepSpring1D(s.headY, ly, 115, 16, dt);
      s.earTilt = stepSpring1D(s.earTilt, lx * 10 + (isPetting ? -8 : 0), 75, 11, dt);
      s.tailWag = stepSpring1D(s.tailWag, wave, 85, 12, dt);
      s.squash = stepSpring1D(s.squash, 0, 190, 14, dt);

      setTick((t) => (t + 1) % 100000);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [inputs.lookX, inputs.lookY, inputs.action, inputs.emotion, inputs.motionScale, isPetting, sleeping]);

  const triggerBounce = () => {
    if (inputs.motionScale > 0.05) {
      springRef.current.squash = { pos: 0.14, vel: 1.8 };
    }
    onTap?.();
  };

  const handlePointerMoveHead = (ev: React.PointerEvent<SVGGElement>) => {
    if (!onPet && !onTap) return;
    const prev = lastPetPointRef.current;
    lastPetPointRef.current = { x: ev.clientX, y: ev.clientY };
    if (!prev) return;
    const dist = Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y);
    if (dist > 2 && dist < 60) {
      petDistanceRef.current += dist;
      if (petDistanceRef.current > 42) {
        petDistanceRef.current = 0;
        setIsPetting(true);
        const id = Date.now() + Math.random();
        setHearts((h) => [...h.slice(-3), { id, dx: Math.round((Math.random() - 0.5) * 44) }]);
        onPet?.();
        if (petTimeoutRef.current) window.clearTimeout(petTimeoutRef.current);
        petTimeoutRef.current = window.setTimeout(() => setIsPetting(false), 1100);
      }
    }
  };

  const sp = SPECIES_CATALOG[inputs.species];
  const pal = CALM_PALETTES[inputs.paletteId];
  const isPixel = inputs.archetype === 'cozy_pixel';
  const isPastel = inputs.archetype === 'cuento_pastel';

  const s = springRef.current;
  const headShiftX = s.headX.pos * 6.5;
  const headShiftY = s.headY.pos * 4.2 + (sleeping ? 6 : 0);
  const headTiltDeg = s.headX.pos * 4.5;
  const pupilDx = s.pupilX.pos * 8.2;
  const pupilDy = s.pupilY.pos * 5.6;
  const earSpringDeg = s.earTilt.pos;
  const tailDeg = s.tailWag.pos;

  const squashX = 1 + s.squash.pos * 0.75;
  const squashY = 1 - s.squash.pos;

  const strokeW = isPastel ? 4.8 : 3.2;
  const baseEarDroop =
    sleeping || inputs.emotion === 'sad'
      ? 16
      : inputs.emotion === 'angry'
        ? -12
        : inputs.emotion === 'surprised'
          ? -9
          : 0;

  const eyesClosed = blinking || sleeping || isPetting || inputs.emotion === 'calm';

  // COZY PIXEL ARCHETYPE (Crisp retro pixel art WITH high-contrast 22x20 sclera + 10x10 tracking pupils & articulated parts)
  if (isPixel) {
    const pxPupilX = Math.round(pupilDx * 0.85);
    const pxPupilY = Math.round(pupilDy * 0.85);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        shapeRendering="crispEdges"
        role="img"
        aria-label={ariaLabel}
        onClick={triggerBounce}
        style={{
          cursor: onTap || onPet ? 'pointer' : 'default',
          overflow: 'visible',
          transform: `scale(${squashX.toFixed(3)}, ${squashY.toFixed(3)})`,
        }}
        className={inputs.motionScale > 0 && inputs.action === 'idle' && !sleeping ? 'ak-float' : undefined}
      >
        <rect x="40" y="142" width="80" height="8" fill="rgba(43,51,48,0.14)" />

        {/* Articulated Pixel Tail */}
        <g transform={`rotate(${Math.round(tailDeg * 0.7)} 114 126)`}>
          <rect x="114" y="114" width="20" height="10" fill={sp.bodyFill} />
          <rect x="126" y="100" width="12" height="16" fill={sp.earAccent} />
        </g>

        {/* Body */}
        <rect x="46" y="88" width="68" height="52" fill={sp.bodyFill} />
        <rect x="56" y="98" width="48" height="36" fill={sp.bellyFill} />
        <rect x="42" y="92" width="4" height="44" fill={sp.strokeColor} />
        <rect x="114" y="92" width="4" height="44" fill={sp.strokeColor} />
        <rect x="46" y="140" width="68" height="4" fill={sp.strokeColor} />

        {/* Articulated Head */}
        <g
          transform={`translate(${Math.round(headShiftX)}, ${Math.round(headShiftY)})`}
          onPointerMove={handlePointerMoveHead}
        >
          {inputs.species === 'aurikat' && (
            <>
              <rect x="38" y="22" width="22" height="24" fill={sp.bodyFill} />
              <rect x="44" y="28" width="10" height="14" fill={sp.earAccent} />
              <rect x="100" y="22" width="22" height="24" fill={sp.bodyFill} />
              <rect x="106" y="28" width="10" height="14" fill={sp.earAccent} />
            </>
          )}
          {inputs.species === 'nube_ajolote' && (
            <>
              <rect x="18" y="46" width="20" height="8" fill={sp.earAccent} />
              <rect x="20" y="58" width="18" height="8" fill={sp.earAccent} />
              <rect x="22" y="70" width="16" height="8" fill={sp.earAccent} />
              <rect x="122" y="46" width="20" height="8" fill={sp.earAccent} />
              <rect x="122" y="58" width="18" height="8" fill={sp.earAccent} />
              <rect x="122" y="70" width="16" height="8" fill={sp.earAccent} />
            </>
          )}
          {inputs.species === 'zorro_buho' && (
            <>
              <rect x="34" y="18" width="24" height="28" fill={sp.earAccent} />
              <rect x="42" y="26" width="10" height="14" fill={sp.bellyFill} />
              <rect x="102" y="18" width="24" height="28" fill={sp.earAccent} />
              <rect x="108" y="26" width="10" height="14" fill={sp.bellyFill} />
            </>
          )}

          <rect x="38" y="38" width="84" height="58" fill={sp.bodyFill} />
          <rect x="44" y="74" width="12" height="6" fill={sp.earAccent} opacity="0.45" />
          <rect x="104" y="74" width="12" height="6" fill={sp.earAccent} opacity="0.45" />
          <rect x="34" y="44" width="4" height="46" fill={sp.strokeColor} />
          <rect x="122" y="44" width="4" height="46" fill={sp.strokeColor} />
          <rect x="42" y="34" width="76" height="4" fill={sp.strokeColor} />

          {/* Eyes */}
          {eyesClosed ? (
            <>
              <rect x="48" y="64" width="22" height="4" fill={sp.strokeColor} />
              <rect x="90" y="64" width="22" height="4" fill={sp.strokeColor} />
            </>
          ) : (
            <>
              <rect x="48" y="52" width="22" height="20" fill="#F8F7F2" />
              <rect x="90" y="52" width="22" height="20" fill="#F8F7F2" />
              <rect x={54 + pxPupilX} y={57 + pxPupilY} width="10" height="10" fill="#23282D" />
              <rect x={96 + pxPupilX} y={57 + pxPupilY} width="10" height="10" fill="#23282D" />
              <rect x={56 + pxPupilX} y={58 + pxPupilY} width="3" height="3" fill="#F8F7F2" />
              <rect x={98 + pxPupilX} y={58 + pxPupilY} width="3" height="3" fill="#F8F7F2" />
            </>
          )}

          {/* Mouth */}
          {eating || inputs.emotion === 'surprised' ? (
            <rect x="74" y="76" width="12" height="10" fill={sp.earAccent} />
          ) : inputs.emotion === 'happy' || isPetting ? (
            <>
              <rect x="68" y="78" width="24" height="4" fill={sp.strokeColor} />
              <rect x="72" y="82" width="16" height="4" fill={sp.earAccent} />
            </>
          ) : inputs.emotion === 'sad' ? (
            <>
              <rect x="72" y="78" width="16" height="4" fill={sp.strokeColor} />
              <rect x="68" y="82" width="4" height="4" fill={sp.strokeColor} />
              <rect x="88" y="82" width="4" height="4" fill={sp.strokeColor} />
            </>
          ) : (
            <rect x="72" y="80" width="16" height="4" fill={sp.strokeColor} />
          )}

          {inputs.accessory === 'leaf_hat' && <rect x="64" y="22" width="32" height="12" fill="#5E8B7E" />}
          {inputs.accessory === 'flower_crown' && (
            <>
              <rect x="56" y="28" width="12" height="8" fill="#D9A7AE" />
              <rect x="74" y="26" width="12" height="10" fill={pal.auGold} />
              <rect x="92" y="28" width="12" height="8" fill="#9BB8AE" />
            </>
          )}
          {inputs.accessory === 'round_glasses' && (
            <>
              <rect x="44" y="50" width="28" height="24" fill="none" stroke={pal.auGold} strokeWidth="3" />
              <rect x="88" y="50" width="28" height="24" fill="none" stroke={pal.auGold} strokeWidth="3" />
            </>
          )}
        </g>

        {/* Au Infinity Collar */}
        <rect x="52" y="96" width="56" height="6" fill={pal.accent} />
        <rect x="72" y="102" width="16" height="8" fill={pal.auGold} />
        <rect x="75" y="104" width="4" height="4" fill={sp.bellyFill} />
        <rect x="81" y="104" width="4" height="4" fill={sp.bellyFill} />
      </svg>
    );
  }

  // ARTICULATED LAYERED VECTOR RIG (Cuento Pastel & Criatura Compañera)
  const headRadiusX = isPastel ? 53 : 49;
  const headRadiusY = isPastel ? 46 : 43;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={ariaLabel}
      onClick={triggerBounce}
      style={{
        cursor: onTap || onPet ? 'pointer' : 'default',
        overflow: 'visible',
        transform: `scale(${squashX.toFixed(3)}, ${squashY.toFixed(3)})`,
      }}
      className={inputs.motionScale > 0 && inputs.action === 'idle' && !sleeping ? 'ak-float' : undefined}
    >
      <defs>
        <radialGradient id={`bellyGrad-${inputs.species}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FCFBF7" />
          <stop offset="100%" stopColor={sp.bellyFill} />
        </radialGradient>
      </defs>

      {/* Soft Ground Shadow */}
      <ellipse cx="100" cy="182" rx="54" ry="11" fill="rgba(43,51,48,0.11)" />

      {/* Articulated Tail with Spring Wag around hip pivot (134, 152) */}
      <g transform={`rotate(${tailDeg.toFixed(1)} 134 152)`}>
        <path
          d={
            inputs.emotion === 'sad' || sleeping
              ? 'M134 154 C156 160, 166 172, 152 174'
              : inputs.species === 'nube_ajolote'
                ? 'M134 150 Q176 136 168 156 Q156 172 134 162 Z'
                : 'M134 152 C166 144, 178 114, 160 102'
          }
          fill={inputs.species === 'nube_ajolote' ? sp.earAccent : 'none'}
          stroke={sp.bodyFill}
          strokeWidth={inputs.species === 'nube_ajolote' ? '4' : '15'}
          strokeLinecap="round"
        />
        <path
          d={
            inputs.emotion === 'sad' || sleeping
              ? 'M134 154 C156 160, 166 172, 152 174'
              : 'M134 152 C166 144, 178 114, 160 102'
          }
          fill="none"
          stroke={sp.strokeColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity="0.72"
        />
      </g>

      {/* Cloud Backpack Accessory */}
      {inputs.accessory === 'cloud_backpack' && (
        <g>
          <circle cx="52" cy="134" r="19" fill="#DCE8F0" stroke={sp.strokeColor} strokeWidth="3" />
          <circle cx="148" cy="134" r="19" fill="#DCE8F0" stroke={sp.strokeColor} strokeWidth="3" />
        </g>
      )}

      {/* Torso / Body */}
      <ellipse
        cx="100"
        cy="144"
        rx="45"
        ry="36"
        fill={sp.bodyFill}
        stroke={sp.strokeColor}
        strokeWidth={strokeW}
      />
      <ellipse cx="100" cy="148" rx="29" ry="24" fill={`url(#bellyGrad-${inputs.species})`} />

      {/* Back Feet Pads */}
      <ellipse cx="70" cy="174" rx="13" ry="7.5" fill={sp.bellyFill} stroke={sp.strokeColor} strokeWidth="2.5" />
      <ellipse cx="130" cy="174" rx="13" ry="7.5" fill={sp.bellyFill} stroke={sp.strokeColor} strokeWidth="2.5" />

      {/* Articulated Front Paws */}
      {inputs.action === 'point_left' ? (
        <g transform="translate(42, 128) rotate(-22)">
          <ellipse cx="0" cy="0" rx="19" ry="10.5" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
          <circle cx="-11" cy="0" r="3.5" fill={sp.earAccent} />
        </g>
      ) : (
        <ellipse cx="68" cy="154" rx="12" ry="9.5" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      )}

      {inputs.action === 'point_right' ? (
        <g transform="translate(158, 128) rotate(22)">
          <ellipse cx="0" cy="0" rx="19" ry="10.5" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
          <circle cx="11" cy="0" r="3.5" fill={sp.earAccent} />
        </g>
      ) : inputs.action === 'wave' || isPetting ? (
        <g transform={`translate(146, 122) rotate(${(-36 + tailDeg * 0.8).toFixed(1)})`}>
          <ellipse cx="0" cy="0" rx="15" ry="10" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
          <circle cx="6" cy="-2" r="3" fill={sp.earAccent} />
        </g>
      ) : (
        <ellipse cx="132" cy="154" rx="12" ry="9.5" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      )}

      {inputs.action === 'point_center' && (
        <ellipse cx="100" cy="160" rx="14" ry="11" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      )}

      {/* Star Scarf Accessory */}
      {inputs.accessory === 'star_scarf' && (
        <g>
          <path d="M62 114 Q100 128 138 114 Q134 130 100 132 Q66 130 62 114 Z" fill={pal.accent} stroke={sp.strokeColor} strokeWidth="2.5" />
          <path d="M114 126 L124 152 L108 148 Z" fill={pal.accent} stroke={sp.strokeColor} strokeWidth="2.5" />
        </g>
      )}

      {/* Collar + Desaturated Honey-Gold Au Infinity Charm */}
      <path d="M66 113 Q100 124 134 113" fill="none" stroke={pal.accent} strokeWidth="6" strokeLinecap="round" />
      <g transform="translate(100, 124)">
        <circle cx="0" cy="0" r="10.5" fill={pal.surface} stroke={pal.auGold} strokeWidth="2.2" />
        <path
          d="M-5.5 0 C-5.5 -3.6, -1.5 -3.6, 0 0 C1.5 3.6, 5.5 3.6, 5.5 0 C5.5 -3.6, 1.5 -3.6, 0 0 C-1.5 3.6, -5.5 3.6, -5.5 0 Z"
          fill="none"
          stroke={pal.auGold}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>

      {/* Articulated Head Group (spring translation + subtle head tilt) */}
      <g
        transform={`translate(${headShiftX.toFixed(2)}, ${headShiftY.toFixed(2)}) rotate(${headTiltDeg.toFixed(2)} 100 84)`}
        onPointerMove={handlePointerMoveHead}
      >
        {/* Articulated Species Ears / Gills with independent spring lag */}
        {inputs.species === 'aurikat' && (
          <>
            <g transform={`rotate(${(-baseEarDroop + earSpringDeg).toFixed(1)} 66 56)`}>
              <path d="M55 66 L48 21 L85 48 Z" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M60 58 L56 33 L77 50 Z" fill={sp.earAccent} />
            </g>
            <g transform={`rotate(${(baseEarDroop + earSpringDeg).toFixed(1)} 134 56)`}>
              <path d="M145 66 L152 21 L115 48 Z" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M140 58 L144 33 L123 50 Z" fill={sp.earAccent} />
            </g>
          </>
        )}

        {inputs.species === 'nube_ajolote' && (
          <>
            <g transform={`rotate(${(-baseEarDroop * 0.5 + earSpringDeg * 1.1).toFixed(1)} 52 78)`}>
              <ellipse cx="39" cy="63" rx="19" ry="8.5" transform="rotate(-24 39 63)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="35" cy="80" rx="20" ry="8.5" transform="rotate(-5 35 80)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="41" cy="96" rx="17" ry="8.5" transform="rotate(18 41 96)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
            </g>
            <g transform={`rotate(${(baseEarDroop * 0.5 + earSpringDeg * 1.1).toFixed(1)} 148 78)`}>
              <ellipse cx="161" cy="63" rx="19" ry="8.5" transform="rotate(24 161 63)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="165" cy="80" rx="20" ry="8.5" transform="rotate(5 165 80)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="159" cy="96" rx="17" ry="8.5" transform="rotate(-18 159 96)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
            </g>
          </>
        )}

        {inputs.species === 'zorro_buho' && (
          <>
            <g transform={`rotate(${(-baseEarDroop * 0.8 + earSpringDeg).toFixed(1)} 64 52)`}>
              <path d="M51 66 Q42 22 72 20 L85 48 Z" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M58 58 Q56 35 70 33 L77 50 Z" fill={sp.bellyFill} />
            </g>
            <g transform={`rotate(${(baseEarDroop * 0.8 + earSpringDeg).toFixed(1)} 136 52)`}>
              <path d="M149 66 Q158 22 128 20 L115 48 Z" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M142 58 Q144 35 130 33 L123 50 Z" fill={sp.bellyFill} />
            </g>
          </>
        )}

        {/* Head Silhouette */}
        <ellipse
          cx="100"
          cy="78"
          rx={headRadiusX}
          ry={headRadiusY}
          fill={sp.bodyFill}
          stroke={sp.strokeColor}
          strokeWidth={strokeW}
        />

        {/* Forehead / Facial Pattern */}
        {inputs.species === 'aurikat' && (
          <g fill={sp.earAccent} opacity="0.45">
            <rect x="92" y="38" width="4" height="11" rx="2" />
            <rect x="98" y="36" width="4" height="13" rx="2" />
            <rect x="104" y="38" width="4" height="11" rx="2" />
          </g>
        )}
        {inputs.species === 'zorro_buho' && (
          <path d="M62 76 Q100 54 138 76 Q132 108 100 112 Q68 108 62 76 Z" fill={sp.bellyFill} opacity="0.88" />
        )}

        {/* Warm Blush Cheeks (intensify on petting / happy) */}
        <ellipse cx="63" cy="93" rx="10" ry="6" fill={sp.earAccent} opacity={isPetting || inputs.emotion === 'happy' ? 0.65 : 0.38} />
        <ellipse cx="137" cy="93" rx="10" ry="6" fill={sp.earAccent} opacity={isPetting || inputs.emotion === 'happy' ? 0.65 : 0.38} />

        {/* Cat Whiskers */}
        {inputs.species === 'aurikat' && (
          <g stroke={sp.strokeColor} strokeWidth="2.1" strokeLinecap="round" opacity="0.58">
            <line x1="41" y1="84" x2="58" y2="87" />
            <line x1="39" y1="93" x2="57" y2="93" />
            <line x1="159" y1="84" x2="142" y2="87" />
            <line x1="161" y1="93" x2="143" y2="93" />
          </g>
        )}

        {/* EYES — High Sclera/Pupil Contrast for Gaze-Cueing (IC-4) */}
        {eyesClosed ? (
          <g stroke={sp.strokeColor} strokeWidth="3.6" strokeLinecap="round" fill="none">
            {isPetting || inputs.emotion === 'calm' ? (
              <>
                <path d="M66 79 Q78 69 90 79" />
                <path d="M110 79 Q122 69 134 79" />
              </>
            ) : (
              <>
                <path d="M66 77 Q78 83 90 77" />
                <path d="M110 77 Q122 83 134 77" />
              </>
            )}
          </g>
        ) : (
          <g>
            <ellipse
              cx="78"
              cy="76"
              rx={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 15 : 13.8}
              ry={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 16 : 13.8}
              fill="#FAF9F5"
              stroke={sp.strokeColor}
              strokeWidth="2.8"
            />
            <ellipse
              cx="122"
              cy="76"
              rx={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 15 : 13.8}
              ry={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 16 : 13.8}
              fill="#FAF9F5"
              stroke={sp.strokeColor}
              strokeWidth="2.8"
            />
            <circle
              cx={78 + pupilDx}
              cy={76 + pupilDy}
              r={inputs.emotion === 'scared' ? 5.2 : 7}
              fill="#22272B"
            />
            <circle
              cx={122 + pupilDx}
              cy={76 + pupilDy}
              r={inputs.emotion === 'scared' ? 5.2 : 7}
              fill="#22272B"
            />
            <circle cx={75.2 + pupilDx} cy={73.2 + pupilDy} r="2.4" fill="#FAF9F5" />
            <circle cx={119.2 + pupilDx} cy={73.2 + pupilDy} r="2.4" fill="#FAF9F5" />
            {inputs.emotion === 'sad' && (
              <>
                <circle cx="86" cy="87" r="3" fill="#8FB5CC" />
                <circle cx="114" cy="87" r="3" fill="#8FB5CC" />
              </>
            )}
          </g>
        )}

        {/* Eyebrows */}
        {inputs.emotion === 'angry' && (
          <g stroke={sp.strokeColor} strokeWidth="3.6" strokeLinecap="round">
            <line x1="65" y1="57" x2="88" y2="64" />
            <line x1="135" y1="57" x2="112" y2="64" />
          </g>
        )}
        {inputs.emotion === 'sad' && (
          <g stroke={sp.strokeColor} strokeWidth="3.2" strokeLinecap="round">
            <line x1="65" y1="63" x2="86" y2="57" />
            <line x1="135" y1="63" x2="114" y2="57" />
          </g>
        )}
        {inputs.emotion === 'surprised' && (
          <g stroke={sp.strokeColor} strokeWidth="3.2" strokeLinecap="round" fill="none">
            <path d="M66 55 Q78 46 89 55" />
            <path d="M111 55 Q122 46 134 55" />
          </g>
        )}
        {inputs.emotion === 'scared' && (
          <g stroke={sp.strokeColor} strokeWidth="3.2" strokeLinecap="round" fill="none">
            <path d="M67 59 Q78 51 89 55" />
            <path d="M111 55 Q122 51 133 59" />
          </g>
        )}

        {/* Nose / Beak */}
        {inputs.species === 'zorro_buho' ? (
          <polygon points="95,88 105,88 100,95" fill={pal.auGold} stroke={sp.strokeColor} strokeWidth="1.8" />
        ) : (
          <ellipse cx="100" cy="89" rx="4.6" ry="3.3" fill={sp.strokeColor} />
        )}

        {/* Mouth */}
        {eating ? (
          <ellipse cx="100" cy="100" rx="9" ry="7" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
        ) : inputs.emotion === 'happy' || isPetting ? (
          <path d="M84 95 Q100 112 116 95 Z" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" strokeLinejoin="round" />
        ) : inputs.emotion === 'calm' || sleeping ? (
          <path d="M88 97 Q100 105 112 97" fill="none" stroke={sp.strokeColor} strokeWidth="3" strokeLinecap="round" />
        ) : inputs.emotion === 'neutral' ? (
          <path d="M90 98 Q100 102 110 98" fill="none" stroke={sp.strokeColor} strokeWidth="2.8" strokeLinecap="round" />
        ) : inputs.emotion === 'sad' ? (
          <path d="M88 104 Q100 95 112 104" fill="none" stroke={sp.strokeColor} strokeWidth="3" strokeLinecap="round" />
        ) : inputs.emotion === 'angry' ? (
          <path d="M87 102 Q100 97 113 102" fill="none" stroke={sp.strokeColor} strokeWidth="3.2" strokeLinecap="round" />
        ) : inputs.emotion === 'scared' ? (
          <path d="M86 101 Q93 96 100 101 Q107 106 114 101" fill="none" stroke={sp.strokeColor} strokeWidth="3" strokeLinecap="round" />
        ) : (
          <ellipse cx="100" cy="101" rx="7" ry="8.5" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
        )}

        {/* Accessories */}
        {inputs.accessory === 'leaf_hat' && (
          <g transform="translate(100, 32)">
            <path d="M-24 6 Q0 -18 24 6 Q0 14 -24 6 Z" fill="#5E8B7E" stroke={sp.strokeColor} strokeWidth="2.8" />
            <path d="M0 -8 Q8 -18 14 -12" fill="none" stroke={sp.strokeColor} strokeWidth="2.8" strokeLinecap="round" />
          </g>
        )}
        {inputs.accessory === 'flower_crown' && (
          <g transform="translate(100, 36)">
            <circle cx="-20" cy="2" r="7" fill="#D9A7AE" stroke={sp.strokeColor} strokeWidth="2" />
            <circle cx="0" cy="-2" r="8" fill={pal.auGold} stroke={sp.strokeColor} strokeWidth="2" />
            <circle cx="20" cy="2" r="7" fill="#9BB8AE" stroke={sp.strokeColor} strokeWidth="2" />
          </g>
        )}
        {inputs.accessory === 'round_glasses' && (
          <g fill="none" stroke={pal.auGold} strokeWidth="3.2">
            <circle cx="78" cy="76" r="17" />
            <circle cx="122" cy="76" r="17" />
            <line x1="95" y1="76" x2="105" y2="76" />
          </g>
        )}
      </g>

      {/* Sleeping Zzz Bubble */}
      {sleeping && (
        <g fill={pal.accent} fontWeight="800" fontSize="16">
          <text x="148" y="46">z</text>
          <text x="160" y="34" fontSize="20">Z</text>
          <text x="174" y="20" fontSize="24">Z</text>
        </g>
      )}

      {/* Petting Floating Hearts */}
      {hearts.map((h, i) => (
        <text
          key={h.id}
          x={100 + h.dx}
          y={28 - i * 8}
          textAnchor="middle"
          fontSize="18"
          fill="#C77A6B"
        >
          ♥
        </text>
      ))}
    </svg>
  );
};
