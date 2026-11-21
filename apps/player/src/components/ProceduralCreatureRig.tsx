import React, { useEffect, useState } from 'react';
import {
  CALM_PALETTES,
  clampLookCoordinate,
  SPECIES_CATALOG,
  type CreatureViewModelInputs,
} from '@aurikat/core-engine';

interface ProceduralCreatureRigProps {
  inputs: CreatureViewModelInputs;
  size?: number;
  onTap?: () => void;
  ariaLabel?: string;
}

/**
 * ProceduralCreatureRig — Beta v1.0 60fps implementation of ICreatureRigAdapter v2 (IC-4).
 * Supports 3 cultural archetypes (cuento_pastel, criatura_companera, cozy_pixel),
 * 3 species (aurikat, nube_ajolote, zorro_buho), 7 crystal-clear expressions,
 * continuous gaze coordinates (lookX, lookY) with high sclera/pupil contrast,
 * desaturated warm honey-gold Au infinity charm, and 6 unlockable accessories.
 */
export const ProceduralCreatureRig: React.FC<ProceduralCreatureRigProps> = ({
  inputs,
  size = 210,
  onTap,
  ariaLabel = 'AuriKat compañero interactivo',
}) => {
  const [blinking, setBlinking] = useState(false);

  // Natural soft blink respecting WCAG reduced motion (motionScale === 0 disables blink)
  useEffect(() => {
    if (inputs.motionScale <= 0.05) {
      setBlinking(false);
      return;
    }
    const timer = window.setInterval(() => {
      setBlinking(true);
      window.setTimeout(() => setBlinking(false), 140);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [inputs.motionScale]);

  const sp = SPECIES_CATALOG[inputs.species];
  const pal = CALM_PALETTES[inputs.paletteId];
  const lx = clampLookCoordinate(inputs.lookX);
  const ly = clampLookCoordinate(inputs.lookY);
  const isPixel = inputs.archetype === 'cozy_pixel';
  const isPastel = inputs.archetype === 'cuento_pastel';

  // Head subtle shift toward gaze direction (IC-4 Joint Attention clarity)
  const headShiftX = inputs.action === 'look_away' ? -10 : lx * 4.5;
  const headShiftY = ly * 3;
  const pupilDx = inputs.action === 'look_away' ? -7 : lx * 7.5;
  const pupilDy = ly * 5.2;

  const strokeW = isPastel ? 5.2 : 3.4;

  // Emotion-driven ear & posture tilt
  const earDroop = inputs.emotion === 'sad' ? 16 : inputs.emotion === 'angry' ? -12 : inputs.emotion === 'surprised' ? -8 : 0;
  const bodyScaleY =
    inputs.action === 'celebrate_soft'
      ? 1.05
      : inputs.emotion === 'scared'
        ? 0.94
        : inputs.action === 'breathe'
          ? 1.03
          : 1;

  // Pixel archetype renders authentic crisp blocky proportions WITH wide crisp eyes (6x6-8x8 virtual px) for Gaze-Cueing parity!
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
        onClick={onTap}
        style={{
          cursor: onTap ? 'pointer' : 'default',
          overflow: 'visible',
          transform: `scaleY(${bodyScaleY})`,
          transition: inputs.motionScale > 0 ? 'transform 240ms ease' : 'none',
        }}
        className={inputs.motionScale > 0 && inputs.action === 'idle' ? 'ak-float' : undefined}
      >
        {/* Ground shadow */}
        <rect x="44" y="142" width="72" height="8" fill="rgba(43,51,48,0.12)" />

        {/* Body */}
        <rect x="46" y="88" width="68" height="52" fill={sp.bodyFill} />
        <rect x="56" y="98" width="48" height="36" fill={sp.bellyFill} />
        {/* Pixel outline accents */}
        <rect x="42" y="92" width="4" height="44" fill={sp.strokeColor} />
        <rect x="114" y="92" width="4" height="44" fill={sp.strokeColor} />
        <rect x="46" y="140" width="68" height="4" fill={sp.strokeColor} />

        {/* Species Ears / Gills in Pixel Style */}
        <g transform={`translate(${Math.round(headShiftX)}, ${Math.round(headShiftY)})`}>
          {inputs.species === 'aurikat' && (
            <>
              <rect x="38" y="24" width="20" height="24" fill={sp.bodyFill} />
              <rect x="44" y="30" width="10" height="14" fill={sp.earAccent} />
              <rect x="102" y="24" width="20" height="24" fill={sp.bodyFill} />
              <rect x="106" y="30" width="10" height="14" fill={sp.earAccent} />
            </>
          )}
          {inputs.species === 'nube_ajolote' && (
            <>
              <rect x="20" y="46" width="18" height="8" fill={sp.earAccent} />
              <rect x="22" y="58" width="16" height="8" fill={sp.earAccent} />
              <rect x="24" y="70" width="14" height="8" fill={sp.earAccent} />
              <rect x="122" y="46" width="18" height="8" fill={sp.earAccent} />
              <rect x="122" y="58" width="16" height="8" fill={sp.earAccent} />
              <rect x="122" y="70" width="14" height="8" fill={sp.earAccent} />
            </>
          )}
          {inputs.species === 'zorro_buho' && (
            <>
              <rect x="34" y="20" width="22" height="26" fill={sp.earAccent} />
              <rect x="42" y="28" width="10" height="14" fill={sp.bellyFill} />
              <rect x="104" y="20" width="22" height="26" fill={sp.earAccent} />
              <rect x="108" y="28" width="10" height="14" fill={sp.bellyFill} />
            </>
          )}

          {/* Head */}
          <rect x="38" y="38" width="84" height="58" fill={sp.bodyFill} />
          <rect x="34" y="44" width="4" height="46" fill={sp.strokeColor} />
          <rect x="122" y="44" width="4" height="46" fill={sp.strokeColor} />
          <rect x="42" y="34" width="76" height="4" fill={sp.strokeColor} />

          {/* High-Readability Pixel Sclera (22x20) + Clear Pupil (10x10) for Gaze-Cueing (IC-4) */}
          {blinking || inputs.emotion === 'calm' ? (
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

          {/* Eyebrows for crystal emotion clarity */}
          {inputs.emotion === 'angry' && (
            <>
              <rect x="50" y="46" width="18" height="4" fill={sp.strokeColor} />
              <rect x="92" y="46" width="18" height="4" fill={sp.strokeColor} />
            </>
          )}
          {inputs.emotion === 'surprised' && (
            <>
              <rect x="50" y="42" width="18" height="4" fill={sp.strokeColor} />
              <rect x="92" y="42" width="18" height="4" fill={sp.strokeColor} />
            </>
          )}

          {/* Pixel Mouth by Emotion */}
          {inputs.emotion === 'happy' && (
            <>
              <rect x="68" y="78" width="24" height="4" fill={sp.strokeColor} />
              <rect x="72" y="82" width="16" height="4" fill={sp.earAccent} />
            </>
          )}
          {inputs.emotion === 'surprised' && (
            <rect x="74" y="76" width="12" height="10" fill={sp.strokeColor} />
          )}
          {inputs.emotion === 'sad' && (
            <>
              <rect x="72" y="78" width="16" height="4" fill={sp.strokeColor} />
              <rect x="68" y="82" width="4" height="4" fill={sp.strokeColor} />
              <rect x="88" y="82" width="4" height="4" fill={sp.strokeColor} />
            </>
          )}
          {inputs.emotion === 'scared' && (
            <>
              <rect x="70" y="78" width="20" height="6" fill={sp.strokeColor} />
              <rect x="74" y="80" width="12" height="2" fill="#F8F7F2" />
            </>
          )}
          {(inputs.emotion === 'neutral' || inputs.emotion === 'calm' || inputs.emotion === 'angry') && (
            <rect x="72" y="80" width="16" height="4" fill={sp.strokeColor} />
          )}

          {/* Accessories */}
          {inputs.accessory === 'leaf_hat' && <rect x="66" y="22" width="28" height="12" fill="#5E8B7E" />}
          {inputs.accessory === 'round_glasses' && (
            <>
              <rect x="44" y="50" width="28" height="24" fill="none" stroke={pal.auGold} strokeWidth="3" />
              <rect x="88" y="50" width="28" height="24" fill="none" stroke={pal.auGold} strokeWidth="3" />
            </>
          )}
        </g>

        {/* Desaturated Honey-Gold Au Infinity Collar Charm */}
        <rect x="52" y="96" width="56" height="6" fill={pal.accent} />
        <rect x="72" y="102" width="16" height="8" fill={pal.auGold} />
        <rect x="75" y="104" width="4" height="4" fill={sp.bellyFill} />
        <rect x="81" y="104" width="4" height="4" fill={sp.bellyFill} />
      </svg>
    );
  }

  // Organic Vector Rig (Cuento Pastel & Criatura Compañera)
  const headRadiusX = isPastel ? 52 : 48;
  const headRadiusY = isPastel ? 46 : 42;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={ariaLabel}
      onClick={onTap}
      style={{
        cursor: onTap ? 'pointer' : 'default',
        overflow: 'visible',
        transform: `scaleY(${bodyScaleY})`,
        transition: inputs.motionScale > 0 ? 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
      }}
      className={inputs.motionScale > 0 && inputs.action === 'idle' ? 'ak-float' : undefined}
    >
      {/* Soft Ground Shadow */}
      <ellipse cx="100" cy="180" rx="52" ry="10" fill="rgba(43,51,48,0.10)" />

      {/* Expressive Tail */}
      <path
        d={
          inputs.emotion === 'sad'
            ? 'M136 154 C156 160, 166 172, 152 174'
            : 'M136 152 C164 146, 174 118, 160 108'
        }
        fill="none"
        stroke={sp.bodyFill}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d={
          inputs.emotion === 'sad'
            ? 'M136 154 C156 160, 166 172, 152 174'
            : 'M136 152 C164 146, 174 118, 160 108'
        }
        fill="none"
        stroke={sp.strokeColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Cloud Backpack Accessory (behind body) */}
      {inputs.accessory === 'cloud_backpack' && (
        <g>
          <circle cx="54" cy="134" r="18" fill="#DCE8F0" stroke={sp.strokeColor} strokeWidth="3" />
          <circle cx="146" cy="134" r="18" fill="#DCE8F0" stroke={sp.strokeColor} strokeWidth="3" />
        </g>
      )}

      {/* Body */}
      <ellipse
        cx="100"
        cy="144"
        rx="44"
        ry="36"
        fill={sp.bodyFill}
        stroke={sp.strokeColor}
        strokeWidth={strokeW}
      />
      <ellipse cx="100" cy="148" rx="28" ry="24" fill={sp.bellyFill} />

      {/* Paws / Pointing Action for 4-5y Gaze+Point Joint Attention */}
      {inputs.action === 'point_left' ? (
        <ellipse cx="42" cy="130" rx="18" ry="10" transform="rotate(-18 42 130)" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      ) : (
        <ellipse cx="70" cy="168" rx="14" ry="10" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      )}

      {inputs.action === 'point_right' ? (
        <ellipse cx="158" cy="130" rx="18" ry="10" transform="rotate(18 158 130)" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      ) : inputs.action === 'wave' ? (
        <ellipse cx="146" cy="122" rx="15" ry="10" transform="rotate(-38 146 122)" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      ) : (
        <ellipse cx="130" cy="168" rx="14" ry="10" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      )}

      {inputs.action === 'point_center' && (
        <ellipse cx="100" cy="164" rx="14" ry="11" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} />
      )}

      {/* Scarf Accessory */}
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

      {/* Head Group (tracks gaze subtly) */}
      <g
        transform={`translate(${headShiftX}, ${headShiftY})`}
        style={{ transition: inputs.motionScale > 0 ? 'transform 200ms ease-out' : 'none' }}
      >
        {/* Species Ears / Gills */}
        {inputs.species === 'aurikat' && (
          <>
            <g transform={`rotate(${-earDroop} 66 56)`}>
              <path d="M56 66 L50 24 L84 48 Z" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M60 58 L57 35 L76 50 Z" fill={sp.earAccent} />
            </g>
            <g transform={`rotate(${earDroop} 134 56)`}>
              <path d="M144 66 L150 24 L116 48 Z" fill={sp.bodyFill} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M140 58 L143 35 L124 50 Z" fill={sp.earAccent} />
            </g>
          </>
        )}

        {inputs.species === 'nube_ajolote' && (
          <>
            <g transform={`rotate(${-earDroop * 0.5} 52 78)`}>
              <ellipse cx="40" cy="64" rx="18" ry="8" transform="rotate(-24 40 64)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="36" cy="80" rx="19" ry="8" transform="rotate(-5 36 80)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="42" cy="96" rx="17" ry="8" transform="rotate(18 42 96)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
            </g>
            <g transform={`rotate(${earDroop * 0.5} 148 78)`}>
              <ellipse cx="160" cy="64" rx="18" ry="8" transform="rotate(24 160 64)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="164" cy="80" rx="19" ry="8" transform="rotate(5 164 80)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
              <ellipse cx="158" cy="96" rx="17" ry="8" transform="rotate(-18 158 96)" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
            </g>
          </>
        )}

        {inputs.species === 'zorro_buho' && (
          <>
            <g transform={`rotate(${-earDroop * 0.8} 64 52)`}>
              <path d="M52 66 Q44 24 72 22 L84 48 Z" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M58 58 Q56 36 70 34 L77 50 Z" fill={sp.bellyFill} />
            </g>
            <g transform={`rotate(${earDroop * 0.8} 136 52)`}>
              <path d="M148 66 Q156 24 128 22 L116 48 Z" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
              <path d="M142 58 Q144 36 130 34 L123 50 Z" fill={sp.bellyFill} />
            </g>
          </>
        )}

        {/* Main Head Silhouette */}
        <ellipse
          cx="100"
          cy="78"
          rx={headRadiusX}
          ry={headRadiusY}
          fill={sp.bodyFill}
          stroke={sp.strokeColor}
          strokeWidth={strokeW}
        />

        {/* Facial Disc / Cheeks */}
        {inputs.species === 'zorro_buho' && (
          <path d="M62 76 Q100 54 138 76 Q132 108 100 112 Q68 108 62 76 Z" fill={sp.bellyFill} opacity="0.88" />
        )}
        <ellipse cx="64" cy="94" rx="9" ry="5.5" fill={sp.earAccent} opacity="0.38" />
        <ellipse cx="136" cy="94" rx="9" ry="5.5" fill={sp.earAccent} opacity="0.38" />

        {/* Cat Whiskers */}
        {inputs.species === 'aurikat' && (
          <g stroke={sp.strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.55">
            <line x1="42" y1="84" x2="58" y2="87" />
            <line x1="40" y1="93" x2="57" y2="93" />
            <line x1="158" y1="84" x2="142" y2="87" />
            <line x1="160" y1="93" x2="143" y2="93" />
          </g>
        )}

        {/* EYES — High Sclera/Pupil Contrast for Unmistakable Gaze-Cueing (IC-4) */}
        {blinking ? (
          <g stroke={sp.strokeColor} strokeWidth="3.5" strokeLinecap="round">
            <path d="M68 77 Q78 82 88 77" fill="none" />
            <path d="M112 77 Q122 82 132 77" fill="none" />
          </g>
        ) : inputs.emotion === 'calm' ? (
          <g stroke={sp.strokeColor} strokeWidth="3.5" strokeLinecap="round">
            <path d="M68 79 Q78 72 88 79" fill="none" />
            <path d="M112 79 Q122 72 132 79" fill="none" />
          </g>
        ) : (
          <g>
            {/* Sclera */}
            <ellipse
              cx="78"
              cy="76"
              rx={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 14.5 : 13.5}
              ry={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 15.5 : 13.5}
              fill="#FAF9F5"
              stroke={sp.strokeColor}
              strokeWidth="2.8"
            />
            <ellipse
              cx="122"
              cy="76"
              rx={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 14.5 : 13.5}
              ry={inputs.emotion === 'surprised' || inputs.emotion === 'scared' ? 15.5 : 13.5}
              fill="#FAF9F5"
              stroke={sp.strokeColor}
              strokeWidth="2.8"
            />
            {/* Pupils tracking (lookX, lookY) */}
            <circle
              cx={78 + pupilDx}
              cy={76 + pupilDy}
              r={inputs.emotion === 'scared' ? 5.2 : 6.8}
              fill="#22272B"
            />
            <circle
              cx={122 + pupilDx}
              cy={76 + pupilDy}
              r={inputs.emotion === 'scared' ? 5.2 : 6.8}
              fill="#22272B"
            />
            {/* Specular eye highlights */}
            <circle cx={75.5 + pupilDx} cy={73.5 + pupilDy} r="2.2" fill="#FAF9F5" />
            <circle cx={119.5 + pupilDx} cy={73.5 + pupilDy} r="2.2" fill="#FAF9F5" />

            {/* Subtle tear glint for Sad */}
            {inputs.emotion === 'sad' && (
              <>
                <circle cx="86" cy="87" r="2.8" fill="#8FB5CC" />
                <circle cx="114" cy="87" r="2.8" fill="#8FB5CC" />
              </>
            )}
          </g>
        )}

        {/* Eyebrows for 7 Multimodal Expressions (MKT-03) */}
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
            <path d="M66 55 Q78 47 89 55" />
            <path d="M111 55 Q122 47 134 55" />
          </g>
        )}
        {inputs.emotion === 'scared' && (
          <g stroke={sp.strokeColor} strokeWidth="3.2" strokeLinecap="round" fill="none">
            <path d="M67 59 Q78 51 89 55" />
            <path d="M111 55 Q122 51 133 59" />
          </g>
        )}

        {/* Nose */}
        {inputs.species === 'zorro_buho' ? (
          <polygon points="95,88 105,88 100,95" fill={pal.auGold} stroke={sp.strokeColor} strokeWidth="1.8" />
        ) : (
          <ellipse cx="100" cy="89" rx="4.5" ry="3.2" fill={sp.strokeColor} />
        )}

        {/* Mouth by Emotion */}
        {inputs.emotion === 'happy' && (
          <path d="M84 95 Q100 112 116 95 Z" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" strokeLinejoin="round" />
        )}
        {inputs.emotion === 'calm' && (
          <path d="M88 97 Q100 105 112 97" fill="none" stroke={sp.strokeColor} strokeWidth="3" strokeLinecap="round" />
        )}
        {inputs.emotion === 'neutral' && (
          <path d="M90 98 Q100 102 110 98" fill="none" stroke={sp.strokeColor} strokeWidth="2.8" strokeLinecap="round" />
        )}
        {inputs.emotion === 'sad' && (
          <path d="M88 104 Q100 95 112 104" fill="none" stroke={sp.strokeColor} strokeWidth="3" strokeLinecap="round" />
        )}
        {inputs.emotion === 'angry' && (
          <path d="M87 102 Q100 97 113 102" fill="none" stroke={sp.strokeColor} strokeWidth="3.2" strokeLinecap="round" />
        )}
        {inputs.emotion === 'scared' && (
          <path d="M86 101 Q93 96 100 101 Q107 106 114 101" fill="none" stroke={sp.strokeColor} strokeWidth="3" strokeLinecap="round" />
        )}
        {inputs.emotion === 'surprised' && (
          <ellipse cx="100" cy="101" rx="7" ry="8.5" fill={sp.earAccent} stroke={sp.strokeColor} strokeWidth="2.8" />
        )}

        {/* Head Accessories */}
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
    </svg>
  );
};
