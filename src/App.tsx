import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Zap, Trophy, RefreshCw, Globe, Info } from 'lucide-react';
import { GameState, Point, Missile, Enemy, Explosion, City, Silo, TRANSLATIONS } from './types';

const TARGET_SCORE = 800;
const INITIAL_AMMO = [25, 50, 25];
const EXPLOSION_RADIUS = 45;
const EXPLOSION_DURATION = 1000;
const ENEMY_RADIUS = 3;
const MISSILE_RADIUS = 2;

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [combo, setCombo] = useState(0);
  const [lastComboTime, setLastComboTime] = useState(0);
  const [showCombo, setShowCombo] = useState(false);

  // Refs for game loop to avoid stale closures
  const gameStateRef = useRef<GameState>(GameState.MENU);
  const scoreRef = useRef(0);
  const roundRef = useRef(1);
  const comboRef = useRef(0);
  const lastComboTimeRef = useRef(0);

  // Sync refs with state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { lastComboTimeRef.current = lastComboTime; }, [lastComboTime]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Game Entities
  const enemiesRef = useRef<Enemy[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const silosRef = useRef<Silo[]>([]);
  const floatingScoresRef = useRef<{id: string, x: number, y: number, text: string, life: number}[]>([]);
  
  const t = TRANSLATIONS[lang];

  const initGame = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Initialize Silos
    const siloPositions = [width * 0.1, width * 0.5, width * 0.9];
    silosRef.current = siloPositions.map((x, i) => ({
      id: `silo-${i}`,
      x,
      y: height - 40,
      ammo: INITIAL_AMMO[i],
      maxAmmo: INITIAL_AMMO[i]
    }));

    // Initialize Cities
    const cityPositions = [
      width * 0.25, width * 0.35, 
      width * 0.65, width * 0.75, width * 0.85
    ];
    citiesRef.current = cityPositions.map((x, i) => ({
      id: `city-${i}`,
      x,
      y: height - 30,
      alive: true
    }));

    enemiesRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    floatingScoresRef.current = [];
    
    setScore(0);
    scoreRef.current = 0;
    setRound(1);
    roundRef.current = 1;
    setCombo(0);
    comboRef.current = 0;
  }, []);

  const spawnEnemy = useCallback(() => {
    const width = window.innerWidth;
    const x = Math.random() * width;
    const targetCity = citiesRef.current.filter(c => c.alive);
    const targetSilo = silosRef.current;
    const allTargets = [...targetCity, ...targetSilo];
    
    if (allTargets.length === 0) return;
    
    const target = allTargets[Math.floor(Math.random() * allTargets.length)];
    
    const speed = 0.5 + (roundRef.current * 0.15); // Use ref
    
    enemiesRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y: -20,
      startX: x,
      startY: -20,
      targetX: target.x,
      targetY: target.y,
      speed,
      radius: ENEMY_RADIUS,
      color: '#ef4444'
    });
  }, []); // roundRef is used instead of round state

  const fireMissile = (targetX: number, targetY: number) => {
    if (gameStateRef.current !== GameState.PLAYING) return;

    // Find closest silo with ammo
    let bestSilo: Silo | null = null;
    let minDist = Infinity;

    silosRef.current.forEach(silo => {
      if (silo.ammo > 0) {
        const dist = Math.abs(silo.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestSilo = silo;
        }
      }
    });

    if (bestSilo) {
      const silo = bestSilo as Silo;
      silo.ammo--;
      
      missilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: silo.x,
        y: silo.y,
        startX: silo.x,
        startY: silo.y,
        targetX,
        targetY,
        speed: 6, // Slightly faster
        radius: MISSILE_RADIUS,
        color: '#3b82f6',
        progress: 0
      });
    }
  };

  const createExplosion = (x: number, y: number) => {
    explosionsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      radius: 0,
      maxRadius: EXPLOSION_RADIUS,
      duration: EXPLOSION_DURATION,
      elapsed: 0
    });
  };

  const addFloatingScore = (x: number, y: number, text: string) => {
    floatingScoresRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      text,
      life: 1.0
    });
  };

  const update = (dt: number) => {
    if (gameStateRef.current !== GameState.PLAYING) return;

    // Update Enemies
    enemiesRef.current.forEach((enemy, index) => {
      const dx = enemy.targetX! - enemy.startX;
      const dy = enemy.targetY! - enemy.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vx = (dx / dist) * enemy.speed;
      const vy = (dy / dist) * enemy.speed;

      enemy.x += vx;
      enemy.y += vy;

      // Check collision with cities/silos
      if (enemy.y >= enemy.targetY!) {
        // Hit target
        const city = citiesRef.current.find(c => Math.abs(c.x - enemy.x) < 20 && c.alive);
        if (city) {
          city.alive = false;
          createExplosion(city.x, city.y);
          // Check game over
          if (citiesRef.current.every(c => !c.alive)) {
            setGameState(GameState.GAME_OVER);
          }
        } else {
          createExplosion(enemy.x, enemy.y);
        }
        enemiesRef.current.splice(index, 1);
      }
    });

    // Update Missiles
    missilesRef.current.forEach((missile, index) => {
      const dx = missile.targetX! - missile.startX;
      const dy = missile.targetY! - missile.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const moveDist = missile.speed;
      const currentDist = Math.sqrt(Math.pow(missile.x - missile.startX, 2) + Math.pow(missile.y - missile.startY, 2));
      
      if (currentDist >= dist) {
        createExplosion(missile.targetX!, missile.targetY!);
        missilesRef.current.splice(index, 1);
      } else {
        const vx = (dx / dist) * moveDist;
        const vy = (dy / dist) * moveDist;
        missile.x += vx;
        missile.y += vy;
      }
    });

    // Update Explosions
    explosionsRef.current.forEach((exp, index) => {
      exp.elapsed += dt;
      const p = exp.elapsed / exp.duration;
      if (p >= 1) {
        explosionsRef.current.splice(index, 1);
      } else {
        // Simple sin curve for radius
        exp.radius = Math.sin(p * Math.PI) * exp.maxRadius;

        // Check collision with enemies
        enemiesRef.current.forEach((enemy, eIdx) => {
          const dx = enemy.x - exp.x;
          const dy = enemy.y - exp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < exp.radius + enemy.radius) {
            // Enemy destroyed!
            let points = 20;
            const now = Date.now();
            
            // Combo logic
            if (now - lastComboTimeRef.current < 1500) {
              const newCombo = comboRef.current + 1;
              comboRef.current = newCombo;
              setCombo(newCombo);
              if (newCombo >= 2) {
                points += 30;
                setShowCombo(true);
                setTimeout(() => setShowCombo(false), 1000);
              }
            } else {
              comboRef.current = 1;
              setCombo(1);
            }
            lastComboTimeRef.current = now;
            setLastComboTime(now);
            
            const newScore = scoreRef.current + points;
            scoreRef.current = newScore;
            setScore(newScore);
            
            addFloatingScore(enemy.x, enemy.y, `+${points}`);
            createExplosion(enemy.x, enemy.y);
            enemiesRef.current.splice(eIdx, 1);
          }
        });
      }
    });

    // Update Floating Scores
    floatingScoresRef.current.forEach((fs, index) => {
      fs.y -= 1;
      fs.life -= 0.02;
      if (fs.life <= 0) {
        floatingScoresRef.current.splice(index, 1);
      }
    });

    // Spawn Logic
    if (Math.random() < 0.01 + (roundRef.current * 0.005)) {
      spawnEnemy();
    }

    // Round End Check
    if (scoreRef.current >= TARGET_SCORE) {
      setGameState(GameState.WIN);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw Pink Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#fdf2f8'); // pink-50
    bgGrad.addColorStop(1, '#fce7f3'); // pink-100
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw stylized plum blossoms (simple shapes for "3D" feel)
    ctx.save();
    ctx.globalAlpha = 0.3;
    const drawBlossom = (x: number, y: number, size: number) => {
      ctx.fillStyle = '#f472b6'; // pink-400
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const angle = (i * 2 * Math.PI) / 5;
        ctx.arc(x + Math.cos(angle) * size * 0.6, y + Math.sin(angle) * size * 0.6, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fbcfe8'; // pink-200
      ctx.beginPath();
      ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    };
    
    // Static background pattern
    drawBlossom(width * 0.2, height * 0.3, 40);
    drawBlossom(width * 0.8, height * 0.15, 60);
    drawBlossom(width * 0.5, height * 0.6, 30);
    drawBlossom(width * 0.1, height * 0.8, 50);
    drawBlossom(width * 0.9, height * 0.5, 35);
    ctx.restore();

    // Draw Ground
    ctx.fillStyle = '#f9a8d4'; // pink-300
    ctx.fillRect(0, height - 40, width, 40);

    // Draw Cities
    citiesRef.current.forEach(city => {
      if (city.alive) {
        ctx.fillStyle = '#db2777'; // pink-600
        ctx.beginPath();
        ctx.roundRect(city.x - 15, city.y - 15, 30, 15, 4);
        ctx.fill();
        // Windows
        ctx.fillStyle = '#fff';
        ctx.fillRect(city.x - 10, city.y - 10, 4, 4);
        ctx.fillRect(city.x + 6, city.y - 10, 4, 4);
      } else {
        ctx.fillStyle = '#9d174d'; // pink-800
        ctx.beginPath();
        ctx.arc(city.x, city.y, 10, 0, Math.PI, true);
        ctx.fill();
      }
    });

    // Draw Silos
    silosRef.current.forEach(silo => {
      ctx.fillStyle = '#be185d'; // pink-700
      ctx.beginPath();
      ctx.moveTo(silo.x - 20, silo.y);
      ctx.lineTo(silo.x, silo.y - 25);
      ctx.lineTo(silo.x + 20, silo.y);
      ctx.fill();
      
      // Ammo indicator
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(silo.ammo.toString(), silo.x, silo.y + 15);
    });

    // Draw Enemies
    enemiesRef.current.forEach(enemy => {
      // Trail
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(190, 24, 93, 0.3)';
      ctx.lineWidth = 1;
      ctx.moveTo(enemy.startX, enemy.startY);
      ctx.lineTo(enemy.x, enemy.y);
      ctx.stroke();

      // Rocket
      ctx.fillStyle = '#9d174d';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Missiles
    missilesRef.current.forEach(missile => {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(219, 39, 119, 0.5)';
      ctx.lineWidth = 2;
      ctx.moveTo(missile.startX, missile.startY);
      ctx.lineTo(missile.x, missile.y);
      ctx.stroke();

      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, missile.radius, 0, Math.PI * 2);
      ctx.fill();

      // Target X
      ctx.strokeStyle = '#db2777';
      ctx.lineWidth = 1;
      const s = 5;
      ctx.beginPath();
      ctx.moveTo(missile.targetX! - s, missile.targetY! - s);
      ctx.lineTo(missile.targetX! + s, missile.targetY! + s);
      ctx.moveTo(missile.targetX! + s, missile.targetY! - s);
      ctx.lineTo(missile.targetX! - s, missile.targetY! + s);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const grad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(0.4, 'rgba(251, 207, 232, 0.7)'); // pink-200
      grad.addColorStop(1, 'rgba(219, 39, 119, 0)'); // pink-600
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Floating Scores
    floatingScoresRef.current.forEach(fs => {
      ctx.fillStyle = `rgba(157, 23, 77, ${fs.life})`; // pink-800
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fs.text, fs.x, fs.y);
    });
  };

  const loop = (time: number) => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        update(16); // Approx 60fps
        draw(ctx);
      }
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        initGame();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [initGame]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    
    // Don't fire too low (ground is at height - 40)
    if (y < window.innerHeight - 45) {
      fireMissile(x, y);
    }
  };

  const startGame = () => {
    initGame();
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-pink-50 font-sans">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseDown={handleCanvasClick}
        onTouchStart={handleCanvasClick}
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="glass-panel bg-white/40 border-pink-200 px-4 py-2 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-pink-600" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-pink-800/60">{t.score}</span>
              <span className="text-xl font-bold font-mono leading-none text-pink-900">{score}</span>
            </div>
          </div>
          <div className="glass-panel bg-white/40 border-pink-200 px-4 py-2 flex items-center gap-3">
            <Shield className="w-5 h-5 text-pink-600" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-pink-800/60">{t.targetScore}</span>
              <span className="text-xl font-bold font-mono leading-none text-pink-900">{TARGET_SCORE}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="glass-panel bg-white/40 border-pink-200 p-2 hover:bg-white/60 transition-colors text-pink-900"
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Combo Alert */}
      <AnimatePresence>
        {showCombo && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1.2, opacity: 1, y: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <span className="text-4xl font-black italic text-pink-600 drop-shadow-[0_0_10px_rgba(219,39,119,0.3)]">
              {t.combo}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menus */}
      <AnimatePresence>
        {gameState === GameState.MENU && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-pink-50/80 backdrop-blur-sm"
          >
            <div className="max-w-md w-full p-8 text-center">
              <motion.h1 
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="text-6xl font-black mb-4 bg-gradient-to-b from-pink-600 to-pink-900 bg-clip-text text-transparent"
              >
                {t.title}
              </motion.h1>
              <p className="text-pink-800/70 mb-8 flex items-center justify-center gap-2 font-medium">
                <Info className="w-4 h-4" />
                {t.instructions}
              </p>
              <button 
                onClick={startGame}
                className="group relative px-10 py-5 bg-pink-600 text-white font-bold rounded-full overflow-hidden shadow-lg shadow-pink-200 transition-all hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2 text-lg">
                  <Zap className="w-6 h-6 fill-current" />
                  {t.start}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </motion.div>
        )}

        {(gameState === GameState.GAME_OVER || gameState === GameState.WIN) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-pink-50/90 backdrop-blur-md"
          >
            <div className="glass-panel bg-white/60 border-pink-200 p-12 text-center max-w-sm w-full shadow-2xl shadow-pink-100">
              <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${gameState === GameState.WIN ? 'bg-pink-500/20 text-pink-600' : 'bg-rose-500/20 text-rose-600'}`}>
                {gameState === GameState.WIN ? <Trophy className="w-10 h-10" /> : <RefreshCw className="w-10 h-10" />}
              </div>
              <h2 className="text-3xl font-bold mb-2 text-pink-900">
                {gameState === GameState.WIN ? t.victory : t.gameOver}
              </h2>
              <div className="mb-8">
                <div className="text-sm text-pink-800/60 uppercase tracking-widest mb-1 font-bold">{t.score}</div>
                <div className="text-6xl font-black font-mono text-pink-900">{score}</div>
              </div>
              <button 
                onClick={startGame}
                className="w-full py-4 bg-pink-600 text-white font-bold rounded-2xl hover:bg-pink-700 shadow-lg shadow-pink-200 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                {gameState === GameState.WIN ? t.playAgain : t.restart}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-pink-800/40 uppercase tracking-[0.2em] font-bold pointer-events-none">
        Touch to Intercept
      </div>
    </div>
  );
}
