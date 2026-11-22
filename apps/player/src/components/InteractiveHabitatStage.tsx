import React, { useEffect, useRef, useState } from 'react';
import {
  createDefaultPetNeeds,
  gentleSoundEngine,
  stepPendulum,
  stepRollingToy,
  stepSpring1D,
  type CozyPetNeeds,
  type CreatureViewModelInputs,
  type EmotionId,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from './ProceduralCreatureRig.js';

interface InteractiveHabitatStageProps {
  creatureInputs: CreatureViewModelInputs;
  petNeeds: CozyPetNeeds | undefined;
  sharedDaysCount: number;
  stickersCount: number;
  onUpdateNeeds: (next: CozyPetNeeds) => void;
}

interface HabitatParticle {
  id: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  kind: 'steam' | 'bubble' | 'petal' | 'firefly' | 'heart' | 'snack';
  color: string;
  life: number;
}

/**
 * InteractiveHabitatStage — 3 Species-Specific Homes + 6 Hearthstone-Style Cozy Props + Non-Punitive Care Loop
 * 1) aurikat (Cat) -> Casa Cozy de Gato (Lámpara péndulo, Tetera con vapor, Ovillo rodante, Maceta 3 etapas, Campanas de viento, Luciérnagas)
 * 2) nube_ajolote (Axolotl) -> Pecera Encantada (Boyita péndulo, Volcán burbujeador, Perla rodante, Coral mágico 3 etapas, Campanas de caracola, Castillo de arena con puente)
 * 3) zorro_buho (Fox-Owl) -> Casa del Árbol del Bosque (Farol bellota péndulo, Tetera corteza, Piña rodante, Honguito luminoso 3 etapas, Campanas de madera, Luciérnagas del bosque)
 */
export const InteractiveHabitatStage: React.FC<InteractiveHabitatStageProps> = ({
  creatureInputs,
  petNeeds,
  sharedDaysCount,
  stickersCount,
  onUpdateNeeds,
}) => {
  const needs = petNeeds ?? createDefaultPetNeeds();

  const [lookTarget, setLookTarget] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [overrideEmotion, setOverrideEmotion] = useState<EmotionId | null>(null);
  const [eating, setEating] = useState(false);
  const [lampLit, setLampLit] = useState(true);
  const [plantStage, setPlantStage] = useState<0 | 1 | 2>(1);
  const [castleOpen, setCastleOpen] = useState(false);

  const stageRef = useRef<SVGSVGElement | null>(null);
  const pendulumRef = useRef({ angleDeg: 8, omegaDeg: 0 });
  const chimeAnglesRef = useRef([
    { angleDeg: -5, omegaDeg: 0 },
    { angleDeg: 4, omegaDeg: 0 },
    { angleDeg: -3, omegaDeg: 0 },
  ]);
  const rollingToyRef = useRef({ x: 0.36, vx: 0, rotationDeg: 0 });
  const petWalkRef = useRef({ pos: 0, vel: 0, target: 0 });
  const particlesRef = useRef<HabitatParticle[]>([]);
  const [, setFrame] = useState(0);

  // Autonomous calm wandering target inside the enclosure (every 4.5s if awake and motionScale > 0)
  useEffect(() => {
    if (creatureInputs.motionScale <= 0.05 || needs.sleeping) {
      petWalkRef.current.target = 0;
      return;
    }
    const timer = window.setInterval(() => {
      const nextTarget = Number(((Math.random() - 0.5) * 0.52).toFixed(2));
      petWalkRef.current.target = nextTarget;
      setLookTarget((prev) => ({ x: nextTarget > prev.x ? 0.45 : -0.45, y: 0.1 }));
    }, 4600);
    return () => window.clearInterval(timer);
  }, [creatureInputs.motionScale, needs.sleeping]);

  // 60 fps Physics & Particles Loop (Pendulum, Wind Chimes, Rolling Toy, Pet Wander, Rising Particles)
  useEffect(() => {
    if (creatureInputs.motionScale <= 0.05) {
      pendulumRef.current = { angleDeg: 0, omegaDeg: 0 };
      rollingToyRef.current.vx = 0;
      particlesRef.current = [];
      setFrame((f) => f + 1);
      return;
    }

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.005, (now - last) / 1000));
      last = now;

      pendulumRef.current = stepPendulum(pendulumRef.current, dt, 36, 2.2);
      chimeAnglesRef.current = chimeAnglesRef.current.map((c, i) =>
        stepPendulum(c, dt, 48 + i * 8, 2.6),
      );
      rollingToyRef.current = stepRollingToy(rollingToyRef.current, dt, 1.8);

      const walk = stepSpring1D(
        { pos: petWalkRef.current.pos, vel: petWalkRef.current.vel },
        needs.sleeping ? 0 : petWalkRef.current.target,
        24,
        9,
        dt,
      );
      petWalkRef.current.pos = walk.pos;
      petWalkRef.current.vel = walk.vel;

      // If rolling toy is moving fast, companion tracks it with its eyes!
      if (Math.abs(rollingToyRef.current.vx) > 0.15 && !needs.sleeping) {
        setLookTarget({
          x: Math.max(-1, Math.min(1, (rollingToyRef.current.x - petWalkRef.current.pos) * 1.4)),
          y: 0.65,
        });
      }

      if (particlesRef.current.length > 0) {
        particlesRef.current = particlesRef.current
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt * 60,
            y: p.y + p.vy * dt * 60,
            life: p.life - dt * 0.75,
          }))
          .filter((p) => p.life > 0);
      }

      setFrame((f) => (f + 1) % 100000);
      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [creatureInputs.motionScale, needs.sleeping]);

  const spawnParticles = (
    x: number,
    y: number,
    kind: HabitatParticle['kind'],
    color: string,
    count = 5,
  ) => {
    const list: HabitatParticle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + Math.random() + i,
      x: x + (Math.random() - 0.5) * 26,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 0.8,
      vy: kind === 'petal' || kind === 'snack' ? 0.7 + Math.random() * 0.6 : -0.9 - Math.random() * 0.8,
      kind,
      color,
      life: 1,
    }));
    particlesRef.current = [...particlesRef.current.slice(-24), ...list];
  };

  const focusCompanionOn = (svgX: number, svgY: number, pulseEmotion: EmotionId = 'surprised') => {
    if (needs.sleeping) return;
    const petCenterX = 320 + petWalkRef.current.pos * 130;
    const petCenterY = 205;
    const lx = Math.max(-1, Math.min(1, (svgX - petCenterX) / 180));
    const ly = Math.max(-1, Math.min(1, (svgY - petCenterY) / 120));
    setLookTarget({ x: lx, y: ly });
    setOverrideEmotion(pulseEmotion);
    window.setTimeout(() => setOverrideEmotion(null), 1100);
  };

  const handleStagePointerMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!stageRef.current || needs.sleeping) return;
    const rect = stageRef.current.getBoundingClientRect();
    const svgX = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 640;
    const svgY = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 340;
    const petCenterX = 320 + petWalkRef.current.pos * 130;
    const petCenterY = 205;
    setLookTarget({
      x: Math.max(-1, Math.min(1, (svgX - petCenterX) / 210)),
      y: Math.max(-1, Math.min(1, (svgY - petCenterY) / 140)),
    });
  };

  // --- 6 Hearthstone-Style Prop Handlers ---
  const handleTapPendulumLamp = (e: React.MouseEvent) => {
    e.stopPropagation();
    gentleSoundEngine.unlock();
    gentleSoundEngine.playCue('chime_pentatonic_2');
    pendulumRef.current.omegaDeg +=pendulumRef.current.angleDeg >= 0 ? -120 : 120;
    setLampLit((l) => !l);
    focusCompanionOn(110, 62, 'surprised');
  };

  const handleTapChime = (idx: 0 | 1 | 2, e?: React.MouseEvent) => {
    e?.stopPropagation();
    gentleSoundEngine.unlock();
    const cues = ['chime_pentatonic_1', 'chime_pentatonic_2', 'chime_pentatonic_3'] as const;
    gentleSoundEngine.playCue(cues[idx]);
    chimeAnglesRef.current[idx].omegaDeg = (idx % 2 === 0 ? 1 : -1) * 145;
    focusCompanionOn(510 + idx * 24, 58, 'happy');
  };

  const handleTapStreamerOrVolcano = (e: React.MouseEvent) => {
    e.stopPropagation();
    gentleSoundEngine.unlock();
    const isAquatic = creatureInputs.species === 'nube_ajolote';
    gentleSoundEngine.playCue(isAquatic ? 'water_bubble' : 'teapot_puff');
    spawnParticles(92, 224, isAquatic ? 'bubble' : 'steam', isAquatic ? '#9AC8DF' : '#E7E4DC', 7);
    focusCompanionOn(92, 224, 'surprised');
  };

  const handleTapBloomProp = (e: React.MouseEvent) => {
    e.stopPropagation();
    gentleSoundEngine.unlock();
    gentleSoundEngine.playCue('bloom_sparkle');
    setPlantStage((s) => ((s + 1) % 3) as 0 | 1 | 2);
    spawnParticles(545, 220, 'petal', '#D9A7AE', 8);
    focusCompanionOn(545, 220, 'happy');
  };

  const handleTapCastleOrFireflyJar = (e: React.MouseEvent) => {
    e.stopPropagation();
    gentleSoundEngine.unlock();
    if (creatureInputs.species === 'nube_ajolote') {
      gentleSoundEngine.playCue('water_bubble');
      setCastleOpen((o) => !o);
      spawnParticles(168, 212, 'bubble', '#C59E49', 8);
      focusCompanionOn(168, 212, 'happy');
    } else {
      gentleSoundEngine.playCue('bloom_sparkle');
      spawnParticles(480, 210, 'firefly', '#C59E49', 7);
      focusCompanionOn(480, 210, 'surprised');
    }
  };

  const handleKickRollingToy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    gentleSoundEngine.unlock();
    gentleSoundEngine.playCue('tap_soft');
    const dir = rollingToyRef.current.x > 0 ? -1 : 1;
    rollingToyRef.current.vx = dir * (1.35 + Math.random() * 0.65);
    focusCompanionOn(320 + rollingToyRef.current.x * 210, 285, 'happy');
    onUpdateNeeds({
      ...needs,
      sleeping: false,
      joy: Math.min(100, needs.joy + 10),
      lastUpdatedMs: Date.now(),
    });
  };

  // --- 4 Cozy Care Actions (Feed, Pet, Play, Sleep/Wake) ---
  const handleFeed = () => {
    gentleSoundEngine.unlock();
    gentleSoundEngine.playCue('animalese_happy');
    setEating(true);
    setOverrideEmotion('happy');
    const petX = 320 + petWalkRef.current.pos * 130;
    spawnParticles(petX, 150, 'snack', '#C59E49', 4);
    spawnParticles(petX, 135, 'heart', '#C77A6B', 4);
    onUpdateNeeds({
      ...needs,
      sleeping: false,
      belly: Math.min(100, needs.belly + 18),
      joy: Math.min(100, needs.joy + 8),
      lastUpdatedMs: Date.now(),
    });
    window.setTimeout(() => {
      setEating(false);
      setOverrideEmotion(null);
    }, 1100);
  };

  const handleCuddle = () => {
    gentleSoundEngine.unlock();
    gentleSoundEngine.playCue('purr_soft');
    setOverrideEmotion('happy');
    const petX = 320 + petWalkRef.current.pos * 130;
    spawnParticles(petX, 130, 'heart', '#C77A6B', 6);
    onUpdateNeeds({
      ...needs,
      joy: Math.min(100, needs.joy + 16),
      lastUpdatedMs: Date.now(),
    });
    window.setTimeout(() => setOverrideEmotion(null), 1200);
  };

  const handleToggleSleep = () => {
    gentleSoundEngine.unlock();
    const nextSleeping = !needs.sleeping;
    gentleSoundEngine.playCue(nextSleeping ? 'animalese_comfort' : 'animalese_happy');
    onUpdateNeeds({
      ...needs,
      sleeping: nextSleeping,
      energy: nextSleeping ? Math.min(100, needs.energy + 22) : needs.energy,
      lastUpdatedMs: Date.now(),
    });
  };

  const isCat = creatureInputs.species === 'aurikat';
  const isAxolotl = creatureInputs.species === 'nube_ajolote';
  const isFoxOwl = creatureInputs.species === 'zorro_buho';

  const petX = 320 + petWalkRef.current.pos * 130;
  const toyX = 320 + rollingToyRef.current.x * 210;

  const activeEmotion: EmotionId = needs.sleeping
    ? 'calm'
    : overrideEmotion ?? creatureInputs.emotion;

  const homeTitle = isCat
    ? 'Casa Cozy de AuriKat'
    : isAxolotl
      ? 'Pecera Encantada de Nube-Ajolote'
      : 'Casa del Árbol de Zorro-Búho';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Habitat Header Bar: Home Title + Non-Punitive Cozy Care Meters */}
      <div className="ak-row" style={{ justifyContent: 'space-between', width: '100%' }}>
        <div className="ak-row" style={{ gap: 8 }}>
          <span className="ak-nurture-pill">🏡 {homeTitle}</span>
          <span className="ak-nurture-pill">☀ {sharedDaysCount} días</span>
          <span className="ak-nurture-pill">★ {stickersCount}</span>
        </div>

        {/* 3 Gentle Care Meters (Safe Floor >= 35%, Never Punitive) */}
        <div className="ak-row" style={{ gap: 8 }} aria-label="Bienestar del compañero">
          <span className="ak-nurture-pill" title="Barriguita">
            🍓 {needs.belly}%
          </span>
          <span className="ak-nurture-pill" title="Mimo y Alegría">
            💛 {needs.joy}%
          </span>
          <span className="ak-nurture-pill" title="Energía">
            🌙 {needs.energy}%
          </span>
        </div>
      </div>

      {/* Interactive Hearthstone-Style Habitat Canvas */}
      <div
        style={{
          width: '100%',
          borderRadius: 28,
          overflow: 'hidden',
          border: '2px solid rgba(43, 51, 48, 0.08)',
          boxShadow: 'var(--ak-shadow-soft)',
          position: 'relative',
          background: isAxolotl
            ? 'linear-gradient(180deg, #D5E8F0 0%, #BEDAE6 68%, #E6D7B9 68%, #D9C59E 100%)'
            : isFoxOwl
              ? 'linear-gradient(180deg, #E2E9DD 0%, #CFDCCC 68%, #C4AE8F 68%, #B39B7B 100%)'
              : 'linear-gradient(180deg, var(--ak-surface-raised) 0%, var(--ak-bg) 68%, #DFD3C0 68%, #CFC0A8 100%)',
          filter: needs.sleeping ? 'brightness(0.78)' : 'none',
          transition: 'filter 360ms ease',
        }}
      >
        <svg
          ref={stageRef}
          viewBox="0 0 640 330"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onPointerMove={handleStagePointerMove}
        >
          {/* ================= BACKGROUND ARCHITECTURE BY SPECIES ================= */}
          {isCat && (
            <g>
              {/* Cozy Cat House Window & Bookshelf */}
              <rect x="245" y="28" width="150" height="106" rx="18" fill={lampLit ? '#F7EFE0' : '#CFD8DC'} stroke="#6E5D4F" strokeWidth="4" />
              <line x1="320" y1="28" x2="320" y2="134" stroke="#6E5D4F" strokeWidth="3" />
              <line x1="245" y1="81" x2="395" y2="81" stroke="#6E5D4F" strokeWidth="3" />
              <circle cx="282" cy="54" r="12" fill="#E6C77E" opacity="0.65" />
              {/* Woven Rug */}
              <ellipse cx="320" cy="282" rx="225" ry="34" fill="#D5B895" stroke="#8C6D4E" strokeWidth="3" />
              <ellipse cx="320" cy="282" rx="185" ry="23" fill="#E6D2B8" />
            </g>
          )}

          {isAxolotl && (
            <g>
              {/* Enchanted Aquarium Water Rays & Sandy Seascape (SpongeBob / Fairly OddParents cozy homage) */}
              <polygon points="120,0 185,0 240,225 75,225" fill="#F4FAFC" opacity="0.26" />
              <polygon points="390,0 460,0 520,225 340,225" fill="#F4FAFC" opacity="0.22" />
              {/* Aquarium Floral Sky Clouds (Bikini Bottom gentle nod) */}
              <g fill="none" stroke="#8AB4C7" strokeWidth="2.4" opacity="0.55">
                <circle cx="290" cy="48" r="14" />
                <circle cx="290" cy="48" r="5" />
                <circle cx="430" cy="72" r="11" />
                <circle cx="430" cy="72" r="4" />
              </g>
              {/* Smooth Rocks & Sandy Dunes */}
              <ellipse cx="140" cy="245" rx="68" ry="22" fill="#B2A394" />
              <ellipse cx="515" cy="248" rx="64" ry="20" fill="#A69888" />
              <ellipse cx="320" cy="286" rx="240" ry="34" fill="#E9DBBE" stroke="#C4B08B" strokeWidth="2.5" />
              {/* Interactive Enchanted Sandcastle (Prop #6 for Axolotl) */}
              <g
                transform="translate(135, 145)"
                style={{ cursor: 'pointer' }}
                onClick={handleTapCastleOrFireflyJar}
              >
                <title>Castillo de Arena Encantado (tocar para abrir puente y burbujas)</title>
                <rect x="10" y="34" width="54" height="48" rx="4" fill="#D9C193" stroke="#7A6542" strokeWidth="2.5" />
                <rect x="4" y="18" width="18" height="24" fill="#E3CD9F" stroke="#7A6542" strokeWidth="2.4" />
                <rect x="52" y="18" width="18" height="24" fill="#E3CD9F" stroke="#7A6542" strokeWidth="2.4" />
                <polygon points="13,4 2,18 24,18" fill="#C77A6B" stroke="#7A6542" strokeWidth="2" />
                <polygon points="61,4 50,18 72,18" fill="#5B85A8" stroke="#7A6542" strokeWidth="2" />
                {/* Drawbridge door */}
                <path
                  d="M27 82 V58 a10 10 0 0 1 20 0 V82 Z"
                  fill={castleOpen ? '#4A6E7D' : '#8C6D4E'}
                  stroke="#5C4731"
                  strokeWidth="2.2"
                />
                {castleOpen && <circle cx="37" cy="68" r="4.5" fill="#C59E49" />}
              </g>
            </g>
          )}

          {isFoxOwl && (
            <g>
              {/* Woodland Treehouse Round Window & Moss Rug */}
              <circle cx="320" cy="82" r="54" fill={lampLit ? '#D8E7D4' : '#35484A'} stroke="#6B4F38" strokeWidth="7" />
              <circle cx="336" cy="68" r="14" fill="#E9D69B" opacity="0.8" />
              <path d="M276 112 L298 84 L322 112 Z" fill="#6D8F78" />
              <path d="M306 114 L334 78 L362 114 Z" fill="#587A63" />
              <ellipse cx="320" cy="284" rx="225" ry="34" fill="#7D9C7B" stroke="#4D684B" strokeWidth="3" />
              <ellipse cx="320" cy="284" rx="185" ry="23" fill="#98B594" />
            </g>
          )}

          {/* ================= PROP 1: HANGING PENDULUM LAMP / BUOY (TOP LEFT) ================= */}
          <g
            transform={`translate(110, 0) rotate(${pendulumRef.current.angleDeg.toFixed(2)} 0 0)`}
            style={{ cursor: 'pointer' }}
            onClick={handleTapPendulumLamp}
          >
            <title>Lámpara péndulo interactiva (tocar para balancear)</title>
            <line x1="0" y1="0" x2="0" y2="52" stroke="#4A3C31" strokeWidth="3" />
            {lampLit && (
              <circle cx="0" cy="70" r="38" fill="#EED99B" opacity="0.34" />
            )}
            {isAxolotl ? (
              <circle cx="0" cy="68" r="18" fill={lampLit ? '#E8C56B' : '#8DA8B5'} stroke="#3B4C54" strokeWidth="2.8" />
            ) : isFoxOwl ? (
              <g>
                <path d="M-16 56 Q0 44 16 56 Z" fill="#6B4F38" stroke="#3E2F26" strokeWidth="2.5" />
                <circle cx="0" cy="68" r="15" fill={lampLit ? '#F2D583' : '#9AA399'} stroke="#3E2F26" strokeWidth="2.5" />
              </g>
            ) : (
              <rect x="-20" y="50" width="40" height="34" rx="14" fill={lampLit ? '#F5DF9E' : '#C9C4B8'} stroke="#4A3C31" strokeWidth="2.8" />
            )}
          </g>

          {/* ================= PROP 2: PENTATONIC WIND CHIMES (TOP RIGHT) ================= */}
          <g transform="translate(505, 0)">
            <rect x="-12" y="10" width="84" height="8" rx="4" fill="#8C6D4E" />
            {[0, 1, 2].map((i) => {
              const idx = i as 0 | 1 | 2;
              const ang = chimeAnglesRef.current[idx].angleDeg;
              const xPos = i * 28;
              return (
                <g
                  key={i}
                  transform={`translate(${xPos}, 18) rotate(${ang.toFixed(2)} 0 0)`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleTapChime(idx, e)}
                  onPointerEnter={() => handleTapChime(idx)}
                >
                  <title>Campana musical #{i + 1}</title>
                  <line x1="0" y1="0" x2="0" y2={24 + i * 5} stroke="#5C4B3B" strokeWidth="2" />
                  {isAxolotl ? (
                    <path
                      d={`M-10 ${24 + i * 5} Q0 ${14 + i * 5} 10 ${24 + i * 5} Q0 ${38 + i * 5} -10 ${24 + i * 5} Z`}
                      fill={i === 1 ? '#DFBFC4' : '#E8D5B7'}
                      stroke="#4F3940"
                      strokeWidth="2.2"
                    />
                  ) : (
                    <rect
                      x="-7"
                      y={24 + i * 5}
                      width="14"
                      height={26 - i * 2}
                      rx="6"
                      fill={i === 0 ? '#C59E49' : i === 1 ? '#6C9B8A' : '#B58E65'}
                      stroke="#3E2F26"
                      strokeWidth="2.2"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* ================= PROP 3: TEAPOT / BUBBLE VOLCANO (LEFT FLOOR) ================= */}
          <g
            transform="translate(58, 212)"
            style={{ cursor: 'pointer' }}
            onClick={handleTapStreamerOrVolcano}
          >
            <title>{isAxolotl ? 'Volcán de burbujas suaves' : 'Tetera tibia con vapor'}</title>
            {isAxolotl ? (
              <g>
                <polygon points="8,54 24,14 48,14 64,54" fill="#8C7A6B" stroke="#4A3C31" strokeWidth="2.8" strokeLinejoin="round" />
                <ellipse cx="36" cy="14" rx="12" ry="4.5" fill="#487693" />
              </g>
            ) : (
              <g>
                <rect x="4" y="46" width="64" height="10" rx="4" fill="#8C6D4E" />
                <ellipse cx="36" cy="30" rx="22" ry="17" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.6" />
                <path d="M56 26 Q68 18 66 10" fill="none" stroke="#2B3330" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M14 22 Q4 22 8 34 Q12 40 16 36" fill="none" stroke="#2B3330" strokeWidth="3" />
                <ellipse cx="36" cy="13" rx="10" ry="3.5" fill="#C59E49" stroke="#2B3330" strokeWidth="2" />
              </g>
            )}
          </g>

          {/* ================= PROP 4: FIREFLY JAR (CAT / FOX-OWL RIGHT SHELF) ================= */}
          {!isAxolotl && (
            <g
              transform="translate(460, 204)"
              style={{ cursor: 'pointer' }}
              onClick={handleTapCastleOrFireflyJar}
            >
              <title>Frasco de luciérnagas calmadas (tocar para liberar destellos)</title>
              <rect x="6" y="14" width="34" height="42" rx="10" fill="rgba(247, 249, 245, 0.68)" stroke="#4A3C31" strokeWidth="2.6" />
              <rect x="11" y="8" width="24" height="7" rx="3" fill="#8C6D4E" stroke="#4A3C31" strokeWidth="2" />
              <circle cx="18" cy="30" r="4" fill="#C59E49" />
              <circle cx="28" cy="40" r="3.5" fill="#E3C36F" />
            </g>
          )}

          {/* ================= PROP 5: 3-STAGE BLOOMING PLANT / CORAL / MUSHROOM (FAR RIGHT) ================= */}
          <g
            transform="translate(524, 198)"
            style={{ cursor: 'pointer' }}
            onClick={handleTapBloomProp}
          >
            <title>Planta mágica de 3 etapas (tocar para hacer florecer)</title>
            {isAxolotl ? (
              <g>
                <ellipse cx="32" cy="58" rx="22" ry="9" fill="#9E8F7C" stroke="#4A3C31" strokeWidth="2.4" />
                <path d="M32 52 Q22 34 26 22" fill="none" stroke="#C38796" strokeWidth="6" strokeLinecap="round" />
                {plantStage >= 1 && (
                  <path d="M32 52 Q44 34 40 18" fill="none" stroke="#7BA7A1" strokeWidth="6" strokeLinecap="round" />
                )}
                {plantStage === 2 && (
                  <>
                    <circle cx="26" cy="18" r="8" fill="#E8C56B" />
                    <circle cx="40" cy="14" r="9" fill="#DFBFC4" />
                  </>
                )}
              </g>
            ) : (
              <g>
                <polygon points="14,34 50,34 44,62 20,62" fill="#B57C5E" stroke="#4A3C31" strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M32 34 V14" stroke="#527E72" strokeWidth="4" strokeLinecap="round" />
                <path d="M32 26 Q18 18 20 12 Q30 14 32 26 Z" fill="#5E8B7E" />
                {plantStage >= 1 && (
                  <path d="M32 24 Q46 16 44 10 Q34 12 32 24 Z" fill="#5E8B7E" />
                )}
                {plantStage === 2 && (
                  <g transform="translate(32, 8)">
                    <circle cx="-7" cy="0" r="6" fill="#D9A7AE" />
                    <circle cx="7" cy="0" r="6" fill="#D9A7AE" />
                    <circle cx="0" cy="-7" r="6" fill="#D9A7AE" />
                    <circle cx="0" cy="7" r="6" fill="#D9A7AE" />
                    <circle cx="0" cy="0" r="5" fill="#C59E49" />
                  </g>
                )}
              </g>
            )}
          </g>

          {/* ================= COMPANION (WITH AUTONOMOUS GENTLE WANDERING) ================= */}
          <g transform={`translate(${(petX - 105).toFixed(1)}, 68)`}>
            <ProceduralCreatureRig
              inputs={{
                ...creatureInputs,
                lookX: lookTarget.x,
                lookY: lookTarget.y,
                emotion: activeEmotion,
              }}
              size={210}
              sleeping={needs.sleeping}
              eating={eating}
              onTap={() => {
                gentleSoundEngine.unlock();
                gentleSoundEngine.playCue('animalese_happy');
                setOverrideEmotion('happy');
                window.setTimeout(() => setOverrideEmotion(null), 1100);
              }}
              onPet={handleCuddle}
            />
          </g>

          {/* ================= PROP 6: ROLLING YARN BALL / SEA PEARL / PINECONE (FOREGROUND) ================= */}
          <g
            transform={`translate(${toyX.toFixed(1)}, 286) rotate(${rollingToyRef.current.rotationDeg.toFixed(1)})`}
            style={{ cursor: 'pointer' }}
            onClick={handleKickRollingToy}
          >
            <title>Juguete rodante (tocar para hacer rodar)</title>
            {isAxolotl ? (
              <g>
                <circle cx="0" cy="0" r="19" fill="#F2ECE4" stroke="#6E5D53" strokeWidth="2.6" />
                <circle cx="-6" cy="-6" r="5" fill="#FFFFFF" opacity="0.8" />
              </g>
            ) : isFoxOwl ? (
              <g>
                <ellipse cx="0" cy="0" rx="19" ry="16" fill="#8C6244" stroke="#3E2F26" strokeWidth="2.6" />
                <path d="M-10 -8 Q0 4 10 -8 M-12 2 Q0 14 12 2" fill="none" stroke="#3E2F26" strokeWidth="2.2" />
              </g>
            ) : (
              <g>
                <circle cx="0" cy="0" r="19" fill="#C77A6B" stroke="#4A3C31" strokeWidth="2.6" />
                <path d="M-12 -8 Q0 6 12 -8 M-10 8 Q0 -6 10 8" fill="none" stroke="#F4E9D8" strokeWidth="2.2" />
              </g>
            )}
          </g>

          {/* ================= LIVE COZY PARTICLES (STEAM, BUBBLES, PETALS, FIREFLIES, HEARTS) ================= */}
          {particlesRef.current.map((p) => (
            <g key={p.id} opacity={Math.max(0, Math.min(1, p.life))}>
              {p.kind === 'heart' ? (
                <text x={p.x} y={p.y} fontSize="18" fill={p.color} textAnchor="middle">
                  ♥
                </text>
              ) : p.kind === 'snack' ? (
                <text x={p.x} y={p.y} fontSize="18" textAnchor="middle">
                  {isAxolotl ? '🦐' : isFoxOwl ? '🫐' : '🍪'}
                </text>
              ) : p.kind === 'petal' ? (
                <ellipse cx={p.x} cy={p.y} rx="5" ry="3" fill={p.color} />
              ) : (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.kind === 'steam' ? 7 : p.kind === 'bubble' ? 6 : 4.5}
                  fill={p.kind === 'bubble' ? 'none' : p.color}
                  stroke={p.kind === 'bubble' ? p.color : 'none'}
                  strokeWidth="2.2"
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* 4 Pediatric Cozy Care Action Buttons (>= 64px height) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(110px, 1fr))',
          gap: 12,
          width: '100%',
        }}
      >
        <button type="button" className="ak-primary-target" style={{ minHeight: 68 }} onClick={handleFeed}>
          <span style={{ fontSize: '1.35rem' }}>{isAxolotl ? '🦐' : isFoxOwl ? '🫐' : '🍪'}</span>
          <span>Alimentar</span>
        </button>

        <button type="button" className="ak-primary-target" style={{ minHeight: 68 }} onClick={handleCuddle}>
          <span style={{ fontSize: '1.35rem' }}>🤚</span>
          <span>Acariciar</span>
        </button>

        <button type="button" className="ak-primary-target" style={{ minHeight: 68 }} onClick={() => handleKickRollingToy()}>
          <span style={{ fontSize: '1.35rem' }}>🧶</span>
          <span>Jugar</span>
        </button>

        <button
          type="button"
          className="ak-primary-target"
          style={{ minHeight: 68 }}
          data-selected={needs.sleeping}
          onClick={handleToggleSleep}
        >
          <span style={{ fontSize: '1.35rem' }}>{needs.sleeping ? '☀' : '🌙'}</span>
          <span>{needs.sleeping ? 'Despertar' : 'Dormir'}</span>
        </button>
      </div>
    </div>
  );
};
