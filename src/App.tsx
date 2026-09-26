import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Axe,
  Hammer,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

type ToolName = 'hammer' | 'bat' | 'axe';
type Material = 'ceramic' | 'glass' | 'electronic' | 'wood' | 'metal' | 'ice' | 'stone';

type ObjectDefinition = {
  type: string;
  label: string;
  hp: number;
  points: number;
  width: number;
  height: number;
  material: Material;
  shards: string[];
};

type RoomObject = ObjectDefinition & {
  id: number;
  x: number;
  y: number;
  currentHp: number;
  destroying?: boolean;
};

type ImpactEffect = {
  id: number;
  x: number;
  y: number;
  color: string;
  word: string;
  big?: boolean;
};

type NumberEffect = {
  id: number;
  x: number;
  y: number;
  value: string;
  kind: 'score' | 'damage';
};

type DebrisEffect = {
  id: number;
  x: number;
  y: number;
  color: string;
  dx: number;
  dy: number;
  rotation: number;
  duration: number;
};

const OBJECT_LIBRARY: ObjectDefinition[] = [
  { type: 'tv', label: 'old television', hp: 5, points: 70, width: 170, height: 130, material: 'electronic', shards: ['#1a1a1c', '#315b72', '#36363b'] },
  { type: 'guitar', label: 'guitar', hp: 4, points: 75, width: 130, height: 180, material: 'wood', shards: ['#c17a3d', '#8a4a1e', '#5c2e0e'] },
  { type: 'vase', label: 'vase', hp: 2, points: 15, width: 100, height: 120, material: 'ceramic', shards: ['#8a5225', '#e2a86f', '#5c3416'] },
  { type: 'window', label: 'window', hp: 3, points: 35, width: 150, height: 150, material: 'glass', shards: ['#cfe8f0', '#ffffff', '#8cbed2'] },
  { type: 'trophy', label: 'trophy', hp: 3, points: 50, width: 90, height: 140, material: 'metal', shards: ['#f0cf5a', '#d4a017', '#8a6a10'] },
  { type: 'laptop', label: 'laptop', hp: 4, points: 60, width: 150, height: 110, material: 'electronic', shards: ['#b8bcc4', '#315d7a', '#6b7078'] },
  { type: 'chair', label: 'chair', hp: 4, points: 30, width: 120, height: 150, material: 'wood', shards: ['#7a4a28', '#a5733f', '#4a2f16'] },
  { type: 'lamp', label: 'lamp', hp: 2, points: 14, width: 110, height: 150, material: 'glass', shards: ['#ffb74d', '#fff3cf', '#6a6a6a'] },
  { type: 'mug', label: 'mug', hp: 2, points: 10, width: 100, height: 100, material: 'ceramic', shards: ['#e8e4d8', '#4a6fa5', '#c9c2ae'] },
  { type: 'painting', label: 'painting', hp: 3, points: 40, width: 140, height: 110, material: 'wood', shards: ['#c99a3f', '#ff8a65', '#5c4bb0'] },
  { type: 'clock', label: 'clock', hp: 4, points: 45, width: 120, height: 120, material: 'wood', shards: ['#c9b98a', '#6b4226', '#2a2a2a'] },
  { type: 'crystal', label: 'crystal', hp: 2, points: 65, width: 100, height: 120, material: 'glass', shards: ['#ffb4b2', '#d8468e', '#ffffff'] },
  { type: 'rock', label: 'rock', hp: 6, points: 20, width: 120, height: 100, material: 'stone', shards: ['#8a8378', '#5c574e', '#3a372f'] },
  { type: 'phone', label: 'phone', hp: 3, points: 50, width: 70, height: 130, material: 'electronic', shards: ['#1c1c1e', '#3a3a3c', '#0a84ff'] },
];

type ToolConfig = {
  multiplier: number;
  damage: number;
  cooldown: number;
  strong: Material[];
  strongLabel: string;
  color: string;
  word: string;
  icon: typeof Hammer;
};

// Each tool does double damage to the materials it is strong against, so the
// best tool depends on the target. The axe scores highest but needs a recovery beat.
const TOOL_CONFIG: Record<ToolName, ToolConfig> = {
  hammer: { multiplier: 1, damage: 1, cooldown: 0, strong: ['ceramic', 'stone', 'metal', 'ice'], strongLabel: 'clay · stone · metal', color: '#ff7139', word: 'SMASH!', icon: Hammer },
  bat: { multiplier: 1.25, damage: 1, cooldown: 0, strong: ['glass', 'electronic'], strongLabel: 'glass · tech', color: '#51d9e8', word: 'CRACK!', icon: Zap },
  axe: { multiplier: 1.6, damage: 1, cooldown: 450, strong: ['wood'], strongLabel: 'wood · slow', color: '#ff3d61', word: 'DESTROY!', icon: Axe },
};

const RAGE_DURATION = 6000;
const RAGE_DRAIN_DELAY = 1500;
const CHALLENGE_DURATION = 60000;
const BEST_SCORE_KEY = 'rage-room-best';

type GameMode = 'free' | 'challenge';

function readBestScore() {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value: number) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // Storage can be unavailable (private mode); the best score just won't persist.
  }
}

const INITIAL_PLACEMENTS = [
  { key: 'tv', x: 16, y: 29 },
  { key: 'guitar', x: 47, y: 23 },
  { key: 'vase', x: 71, y: 34 },
  { key: 'window', x: 78, y: 12 },
  { key: 'trophy', x: 31, y: 52 },
  { key: 'laptop', x: 56, y: 56 },
  { key: 'chair', x: 8, y: 55 },
];

const PARTS_BY_TYPE: Record<string, number> = {
  vase: 3, mug: 3, tv: 3, laptop: 4, phone: 3, window: 5,
  guitar: 4, chair: 4, painting: 2, trophy: 3, lamp: 3, clock: 4,
  crystal: 2, rock: 2,
};

let nextId = 100;
let nextEffectId = 1;

function createInitialObjects(): RoomObject[] {
  return INITIAL_PLACEMENTS.map((placement) => {
    const definition = OBJECT_LIBRARY.find((item) => item.type === placement.key) ?? OBJECT_LIBRARY[0];
    return { ...definition, id: nextId++, x: placement.x, y: placement.y, currentHp: definition.hp };
  });
}

function buildCracks(seed: number) {
  let value = seed;
  const random = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
  return Array.from({ length: 3 }, (_, index) => {
    let x = 43 + random() * 15;
    let y = 43 + random() * 15;
    let path = `M${x},${y}`;
    for (let step = 0; step < 4; step += 1) {
      x += (random() - .5) * 37;
      y += (random() - .5) * 37;
      path += ` L${x},${y}`;
    }
    return <path key={index} d={path} />;
  });
}

function useImpactAudio(muted: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  const context = useCallback(() => {
    if (muted || typeof window === 'undefined') return null;
    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      contextRef.current = new AudioContextClass();
    }
    if (contextRef.current.state === 'suspended') void contextRef.current.resume();
    return contextRef.current;
  }, [muted]);

  const play = useCallback((material: Material, destroyed: boolean, tool: ToolName) => {
    const audio = context();
    if (!audio) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    const base = material === 'glass' || material === 'ice' ? 980 : material === 'metal' ? 440 : material === 'wood' || material === 'stone' ? 120 : 220;
    oscillator.type = material === 'electronic' ? 'square' : material === 'metal' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(base * (tool === 'axe' ? 1.18 : 1), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(32, base * (destroyed ? .24 : .62)), now + (destroyed ? .33 : .12));
    filter.type = material === 'glass' || material === 'ice' ? 'highpass' : 'lowpass';
    filter.frequency.value = material === 'glass' ? 2600 : 1500;
    gain.gain.setValueAtTime(destroyed ? .18 : .11, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (destroyed ? .34 : .14));
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + (destroyed ? .36 : .16));

    if (destroyed) {
      const noise = audio.createBufferSource();
      const buffer = audio.createBuffer(1, audio.sampleRate * .2, audio.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
      noise.buffer = buffer;
      const noiseGain = audio.createGain();
      noiseGain.gain.setValueAtTime(.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(.001, now + .2);
      noise.connect(noiseGain);
      noiseGain.connect(audio.destination);
      noise.start(now);
      noise.stop(now + .22);
    }
  }, [context]);

  return play;
}

function ObjectArt({ object }: { object: RoomObject }) {
  const parts = PARTS_BY_TYPE[object.type] ?? 3;
  return (
    <div className={`object-shell shape type-${object.type}`} aria-hidden="true">
      {Array.from({ length: parts }, (_, index) => <i key={index} className={`p${index + 1}`} />)}
    </div>
  );
}

function App() {
  const [objects, setObjects] = useState<RoomObject[]>(createInitialObjects);
  const [tool, setTool] = useState<ToolName>('hammer');
  const [score, setScore] = useState(0);
  const [smashed, setSmashed] = useState(0);
  const [combo, setCombo] = useState(1);
  const [rage, setRage] = useState(0);
  const [muted, setMuted] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [banner, setBanner] = useState('');
  const [bannerKey, setBannerKey] = useState(0);
  const [impacts, setImpacts] = useState<ImpactEffect[]>([]);
  const [numberEffects, setNumberEffects] = useState<NumberEffect[]>([]);
  const [debris, setDebris] = useState<DebrisEffect[]>([]);
  const [rageMode, setRageMode] = useState(false);
  const [cooldownKey, setCooldownKey] = useState(0);
  const [mode, setMode] = useState<GameMode>('free');
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_DURATION);
  const [gameOver, setGameOver] = useState(false);
  const [bestScore, setBestScore] = useState(readBestScore);
  const [newBest, setNewBest] = useState(false);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const respawnTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const cooldownUntil = useRef(0);
  const lastHitAt = useRef(0);
  const rageEndsAt = useRef(0);
  const challengeEndsAt = useRef(0);
  const playSound = useImpactAudio(muted);

  const currentTool = TOOL_CONFIG[tool];
  const objectCountText = useMemo(() => `${objects.length} ${objects.length === 1 ? 'target' : 'targets'} in room`, [objects.length]);

  const removeEffect = useCallback((setter: React.Dispatch<React.SetStateAction<ImpactEffect[]>>, id: number) => {
    setter((items) => items.filter((item) => item.id !== id));
  }, []);

  const showBanner = useCallback((text: string) => {
    setBanner(text);
    setBannerKey((value) => value + 1);
  }, []);

  const addDebris = useCallback((object: RoomObject, centerX: number, centerY: number) => {
    const pieces = Array.from({ length: object.material === 'glass' ? 12 : 8 }, (_, index) => ({
      id: nextEffectId++,
      x: centerX + (Math.random() - .5) * 36,
      y: centerY + (Math.random() - .5) * 30,
      color: object.shards[index % object.shards.length],
      dx: (Math.random() - .5) * 190,
      dy: -40 - Math.random() * 150,
      rotation: -250 + Math.random() * 500,
      duration: 480 + Math.round(Math.random() * 320),
    }));
    setDebris((items) => [...items, ...pieces]);
    window.setTimeout(() => {
      const ids = new Set(pieces.map((piece) => piece.id));
      setDebris((items) => items.filter((piece) => !ids.has(piece.id)));
    }, 900);
  }, []);

  const addImpact = useCallback((x: number, y: number, color: string, word: string, big: boolean) => {
    const id = nextEffectId++;
    setImpacts((items) => [...items, { id, x, y, color, word, big }]);
    window.setTimeout(() => removeEffect(setImpacts, id), 760);
  }, [removeEffect]);

  const addNumber = useCallback((x: number, y: number, value: string, kind: NumberEffect['kind']) => {
    const id = nextEffectId++;
    setNumberEffects((items) => [...items, { id, x, y, value, kind }]);
    window.setTimeout(() => setNumberEffects((items) => items.filter((item) => item.id !== id)), 900);
  }, []);

  const spawnStuff = useCallback((count = 1) => {
    const newItems = Array.from({ length: count }, () => {
      const definition = OBJECT_LIBRARY[Math.floor(Math.random() * OBJECT_LIBRARY.length)];
      return {
        ...definition,
        id: nextId++,
        x: 8 + Math.random() * 78,
        y: 15 + Math.random() * 52,
        currentHp: definition.hp,
      };
    });
    setObjects((items) => [...items, ...newItems].slice(-10));
  }, []);

  const resetGame = useCallback(() => {
    if (comboTimer.current) clearTimeout(comboTimer.current);
    respawnTimers.current.forEach((timer) => clearTimeout(timer));
    respawnTimers.current.clear();
    cooldownUntil.current = 0;
    setObjects(createInitialObjects());
    setScore(0);
    setSmashed(0);
    setCombo(1);
    setRage(0);
    setRageMode(false);
    setImpacts([]);
    setNumberEffects([]);
    setDebris([]);
    setBanner('');
    setGameOver(false);
    setNewBest(false);
  }, []);

  const startChallenge = useCallback(() => {
    resetGame();
    setMode('challenge');
    challengeEndsAt.current = performance.now() + CHALLENGE_DURATION;
    setTimeLeft(CHALLENGE_DURATION);
    showBanner('60 SECONDS');
  }, [resetGame, showBanner]);

  const startFreePlay = useCallback(() => {
    resetGame();
    setMode('free');
  }, [resetGame]);

  const restart = mode === 'challenge' ? startChallenge : startFreePlay;

  const handleObjectHit = useCallback((event: React.PointerEvent<HTMLDivElement>, objectId: number) => {
    event.preventDefault();
    if (gameOver) return;
    const object = objects.find((item) => item.id === objectId);
    if (!object || object.destroying) return;
    const now = performance.now();
    if (!rageMode && now < cooldownUntil.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const strong = currentTool.strong.includes(object.material);
    const damage = rageMode ? object.currentHp : currentTool.damage * (strong ? 2 : 1);
    const remainingHp = object.currentHp - damage;
    const destroyed = remainingHp <= 0;
    const nextCombo = destroyed ? Math.min(combo + 1, 12) : combo;
    const gained = Math.round(object.points * currentTool.multiplier * nextCombo * (rageMode ? 2 : 1));
    const impactWord = destroyed ? (rageMode ? 'OBLITERATED!' : currentTool.word) : strong ? 'CRITICAL!' : 'HIT!';

    lastHitAt.current = now;
    if (!rageMode && currentTool.cooldown > 0) {
      cooldownUntil.current = now + currentTool.cooldown;
      setCooldownKey((value) => value + 1);
    }

    playSound(object.material, destroyed, tool);
    addImpact(centerX, centerY, rageMode ? '#ff2a2a' : currentTool.color, impactWord, destroyed || strong);
    addNumber(centerX, centerY - 4, destroyed ? `+${gained}` : `-${damage}`, destroyed ? 'score' : 'damage');
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(destroyed ? 35 : 15);
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 300);

    if (!rageMode) {
      const nextRage = Math.min(100, rage + (destroyed ? 10 : 3));
      setRage(nextRage);
      if (nextRage >= 100) {
        setRageMode(true);
        rageEndsAt.current = now + RAGE_DURATION;
        showBanner('RAGE MODE');
      }
    }

    if (destroyed) {
      setObjects((items) => items.map((item) => item.id === objectId ? { ...item, currentHp: 0, destroying: true } : item));
      setScore((value) => value + gained);
      setSmashed((value) => value + 1);
      addDebris(object, centerX, centerY);
      if (nextCombo >= 3 && nextCombo % 2 === 1 && !rageMode) {
        showBanner(nextCombo >= 7 ? 'UNHINGED' : nextCombo >= 5 ? 'ON A ROLL' : 'KEEP GOING');
      }
      setCombo(nextCombo);
      if (comboTimer.current) clearTimeout(comboTimer.current);
      comboTimer.current = setTimeout(() => setCombo(1), 1650);
      const respawn = setTimeout(() => {
        respawnTimers.current.delete(respawn);
        setObjects((items) => items.filter((item) => item.id !== objectId));
        spawnStuff(1);
      }, 280);
      respawnTimers.current.add(respawn);
    } else {
      setObjects((items) => items.map((item) => item.id === objectId ? { ...item, currentHp: remainingHp } : item));
    }
  }, [addDebris, addImpact, addNumber, combo, currentTool, gameOver, objects, playSound, rage, rageMode, showBanner, spawnStuff, tool]);

  // One ticker drives the rage countdown, idle rage drain, and the challenge clock.
  useEffect(() => {
    const ticker = setInterval(() => {
      const now = performance.now();
      if (rageMode) {
        const remaining = rageEndsAt.current - now;
        if (remaining <= 0) {
          setRageMode(false);
          setRage(0);
        } else {
          setRage(Math.ceil((remaining / RAGE_DURATION) * 100));
        }
      } else if (now - lastHitAt.current > RAGE_DRAIN_DELAY) {
        setRage((value) => Math.max(0, value - 1));
      }

      if (mode === 'challenge' && !gameOver) {
        const remaining = Math.max(0, challengeEndsAt.current - now);
        setTimeLeft(remaining);
        if (remaining === 0) {
          setGameOver(true);
          setRageMode(false);
        }
      }
    }, 100);
    return () => clearInterval(ticker);
  }, [gameOver, mode, rageMode]);

  // Record a new best once the challenge ends.
  useEffect(() => {
    if (!gameOver || score <= bestScore) return;
    setBestScore(score);
    setNewBest(true);
    saveBestScore(score);
  }, [bestScore, gameOver, score]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '1') setTool('hammer');
      else if (event.key === '2') setTool('bat');
      else if (event.key === '3') setTool('axe');
      else if (event.key === 'r' || event.key === 'R') restart();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [restart]);

  useEffect(() => () => {
    if (comboTimer.current) clearTimeout(comboTimer.current);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    respawnTimers.current.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <main className={`rage-room ${rageMode ? 'raging' : ''}`}>
      <div className="room-backdrop" aria-hidden="true">
        <span className="wall-scar scar-one" />
        <span className="wall-scar scar-two" />
      </div>

      <header className="top-bar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Zap size={20} strokeWidth={3} /></div>
          <div className="brand-copy">
            <div className="brand-name">Rage Room</div>
            <div className="brand-kicker">controlled destruction / session 01</div>
          </div>
        </div>
        <div className="top-controls">
          <button
            type="button"
            className="mute-control"
            onClick={mode === 'challenge' ? startFreePlay : startChallenge}
            data-testid="button-toggle-mode"
          >
            {mode === 'challenge' ? <Sparkles size={16} /> : <Timer size={16} />}
            <span className="mute-label">{mode === 'challenge' ? 'Free play' : '60s challenge'}</span>
          </button>
          <button
            type="button"
            className="mute-control"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
            aria-pressed={muted}
            data-testid="button-toggle-sound"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span className="mute-label">{muted ? 'Sound off' : 'Sound on'}</span>
          </button>
        </div>
      </header>

      <section className="hud-strip" aria-label="Game statistics">
        <div className="hud-cell">
          <span className="hud-label">Score</span>
          <strong className="hud-value hot" data-testid="text-score">{score.toLocaleString()}</strong>
        </div>
        {mode === 'challenge' ? (
          <div className="hud-cell">
            <span className="hud-label">Time</span>
            <strong className={`hud-value ${timeLeft <= 10000 ? 'urgent' : ''}`} data-testid="text-time">{Math.ceil(timeLeft / 1000)}s</strong>
          </div>
        ) : (
          <div className="hud-cell">
            <span className="hud-label">Smashed</span>
            <strong className="hud-value" data-testid="text-smashed">{smashed}</strong>
          </div>
        )}
        <div className="hud-cell">
          <span className="hud-label">Combo</span>
          <strong className="hud-value hot" data-testid="text-combo">x{combo}</strong>
        </div>
      </section>

      <section className={`arena ${shaking ? 'shake' : ''}`} aria-label="Breakable objects arena">
        {objects.map((object) => (
          <div
            key={object.id}
            className={`object ${object.destroying ? 'dying' : ''}`}
            style={{
              left: `${object.x}%`,
              top: `${object.y}%`,
              width: `clamp(${Math.round(object.width * .58)}px, ${object.width / 10}vw, ${object.width}px)`,
              height: `clamp(${Math.round(object.height * .58)}px, ${object.height / 8.2}vw, ${object.height}px)`,
            }}
            onPointerDown={(event) => handleObjectHit(event, object.id)}
            role="button"
            tabIndex={0}
            aria-label={`Smash ${object.label}`}
            data-testid={`button-object-${object.id}`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.currentTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
              }
            }}
          >
            <ObjectArt object={object} />
            <div className={`crack-overlay ${object.currentHp < object.hp ? 'visible' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">{buildCracks(object.id)}</svg>
            </div>
            <div className="object-hp" aria-label={`${object.currentHp} hits remaining`}>
              <div className="object-hp-fill" style={{ width: `${Math.max(0, object.currentHp / object.hp) * 100}%` }} />
            </div>
            <span className={`object-label ${currentTool.strong.includes(object.material) ? 'weak' : ''}`}>{object.label}</span>
          </div>
        ))}
      </section>

      {impacts.map((impact) => (
        <div key={impact.id} className="impact" style={{ left: impact.x, top: impact.y, '--impact': impact.color } as React.CSSProperties} aria-hidden="true">
          <span className="impact-flare" />
          <span className="impact-ring" />
          <span className="impact-ring second" />
          <span className="impact-word">{impact.word}</span>
        </div>
      ))}
      {numberEffects.map((effect) => (
        <div key={effect.id} className={effect.kind === 'score' ? 'score-pop' : 'damage-pop'} style={{ left: effect.x, top: effect.y }} aria-hidden="true">{effect.value}</div>
      ))}
      {debris.map((piece) => (
        <span
          key={piece.id}
          className="debris"
          style={{
            left: piece.x,
            top: piece.y,
            '--shard': piece.color,
            '--dx': `${piece.dx}px`,
            '--dy': `${piece.dy}px`,
            '--rotation': `${piece.rotation}deg`,
            '--duration': `${piece.duration}ms`,
          } as React.CSSProperties}
          aria-hidden="true"
        />
      ))}

      <div className={`combo-banner ${banner ? 'pop' : ''}`} key={bannerKey} data-testid="status-combo-banner">{banner}</div>

      <aside className="rage-panel" aria-label="Rage meter">
        <div className="rage-head">
          <span className="rage-title">{rageMode ? 'Rage mode' : 'Rage meter'}</span>
          <span className="rage-percent" data-testid="text-rage">{rage}%</span>
        </div>
        <div className="rage-track"><div className="rage-fill" style={{ width: `${rage}%` }} /></div>
        <div className="rage-hint">
          {rageMode ? 'one-hit kills · double points' : rage >= 80 ? 'pressure release imminent' : 'break things to build pressure'}
        </div>
      </aside>

      <nav className="tool-dock" aria-label="Destruction tools">
        {(Object.keys(TOOL_CONFIG) as ToolName[]).map((toolName, index) => {
          const config = TOOL_CONFIG[toolName];
          const Icon = config.icon;
          return (
            <button
              key={toolName}
              type="button"
              className={`tool-button ${tool === toolName ? 'active' : ''}`}
              onClick={() => setTool(toolName)}
              aria-pressed={tool === toolName}
              title={`${toolName} (${index + 1}) — strong vs ${config.strongLabel}`}
              data-testid={`button-tool-${toolName}`}
            >
              <span className="tool-icon"><Icon size={15} /></span>
              <span className="tool-text">
                <span>{toolName}</span>
                <span className="tool-meta">{config.strongLabel}</span>
              </span>
              {config.cooldown > 0 && tool === toolName && cooldownKey > 0 && !rageMode && (
                <span
                  key={cooldownKey}
                  className="tool-cooldown"
                  style={{ '--cooldown': `${config.cooldown}ms` } as React.CSSProperties}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
        <button type="button" className="spawn-button" onClick={() => spawnStuff(2)} data-testid="button-spawn">
          <Plus size={15} />
          <span>More stuff</span>
        </button>
      </nav>

      <div className="instruction" aria-live="polite">
        <strong><Sparkles size={11} /> {objectCountText}</strong>
        match tool to material<br />
        fill rage for rage mode
      </div>

      <button type="button" className="reset-control" onClick={restart} data-testid="button-reset" style={{ position: 'fixed', right: 25, bottom: 25, zIndex: 46 }}>
        <RotateCcw size={14} />
        Reset room
      </button>

      {gameOver && (
        <div className="game-over" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
          <div className="game-over-card">
            <div className="game-over-kicker">time's up</div>
            <h2 id="game-over-title" className="game-over-score" data-testid="text-final-score">{score.toLocaleString()}</h2>
            {newBest && <div className="game-over-best-tag">New best</div>}
            <dl className="game-over-stats">
              <div><dt>Smashed</dt><dd>{smashed}</dd></div>
              <div><dt>Best</dt><dd>{bestScore.toLocaleString()}</dd></div>
            </dl>
            <div className="game-over-actions">
              <button type="button" className="tool-button active" onClick={startChallenge} data-testid="button-play-again" autoFocus>
                <RotateCcw size={14} /> Play again
              </button>
              <button type="button" className="spawn-button" onClick={startFreePlay} data-testid="button-free-play">
                <Sparkles size={14} /> Free play
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;