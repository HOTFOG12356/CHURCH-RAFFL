import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import churchLogo from '@/imports/IRM-logo-2023-2__2_.png'

type TicketEntry = { code: string; name: string }
// A winner remembers which round and prize it was drawn for, so the card and
// the history both read back correctly after the draw advances.
type Winner = { code: string; name: string; prize: string; round: number }
type View = 'dashboard' | 'register' | 'draw'
type DrawState = 'idle' | 'spinning' | 'slowing' | 'winner'

// ─────────────────────────────────────────────────────────────────────────────
// Theme — two palettes the user can switch between. The active theme is held
// in App state and passed down, so every view re-colours from one source.
// ─────────────────────────────────────────────────────────────────────────────
type ThemeName = 'pink' | 'yellow'
type Theme = {
  hot: string
  light: string
  soft: string
  deep: string
  violet: string
  mint: string
  cream: string
}
const THEMES: Record<ThemeName, Theme> = {
  pink: {
    hot:    '#FF5FA2',
    light:  '#FF9EC7',
    soft:   '#FFC2DC',
    deep:   '#C2185B',
    violet: '#B46EFF',
    mint:   '#7EE8D0',
    cream:  '#FFE9C7',
  },
  yellow: {
    hot:    '#FFD93D',
    light:  '#FFF0A6',
    soft:   '#FFF3C4',
    deep:   '#E6A800',
    violet: '#FF9F1C',
    mint:   '#7EE8D0',
    cream:  '#FFE9C7',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Raffle event data
// ─────────────────────────────────────────────────────────────────────────────
const PRIZES = [
  { icon: '🌾', winners: 3, qty: '3 Winners', label: 'Grand Prize — 50 KG Rice', highlight: true },
  { icon: '🍚', winners: 5, qty: '5 Winners', label: '25 KG Rice', highlight: false },
  { icon: '🍚', winners: 10, qty: '10 Winners', label: '10 KG Rice', highlight: false },
  { icon: '🍚', winners: 10, qty: '10 Winners', label: '5 KG Rice', highlight: false },
  { icon: '🫖', winners: 5, qty: '5 Winners', label: 'Electric Kettle', highlight: false },
  { icon: '🍳', winners: 1, qty: '1 Winner', label: 'Rice Cooker', highlight: false },
  { icon: '🌀', winners: 5, qty: '5 Winners', label: 'Electric Fan', highlight: false },
]

const getPrizeRemaining = (label: string, winners: Winner[]) => {
  const prize = PRIZES.find(p => p.label === label)
  if (!prize) return 0
  return Math.max(0, prize.winners - winners.filter(w => w.prize === label).length)
}

const getNextAvailablePrize = (winners: Winner[], preferred: string | null = null) => {
  if (preferred && preferred !== '__none__' && getPrizeRemaining(preferred, winners) > 0) {
    return preferred
  }

  for (const prize of PRIZES) {
    if (getPrizeRemaining(prize.label, winners) > 0) {
      return prize.label
    }
  }

  return null
}

// Prizes flattened into one slot per winner, in draw order. Draw N hands out
// PRIZE_SCHEDULE[N - 1], so the grand prize is always drawn first.
const PRIZE_SCHEDULE: string[] = PRIZES.flatMap(p => Array(p.winners).fill(p.label))
const TOTAL_PRIZES = PRIZE_SCHEDULE.length

const TICKET_PRICE = 50

// The draw headline is split per letter so each one can catch the light in
// sequence — see .title-letter in index.css.
const TITLE_LETTERS = 'A Rice & Shine'.split('')
// The draw day shown on the dashboard hero and counted down to.
const DRAW_DATE = new Date('2026-10-04T18:00:00')

// ─────────────────────────────────────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const ms = Math.max(0, target.getTime() - now)
  return {
    done: ms === 0,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    mins: Math.floor(ms / 60_000) % 60,
    secs: Math.floor(ms / 1_000) % 60,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function Countdown({ compact }: { compact?: boolean }) {
  const { done, days, hours, mins, secs } = useCountdown(DRAW_DATE)
  const cells = [
    { value: compact ? days : pad(days), label: 'Days' },
    { value: pad(hours), label: 'Hrs' },
    { value: pad(mins), label: 'Min' },
    { value: pad(secs), label: 'Sec' },
  ]
  return (
    <div className="flex items-stretch gap-1.5">
      {cells.map(c => (
        <div key={c.label} className="flex flex-col items-center gap-1">
          <div className="digit-cell rounded-lg px-2.5 py-1.5 min-w-[2.6rem] text-center">
            <span className="font-mono text-lg font-bold text-white leading-none">{done ? '00' : c.value}</span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stars
// ─────────────────────────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: (i * 13.7) % 100,
    y: (i * 17.3) % 100,
    size: 1 + (i % 3) * 0.8,
    delay: (i % 5) * 0.9,
    dur: 2.5 + (i % 4) * 0.7,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {stars.map(s => (
        <div key={s.id} className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size,
            animation: `starTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Confetti — two waves for density
// ─────────────────────────────────────────────────────────────────────────────
function Confetti({ active, theme }: { active: boolean; theme: Theme }) {
  if (!active) return null
  const colors = [theme.hot, theme.light, theme.violet, theme.deep, '#ffffff', theme.mint, theme.hot, theme.soft, 'var(--t-light)']
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Chunky confetti */}
      {Array.from({ length: 140 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 7.13) % 100}%`,
          top: -24,
          width: 5 + (i % 6) * 2.8,
          height: 5 + (i % 6) * 2.8,
          borderRadius: i % 4 === 0 ? '50%' : i % 4 === 1 ? '2px' : i % 4 === 2 ? '0' : '40%',
          background: colors[i % colors.length],
          opacity: 0,
          animation: `confettiFall ${1.8 + (i % 8) * 0.35}s ease-in ${(i % 12) * 0.18}s forwards`,
          transform: `rotate(${(i * 53) % 360}deg)`,
        }} />
      ))}
      {/* Long twisting ribbons, for movement the square confetti can't give */}
      {Array.from({ length: 26 }).map((_, i) => (
        <div key={`r${i}`} style={{
          position: 'absolute',
          left: `${(i * 15.7) % 100}%`,
          top: -60,
          width: 4,
          height: 34 + (i % 5) * 12,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${colors[i % colors.length]}, transparent)`,
          opacity: 0,
          animation: `ribbonFall ${2.4 + (i % 6) * 0.4}s ease-in ${(i * 0.11) % 1.4}s forwards`,
        }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal FX — rays, sparks and halo behind the winning name
// ─────────────────────────────────────────────────────────────────────────────
function RevealFx({ active, theme }: { active: boolean; theme: Theme }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
      {/* Radial light rays from the centre */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={`ray${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '46%',
            width: 3,
            height: 130,
            marginLeft: -1.5,
            transformOrigin: 'top center',
            background: 'linear-gradient(180deg, color-mix(in srgb, var(--t-light) 90%, transparent), transparent)',
            ['--a' as string]: `${i * (360 / 14)}deg`,
            animation: `raySweep ${2.2 + (i % 5) * 0.35}s ease-in ${(i * 0.13) % 1.2}s infinite`,
          }} />
      ))}
      {/* Sparks shooting outward */}
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={`sp${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '44%',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: i % 3 === 0 ? theme.mint : i % 3 === 1 ? theme.soft : theme.light,
            boxShadow: '0 0 8px color-mix(in srgb, var(--t-light) 80%, transparent)',
            ['--dx' as string]: `${(Math.cos(i * 1.7) * (140 + (i % 5) * 60)).toFixed(0)}px`,
            ['--dy' as string]: `${(Math.sin(i * 1.7) * (110 + (i % 4) * 55)).toFixed(0)}px`,
            animation: `sparkOut ${1.1 + (i % 4) * 0.3}s ease-out ${(i * 0.08) % 1}s infinite`,
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen flash overlay
// ─────────────────────────────────────────────────────────────────────────────
function ScreenFlash({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="fixed inset-0 pointer-events-none z-40"
      style={{ background: 'white', animation: 'flashIn 0.6s ease-out forwards' }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shockwave rings
// ─────────────────────────────────────────────────────────────────────────────
function Shockwaves({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      {[0, 0.2, 0.45, 0.72].map((delay, i) => (
        <div key={i} className="absolute rounded-full border-2"
          style={{
            width: 80, height: 80,
            borderColor: i % 2 === 0 ? 'color-mix(in srgb, var(--t-hot) 85%, transparent)' : 'color-mix(in srgb, var(--t-violet) 75%, transparent)',
            animation: `shockwave 1.4s ease-out ${delay}s forwards`,
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Spotlight beams
// ─────────────────────────────────────────────────────────────────────────────
function Spotlights({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {[0, 1, 2].map(i => (
        <div key={i} className="absolute"
          style={{
            top: 0,
            left: `${20 + i * 30}%`,
            width: 120,
            height: '100%',
            background: `linear-gradient(to bottom, ${['color-mix(in srgb, var(--t-hot) 14%, transparent)', 'color-mix(in srgb, var(--t-mint) 12%, transparent)', 'color-mix(in srgb, var(--t-violet) 12%, transparent)'][i]}, transparent 70%)`,
            transformOrigin: 'top center',
            animation: `spotSweep ${4 + i * 1.5}s ease-in-out ${i * 1.2}s infinite`,
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightning bolts during peak spin
// ─────────────────────────────────────────────────────────────────────────────
function Lightning({ active, theme }: { active: boolean; theme: Theme }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {[15, 75].map((left, i) => (
        <div key={i} className="absolute top-0"
          style={{
            left: `${left}%`,
            width: 2,
            height: '45%',
            background: `linear-gradient(to bottom, ${i === 0 ? theme.hot : theme.mint}, transparent)`,
            borderRadius: 1,
            transformOrigin: 'top',
            animation: `zapIn 0.9s ease-in-out ${i * 0.35}s infinite`,
            filter: 'blur(1px)',
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating orbs
// ─────────────────────────────────────────────────────────────────────────────
function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, var(--t-hot), transparent 70%)', animation: 'floatBob 8s ease-in-out infinite' }} />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, var(--t-violet), transparent 70%)', animation: 'floatBob 10s ease-in-out 2s infinite' }} />
      <div className="absolute -bottom-32 left-1/4 w-80 h-80 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, var(--t-mint), transparent 70%)', animation: 'floatBob 7s ease-in-out 1s infinite' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingParticles — slow-drifting dots that add depth to the background
// ─────────────────────────────────────────────────────────────────────────────
function FloatingParticles({ theme }: { theme: Theme }) {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (i * 5.3) % 100,
    y: (i * 7.7) % 100,
    size: 2 + (i % 3),
    delay: (i * 0.7) % 8,
    dur: 12 + (i % 5) * 3,
    opacity: 0.2 + (i % 3) * 0.1,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.id % 3 === 0 ? theme.hot : p.id % 3 === 1 ? theme.violet : theme.mint,
            opacity: p.opacity,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RisingBubbles — soft translucent circles that drift upward
// ─────────────────────────────────────────────────────────────────────────────
function RisingBubbles({ theme }: { theme: Theme }) {
  const bubbles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (i * 8.3) % 100,
    size: 4 + (i % 4) * 3,
    delay: (i * 1.3) % 10,
    dur: 14 + (i % 4) * 4,
    opacity: 0.08 + (i % 3) * 0.04,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {bubbles.map(b => (
        <div key={b.id} className="bubble"
          style={{
            left: `${b.x}%`,
            bottom: '-20px',
            width: b.size,
            height: b.size,
            background: 'radial-gradient(circle, color-mix(in srgb, var(--t-light) 40%, transparent), transparent)',
            opacity: b.opacity,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Atmosphere — layered gradient field + centre bloom + vignette + film grain.
// Painted under everything, so it replaces a flat background colour with real
// depth. The colour fields are deliberately over-blurred and very wide: the
// blur is what makes them read as light in air rather than as tinted circles,
// and anything tighter shows a visible edge once it scales down.
// ─────────────────────────────────────────────────────────────────────────────
function Atmosphere() {
  return (
    <>
      <div className="atmosphere" aria-hidden="true">
        {/* Wide, heavily blurred colour fields in the corners */}
        <div className="absolute -top-[24%] -left-[6%] w-[64vw] h-[64vw] rounded-full blur-[140px] opacity-40"
          style={{ background: 'radial-gradient(circle,#1d4d38,transparent 70%)', animation: 'auroraA 26s ease-in-out infinite' }} />
        <div className="absolute top-[22%] -right-[14%] w-[58vw] h-[58vw] rounded-full blur-[150px] opacity-35"
          style={{ background: 'radial-gradient(circle,#22406e,transparent 70%)', animation: 'auroraB 32s ease-in-out infinite' }} />
        <div className="absolute bottom-[-20%] left-[24%] w-[52vw] h-[52vw] rounded-full blur-[160px] opacity-25"
          style={{ background: 'radial-gradient(circle,#7a3d0e,transparent 70%)', animation: 'auroraA 38s ease-in-out 4s infinite reverse' }} />

        {/* Centre bloom — one very large, very soft theme-tinted glow so the
            middle of the page has light in it instead of reading as flat black.
            Theme-driven, so it turns gold alongside the rest of the accents.
            `translate` (not Tailwind's -translate-x-1/2) centres these, leaving
            `transform` free for the scale animation to own. */}
        <div className="absolute left-1/2 top-1/2 w-[86vw] h-[86vw] max-w-[1100px] max-h-[1100px] rounded-full"
          style={{
            translate: '-50% -50%',
            background: 'radial-gradient(circle,color-mix(in srgb, var(--t-hot) 15%, transparent) 0%,color-mix(in srgb, var(--t-violet) 7%, transparent) 38%,transparent 68%)',
            filter: 'blur(90px)',
            animation: 'centreBloom 18s ease-in-out infinite',
          }} />

        {/* Tighter bloom layered on top of the wide one, for depth without
            another visible edge */}
        <div className="absolute left-1/2 top-1/2 w-[46vw] h-[46vw] max-w-[620px] max-h-[620px] rounded-full"
          style={{
            translate: '-50% -50%',
            background: 'radial-gradient(circle,color-mix(in srgb, var(--t-light) 9%, transparent) 0%,transparent 62%)',
            filter: 'blur(70px)',
            animation: 'centreBloom 13s ease-in-out 3s infinite reverse',
          }} />

        {/* Vignette, pinned above the colour fields but below the grain. Pulled
            back from the edges so it darkens the frame without crushing the
            centre bloom. */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 105% 85% at 50% 42%, transparent 45%, rgba(4,8,14,0.5) 100%)' }} />
      </div>
      <FloatingOrbs />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────────────
function Nav({ view, setView, ticketCount, theme }: { view: View; setView: (v: View) => void; ticketCount: number; theme: Theme }) {
  const tabs = [
    { v: 'dashboard' as View, icon: '🏠', label: 'Dashboard' },
    { v: 'register'  as View, icon: '📋', label: 'Register'  },
    { v: 'draw'      as View, icon: '🎲', label: 'Draw'      },
  ]
  return (
    <nav className="z-40 backdrop-blur-xl hairline-live"
      style={{ background: 'rgba(16,8,20,0.82)', borderBottom: '1px solid rgba(255,138,190,0.12)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <button onClick={() => setView('dashboard')} className="flex items-center gap-3 flex-shrink-0 cursor-pointer group">
          <span className="relative grid place-items-center w-10 h-10 rounded-xl"
            style={{ background: 'linear-gradient(150deg,color-mix(in srgb, var(--t-deep) 22%, transparent),color-mix(in srgb, var(--t-violet) 20%, transparent))', border: '1px solid color-mix(in srgb, var(--t-light) 30%, transparent)' }}>
            <img src={churchLogo} alt="Church" className="w-7 h-7 object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
          </span>
          <div className="hidden sm:block text-left">
            <div className="font-display font-bold text-white text-sm leading-tight">A Rice &amp; Shine</div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Church Raffle 2026</div>
          </div>
        </button>

        <div className="hidden lg:flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
          <span className="live-dot heartbeat" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Draw in</span>
          <Countdown compact />
        </div>

        <div className="flex-1" />
        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1 border border-white/10">
          {tabs.map(({ v, icon, label }) => (
            <button key={v} onClick={() => setView(v)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                view === v ? 'text-white shadow-inner' : 'text-white/40 hover:text-white/70'}`}>
              {view === v && (
                <span className="absolute inset-0 rounded-xl"
                  style={{ background: 'linear-gradient(135deg,color-mix(in srgb, var(--t-hot) 35%, transparent),color-mix(in srgb, var(--t-deep) 30%, transparent))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--t-light) 35%, transparent)' }} />
              )}
              <span className="relative">{icon}</span>
              <span className="relative hidden sm:inline">{label}</span>
              {v === 'register' && ticketCount > 0 && (
                <span className="relative font-mono text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full leading-none">{ticketCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────
function Footer({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <footer className="relative z-10 mt-16">
      <div className="rule-gold opacity-60" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <img src={churchLogo} alt="" className="w-8 h-8 object-contain opacity-80" />
            <span className="font-display font-bold text-white text-sm">A Rice &amp; Shine</span>
          </div>
          <p className="text-white/35 text-xs leading-relaxed max-w-xs">
            A community fundraiser by the church family. Every ticket you buy puts rice on a table this Christmas.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">Quick Links</p>
          <ul className="space-y-1.5">
            {(['dashboard', 'register', 'draw'] as View[]).map(v => (
              <li key={v}>
                <button onClick={() => onNavigate(v)} className="text-white/40 hover:text-white/80 text-xs transition-colors cursor-pointer capitalize">
                  {v === 'dashboard' ? 'Dashboard' : v === 'register' ? 'Register Tickets' : 'Run the Draw'}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Event Details</p>
          <ul className="space-y-1.5 font-mono text-[11px] text-white/40">
            <li>Sun, 04 Oct 2026 · 6:00 PM</li>
            <li>Church Fellowship Hall</li>
            <li>{TOTAL_PRIZES} prizes · ₱{TICKET_PRICE} per ticket</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-white/20 uppercase tracking-[0.2em]">Proceeds fund the church pantry &amp; outreach</p>
          <p className="font-mono text-[10px] text-white/20">✝ 2 Corinthians 9:7</p>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function DashboardView({
  entries,
  pastWinners,
  setView,
  theme,
  themeName,
  onToggleTheme,
}: {
  entries: TicketEntry[]
  pastWinners: Winner[]
  setView: (v: View) => void
  theme: Theme
  themeName: ThemeName
  onToggleTheme: () => void
}) {
  const raised = entries.length * TICKET_PRICE
  // Prizes handed out so far, capped per tier so the bar never reads over 100%.
  const wonByPrize = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of pastWinners) counts.set(w.prize, (counts.get(w.prize) ?? 0) + 1)
    return counts
  }, [pastWinners])

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10 view-enter">

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-8 text-center px-6 py-16 border border-white/10"
        style={{ background: 'linear-gradient(135deg,#1A3D2B 0%,#160d20 45%,#1B3A6B 100%)' }}>
        {/* rays */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[700px] opacity-[0.07]"
            style={{
              background: 'conic-gradient(from 0deg,transparent 0deg,var(--t-hot) 8deg,transparent 16deg,transparent 46deg,var(--t-hot) 54deg,transparent 62deg,transparent 96deg,var(--t-violet) 104deg,transparent 112deg,transparent 148deg,var(--t-deep) 156deg,transparent 164deg,transparent 196deg,var(--t-hot) 204deg,transparent 212deg,transparent 248deg,var(--t-hot) 256deg,transparent 264deg,transparent 300deg,var(--t-violet) 308deg,transparent 316deg,transparent 352deg,var(--t-deep) 360deg)',
              borderRadius: '50%',
              animation: 'rays 25s linear infinite',
            }}
          />
        </div>
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-52 h-52 rounded-full opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle,\,transparent 70%)', filter: 'blur(32px)' }} />

        <div className="relative icon-bounce" style={{ animation: 'floatBob 5s ease-in-out infinite' }}>
          <img src={churchLogo} alt="Church logo" className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-2xl" />
        </div>

        <div className="relative mb-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/30 mb-2">Community Church Fundraiser</p>
          <h1 className="font-display font-black text-white leading-none mb-1 text-pop"
            style={{ fontSize: 'clamp(1.8rem,4.5vw,3rem)' }}>
            A{' '}
            <span className="color-shift" style={{
              background: 'linear-gradient(90deg,var(--t-hot),var(--t-light),var(--t-hot))',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 2.5s linear infinite',
            }}>Rice</span>
            {' '}&amp;{' '}
            <span style={{
              background: 'linear-gradient(90deg,var(--t-hot),var(--t-light),var(--t-hot))',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 3s linear infinite',
            }}>Shine</span>
          </h1>
          <p className="font-display italic text-white/50 text-lg">Raffle Draw</p>
        </div>

        <p className="text-white/40 max-w-sm mx-auto text-sm mb-8 relative">
          Register your participants then run the animated draw. Every ticket supports our church community.
        </p>

        <div className="flex justify-center gap-3 flex-wrap relative">
          <button onClick={() => setView('register')}
            className="px-7 py-3 rounded-full text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg,var(--t-hot),var(--t-deep))', boxShadow: '0 6px 24px color-mix(in srgb, var(--t-hot) 33%, transparent)' }}>
            📋 Register Tickets
          </button>
          <button onClick={() => setView('draw')} disabled={entries.length === 0}
            className="px-7 py-3 rounded-full text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: entries.length > 0 ? 'linear-gradient(135deg,var(--t-hot),var(--t-deep))' : '#444', boxShadow: entries.length > 0 ? '0 6px 24px color-mix(in srgb, var(--t-hot) 40%, transparent)' : 'none', animation: entries.length > 0 ? 'pulse-ring 2.5s ease-in-out infinite' : undefined }}>
            🎲 Start the Draw
          </button>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="flex justify-center mb-6">
        <button onClick={onToggleTheme}
          className="flex items-center gap-3 px-5 py-2.5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <span className="flex gap-1.5">
            <span className="w-4 h-4 rounded-full cursor-pointer" style={{ background: '#FF5FA2', boxShadow: themeName === 'pink' ? '0 0 8px #FF5FA2' : 'none', border: themeName === 'pink' ? '2px solid white' : '2px solid transparent' }} />
            <span className="w-4 h-4 rounded-full cursor-pointer" style={{ background: '#FFD93D', boxShadow: themeName === 'yellow' ? '0 0 8px #FFD93D' : 'none', border: themeName === 'yellow' ? '2px solid white' : '2px solid transparent' }} />
          </span>
          <span className="font-mono text-xs text-white/60">{themeName === 'pink' ? 'Pink' : 'Yellow'} theme</span>
        </button>
      </div>

      {/* Countdown */}
      <div className="panel rounded-3xl px-6 py-6 mb-6 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        <div className="flex-1 text-center sm:text-left">
          <p className="eyebrow mb-1.5">Drawing starts in</p>
          <p className="font-display font-bold text-white text-xl leading-tight">Sunday, 04 October · 6:00 PM</p>
          <p className="font-mono text-[11px] text-white/35 mt-1">Church Fellowship Hall · doors open 5:00 PM</p>
        </div>
        <div className="hidden sm:block w-px self-stretch my-2"
          style={{ background: 'linear-gradient(180deg,transparent,rgba(255,255,255,0.14),transparent)' }} />
        <Countdown />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Tickets Sold', value: entries.length.toLocaleString(), sub: `${entries.length === 1 ? 'entry' : 'entries'} registered`, color: theme.mint, icon: '🎟' },
          { label: 'Funds Raised', value: `₱${raised.toLocaleString()}`, sub: `@ ₱${TICKET_PRICE} / ticket`, color: theme.light, icon: '💰' },
          { label: 'Prizes', value: `${wonByPrize.size > 0 ? pastWinners.length : 0}/${TOTAL_PRIZES}`, sub: 'drawn so far', color: theme.hot, icon: '🎁' },
          { label: 'Draw Date', value: 'Oct 4', sub: '2026 · 6:00 PM', color: '#7FA8DC', icon: '📅' },
        ].map((s, i) => (
          <div key={s.label} className="panel shine rounded-2xl px-4 py-5 text-center bounce-in"
            style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="w-9 h-9 mx-auto mb-2 grid place-items-center rounded-xl text-lg icon-bounce"
              style={{ background: `${s.color}1f`, border: `1px solid ${s.color}33`, animationDelay: `${i * 0.3}s` }}>{s.icon}</div>
            <div className="font-display font-bold text-xl mb-1 truncate" style={{ color: s.color }}>{s.value}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{s.label}</div>
            <div className="font-mono text-[10px] text-white/20 mt-0.5 truncate">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mb-8">
        <p className="eyebrow mb-4 text-center">How it works</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: '1', icon: '📋', title: 'Register tickets', body: 'Paste the ticket codes straight from your spreadsheet or list — each row is saved instantly.' },
            { n: '2', icon: '🎲', title: 'Run the draw', body: 'One tap opens the stage. Names cycle, the drum slows, and a winner is picked at random.' },
            { n: '3', icon: '🏆', title: 'Award the prize', body: 'Each draw hands out the next prize on the list, so nobody can win the same thing twice.' },
          ].map((s, i) => (
            <div key={s.n} className="panel relative rounded-2xl p-5 pl-6 flip-in" style={{ animationDelay: `${i * 0.08}s` }}>
              {/* Spinning dashed ring behind the step number */}
              <span className="ring-dash absolute -top-3 -left-3 w-10 h-10 opacity-40 sway"
                style={{ animationDelay: `${i * 2}s`, WebkitMask: 'radial-gradient(circle, transparent 56%, #000 58%)', mask: 'radial-gradient(circle, transparent 56%, #000 58%)' }} />
              <span className="absolute top-4 right-4 font-mono text-3xl font-bold text-white/5">{s.n}</span>
              <div className="text-2xl mb-2">{s.icon}</div>
              <h3 className="font-display font-bold text-white text-base mb-1">{s.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prizes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Prizes</p>
          <p className="font-mono text-[10px] text-white/25">
            {wonByPrize.size > 0 ? `${pastWinners.length} of ${TOTAL_PRIZES} awarded` : `${TOTAL_PRIZES} prizes up for grabs`}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRIZES.map((p, i) => {
            const won = Math.min(wonByPrize.get(p.label) ?? 0, p.winners)
            const pct = (won / p.winners) * 100
            return (
              <div key={i}
                className="panel shine relative flex items-center gap-3 px-4 py-3 rounded-2xl overflow-hidden transition-all"
                style={p.highlight ? { borderColor: 'color-mix(in srgb, var(--t-deep) 45%, transparent)', boxShadow: '0 0 30px color-mix(in srgb, var(--t-hot) 14%, transparent)' } : undefined}>
                {p.highlight && (
                  <span className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(120deg,color-mix(in srgb, var(--t-hot) 16%, transparent),transparent 60%)' }} />
                )}
                <span className="text-2xl relative">{p.icon}</span>
                <div className="relative min-w-0">
                  <div className="font-bold text-white text-sm truncate">{p.label}</div>
                  <div className="font-mono text-[11px]" style={{ color: p.highlight ? theme.light : theme.mint }}>{p.qty}</div>
                  {won > 0 && (
                    <div className="mt-1.5 h-1 w-24 rounded-full overflow-hidden progress-shine" style={{ background: 'rgba(255,138,190,0.12)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg,var(--t-hot),var(--t-light))' }} />
                    </div>
                  )}
                </div>
                {/* Won count is meaningful even on the grand prize row, so it is shown
                    alongside the "Grand" tag rather than in place of it. */}
                {won > 0 && (
                  <span className="ml-auto relative font-mono text-[10px] px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--t-deep) 35%, transparent)', color: theme.mint, border: '1px solid color-mix(in srgb, var(--t-mint) 24%, transparent)' }}>
                    {won}/{p.winners} won
                  </span>
                )}
                {p.highlight && (
                  <span className={`relative font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0 ${won > 0 ? '' : 'ml-auto'}`}
                    style={{ background: 'color-mix(in srgb, var(--t-deep) 30%, transparent)', color: theme.light }}>Grand</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Participant list preview */}
      {entries.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Participants</p>
            <button onClick={() => setView('register')} className="text-xs text-white/40 hover:underline cursor-pointer font-medium">Manage →</button>
          </div>
          <div className="panel rounded-2xl overflow-hidden">
            {entries.slice(0, 6).map((e, i) => (
              <div key={i} className="flex items-center px-5 gap-4"
                style={{ height: 46, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.022)', borderBottom: i < Math.min(entries.length, 6) - 1 ? '1px solid rgba(255,138,190,0.1)' : 'none' }}>
                <span className="font-mono text-[10px] text-white/20 w-6 text-right flex-shrink-0">{i + 1}</span>
                <span className="font-mono text-xs font-medium w-44 truncate flex-shrink-0" style={{ color: theme.mint }}>{e.code}</span>
                <span className="font-mono text-sm font-semibold text-white/80 truncate tracking-wide flex-1">{e.name}</span>
              </div>
            ))}
            {entries.length > 6 && (
              <div className="text-center py-3 text-xs font-mono text-white/30 border-t border-white/5">
                +{entries.length - 6} more — <button onClick={() => setView('register')} className="text-white/30 underline cursor-pointer">view all</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center panel rounded-2xl py-14">
          <div className="text-5xl mb-3" style={{ animation: 'floatBob 3s ease-in-out infinite' }}>🎟</div>
          <p className="font-mono text-sm text-white/30">No tickets registered yet.</p>
          <button onClick={() => setView('register')} className="mt-4 px-5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all border border-white/10 text-white/40 hover:border-white/25 hover:text-white">
            Add your first ticket →
          </button>
        </div>
      )}

      {/* Winner ticker — only meaningful once a draw has been run */}
      {pastWinners.length > 0 && <WinnerTicker winners={pastWinners} onOpen={() => setView('draw')} theme={theme} />}

      {/* Scripture */}
      <div className="mt-8 panel rounded-3xl px-8 py-9 text-center relative overflow-hidden breathe"
        style={{ background: 'linear-gradient(135deg,color-mix(in srgb, var(--t-violet) 18%, transparent),color-mix(in srgb, var(--t-violet) 18%, transparent))' }}>
        <div className="text-3xl mb-3" style={{ animation: 'floatBob 4s ease-in-out infinite' }}>✝️</div>
        <p className="font-display italic text-white/60 text-lg md:text-2xl leading-relaxed mb-2">
          "God loves a cheerful giver."
        </p>
        <cite className="font-mono text-xs text-white/25">2 Corinthians 9:7</cite>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Winner ticker — a scrolling band of the winners drawn so far, with the codes
// reversed and drifting the other way underneath for a woven-tape effect.
// ─────────────────────────────────────────────────────────────────────────────
function WinnerTicker({ winners, onOpen, theme }: { winners: Winner[]; onOpen: () => void; theme: Theme }) {
  const row = (offset: number) => (
    <div className="marquee-mask">
      <div className="marquee-track" style={{ animationDuration: `${34 + offset}s`, animationDirection: offset ? 'reverse' : 'normal' }}>
        {[0, 1].map(copy => (
          <div key={copy} className="flex shrink-0">
            {winners.slice(0, 12).map((w, i) => (
              // `key` must be unique across both copies of the track.
              // `key` must be unique across both copies of the track, which sit
              // side by side in the same flex row.
              <div key={`${copy}-${i}`} className="flex items-center gap-2 px-4 py-1.5 font-mono text-xs whitespace-nowrap">
                <span style={{ color: theme.light }}>🏆</span>
                <span className="text-white/70">{w.name || '—'}</span>
                <span style={{ color: theme.mint, opacity: 0.6 }}>{w.code}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <div className="mb-8">
      <button onClick={onOpen} className="flex items-center gap-2 mb-3 group cursor-pointer">
        <span className="live-dot heartbeat" />
        <span className="eyebrow transition-colors group-hover:text-white/60">Live winners</span>
        <span className="text-white/20 group-hover:text-white/50 transition-colors text-xs">→ open draw</span>
      </button>
      <div className="panel rounded-2xl overflow-hidden py-1">
        {row(0)}
        <div className="rule-gold opacity-30" />
        {row(16)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────
function RegisterView({
  entries,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  theme,
}: {
  entries: TicketEntry[]
  onChange: (next: TicketEntry[]) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  theme: Theme
}) {
  const [pasteVal, setPasteVal] = useState('')
  const [flashFrom, setFlashFrom] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  // Codes rejected as duplicates from the most recent paste, so the user can
  // see exactly which rows were refused instead of silently losing them.
  const [dupCodes, setDupCodes] = useState<string[]>([])
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    if (dupTimer.current) clearTimeout(dupTimer.current)
  }, [])

  // The identity of a ticket is its code, compared case-insensitively and with
  // spacing/punctuation ignored, so "#123" and "123 " and "123" are one ticket.
  const normalizeCode = (raw: string) => raw.replace(/^#+/, '').replace(/[\s\-_.]/g, '').toLowerCase()

  const parseLines = (raw: string): TicketEntry[] => {
    const seen = new Set<string>()
    return raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      // Strip common list-marker prefixes: *, -, •, 1. 1) etc.
      const stripped = l.replace(/^([*\-•]|\d+[.):])\s+/, '').trim()
      const m = stripped.match(/^(\S+)\s+(.+)$/)
      if (m) return { code: m[1].trim(), name: m[2].trim().toUpperCase() }
      const parts = stripped.split(/\s+/)
      if (parts.length >= 2) return { code: parts[0], name: parts.slice(1).join(' ').toUpperCase() }
      return { code: stripped, name: '' }
    }).filter(e => {
      // Deduplicate within this paste: keep only the first of a given code.
      const k = normalizeCode(e.code)
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  const commit = (raw: string) => {
    const parsed = parseLines(raw)
    if (!parsed.length) {
      setDupCodes([])
      setPasteVal('')
      return
    }

    // A ticket number may only be registered once, ever. Anything matching an
    // existing code — or repeated inside this same paste — is refused, and the
    // code is stored as the canonical form already on file so the message
    // points at the ticket the user can actually see.
    const existing = new Map<string, string>()
    for (const e of entries) {
      const k = normalizeCode(e.code)
      if (!existing.has(k)) existing.set(k, e.code)
    }

    const fresh: TicketEntry[] = []
    const duplicates: string[] = []
    const batch = new Set<string>()

    for (const e of parsed) {
      const k = normalizeCode(e.code)
      const prior = existing.get(k)
      if (prior !== undefined || batch.has(k)) {
        duplicates.push(prior ?? e.code)
        continue
      }
      batch.add(k)
      fresh.push(e)
    }

    if (dupTimer.current) clearTimeout(dupTimer.current)
    setDupCodes([...new Set(duplicates)])
    if (duplicates.length) {
      dupTimer.current = setTimeout(() => setDupCodes([]), 6000)
    }

    if (fresh.length) {
      setFlashFrom(entries.length)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlashFrom(null), 900)
      onChange([...entries, ...fresh])
    }
    setPasteVal('')
  }

  // A short, deterministic sample list so the screen isn't empty on first open.
  const loadSample = () => {
    const sample = Array.from({ length: 12 }, (_, i) => {
      const first = ['MARIA', 'JOSE', 'ANA', 'RICARDO', 'LIZA', 'PAULO', 'CRISTINA', 'MANUEL', 'GRACE', 'JONATHAN', 'TERESITA', 'DANILO'][i]
      const last = ['SANTOS', 'CRUZ', 'REYES', 'DELA CRUZ', 'BAUTISTA', 'GARCIA', 'MENDOZA', 'TORRES', 'RAMOS', 'VILLANUEVA', 'AQUINO', 'SALAZAR'][i]
      return `#2026${String(1000 + i * 37).padStart(5, '0')}  ${first} ${last}`
    }).join('\n')
    commit(sample)
  }

  const exportCsv = () => {
    const body = ['code,name', ...entries.map(e => `"${e.code}","${e.name}"`)].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'rice-and-shine-tickets.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Search is case-insensitive across both code and name; empty query shows
  // the newest entries, which is what the user most likely just pasted.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return entries.filter(e => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
  }, [entries, query])

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 view-enter">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1">
          <p className="eyebrow mb-1">Step 01 · Register</p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">Ticket Registration</h1>
          <p className="text-white/40 text-xs font-mono mt-1">Paste entries — auto-saved instantly</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
        <button onClick={onUndo} disabled={!canUndo}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-white/10 text-white/50 hover:border-white/30 hover:text-white transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13C5.33 7.67 10 5 15 5a9 9 0 0 1 0 18c-4 0-7.4-2-9-5"/></svg>
          Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-white/10 text-white/50 hover:border-white/30 hover:text-white transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13C18.67 7.67 14 5 9 5a9 9 0 0 0 0 18c4 0 7.4-2 9-5"/></svg>
          Redo
        </button>
        {entries.length > 0 && (
          <button onClick={exportCsv} className="px-3 py-2 rounded-xl text-xs font-medium border border-white/10 text-white/50 hover:border-white/30 hover:text-white transition-all cursor-pointer">
            Export
          </button>
        )}
        {entries.length > 0 && (
          <button onClick={() => onChange([])} className="px-3 py-2 rounded-xl text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer">
            Clear All
          </button>
        )}
        </div>
      </div>

      {/* Summary strip */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Entries', value: entries.length.toLocaleString(), color: theme.mint },
            { label: 'Potential Raise', value: `₱${(entries.length * TICKET_PRICE).toLocaleString()}`, color: theme.light },
            { label: 'Winners Possible', value: Math.min(TOTAL_PRIZES, entries.length).toString(), color: theme.hot },
          ].map(s => (
            <div key={s.label} className="panel rounded-2xl px-4 py-3 text-center">
              <div className="font-display font-bold text-lg truncate" style={{ color: s.color }}>{s.value}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/30 mt-0.5 truncate">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Paste box */}
      <div className="panel rounded-2xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-0.5">Paste Entry</p>
            <p className="text-xs text-white/40">
              Format: <span className="font-mono text-white/50">#CODE123  FULL NAME</span> — paste or Enter to save
            </p>
          </div>
          {entries.length > 0 && (
            <span className="font-mono text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--t-deep) 30%, transparent)', color: theme.mint, border: '1px solid color-mix(in srgb, var(--t-mint) 28%, transparent)' }}>
              {entries.length} saved
            </span>
          )}
        </div>
        <textarea
          value={pasteVal}
          onChange={e => setPasteVal(e.target.value)}
          onPaste={e => { e.preventDefault(); commit(e.clipboardData.getData('text')) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(pasteVal) } }}
          rows={3}
          placeholder="#1231231231231095  ZELSAR SERAT"
          className="w-full px-4 py-3 font-mono text-sm bg-transparent text-white/80 resize-none focus:outline-none placeholder:text-white/15"
        />
        <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-3 bg-black/10">
          <button onClick={loadSample}
            className="font-mono text-[11px] px-3 py-1.5 rounded-lg text-white/50 border border-white/10 hover:border-white/25 hover:text-white transition-all cursor-pointer">
            Load sample data
          </button>
          <span className="font-mono text-[10px] text-white/20">Just exploring? Try this first.</span>
        </div>
      </div>

      {/* Duplicate rejection notice — names the exact tickets that were refused */}
      {dupCodes.length > 0 && (
        <div className="mb-4 rounded-2xl px-4 py-3 flex items-start gap-3"
          style={{ background: 'color-mix(in srgb, var(--t-hot) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-deep) 45%, transparent)' }}
          role="alert">
          <span className="text-lg leading-none flex-shrink-0">⚠️</span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-bold text-white/70 mb-0.5">
              {dupCodes.length} duplicate ticket{dupCodes.length === 1 ? '' : 's'} not registered
            </p>
            <p className="font-mono text-[11px] text-white/45 leading-relaxed break-words">
              Each ticket number can only be registered once. Skipped:{' '}
              <span style={{ color: theme.soft }}>{dupCodes.slice(0, 8).join(', ')}</span>
              {dupCodes.length > 8 && ` +${dupCodes.length - 8} more`}
            </p>
          </div>
          <button onClick={() => setDupCodes([])} className="text-white/30 hover:text-white/70 cursor-pointer text-lg leading-none flex-shrink-0">×</button>
        </div>
      )}

      {/* List — virtualized: render max 500 rows to support 1–5k registrations */}
      {entries.length > 0 ? (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by code or name…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 font-mono text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors border-dance"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 cursor-pointer text-lg leading-none">
                ×
              </button>
            )}
          </div>

          {filtered && (
            <div className="flex items-center justify-between px-4 py-2 mb-2 rounded-xl text-xs font-mono"
              style={{ background: 'color-mix(in srgb, var(--t-deep) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-mint) 20%, transparent)', color: theme.mint }}>
              <span>{filtered.length} match{filtered.length === 1 ? '' : 'es'} for “{query.trim()}”</span>
              <span className="text-white/30">All {entries.length} stay eligible for the draw</span>
            </div>
          )}

          {!filtered && entries.length > 500 && (
            <div className="flex items-center justify-between px-4 py-2 mb-2 rounded-xl text-xs font-mono"
              style={{ background: 'color-mix(in srgb, var(--t-hot) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--t-deep) 24%, transparent)', color: 'color-mix(in srgb, var(--t-soft) 85%, transparent)' }}>
              <span>Showing last 500 of {entries.length} entries</span>
              <span className="text-white/30">All {entries.length} will be included in the draw</span>
            </div>
          )}

          {filtered && filtered.length === 0 ? (
            <div className="text-center panel rounded-2xl py-14">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-mono text-sm text-white/30">No entries match that search.</p>
            </div>
          ) : (
            <div className="panel rounded-2xl overflow-hidden">
              {(filtered ?? entries.slice(-500)).map((e, idx) => {
                // `i` is the row's real index in the full list, needed for the
                // delete handler and the "newly added" highlight.
                const i = filtered ? entries.indexOf(e) : (entries.length > 500 ? entries.length - 500 + idx : idx)
                const isNew = flashFrom !== null && i >= flashFrom
                const initials = e.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('') || '?'
                return (
                  <div key={i} className={`group flex items-stretch ${isNew ? 'ticket-wave' : ''}`}
                    style={{
                      background: isNew ? 'color-mix(in srgb, var(--t-deep) 15%, transparent)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.022)',
                      borderBottom: '1px solid rgba(255,138,190,0.07)',
                      transition: 'background 0.4s',
                      animation: 'rowIn 0.3s ease both',
                      animationDelay: `${Math.min(idx, 20) * 0.03}s`,
                    }}>
                    <span className="font-mono text-[10px] text-white/25 w-12 flex items-center justify-end pr-3 flex-shrink-0">{i + 1}</span>
                    {/* Initials chip */}
                    <span className="w-8 h-8 my-auto mr-3 rounded-lg grid place-items-center font-mono text-[11px] font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(140deg,color-mix(in srgb, var(--t-deep) 40%, transparent),color-mix(in srgb, var(--t-violet) 45%, transparent))', border: '1px solid rgba(255,138,190,0.16)', color: 'var(--t-cream)' }}>
                      {initials}
                    </span>
                    <div className="flex-1 min-w-0 py-3 pr-3">
                      <div className="font-mono text-sm font-bold text-white/85 truncate tracking-wide">{e.name || '—'}</div>
                      <div className="font-mono text-[11px] truncate" style={{ color: theme.mint, opacity: 0.75 }}>{e.code}</div>
                    </div>
                    {/* Perforated stub edge */}
                    <span className="stub w-2 flex-shrink-0" />
                    <button onClick={() => onChange(entries.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 w-10 text-white/20 hover:text-red-400 transition-all cursor-pointer text-xl leading-none flex-shrink-0"
                      title="Remove entry">
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center panel rounded-2xl py-20">
          <div className="text-5xl mb-3 sway" style={{ animation: 'floatBob 3s ease-in-out infinite' }}>📋</div>
          <p className="font-mono text-sm text-white/30">No entries yet — paste ticket codes above</p>
          <button onClick={loadSample}
            className="mt-4 px-5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all border border-white/10 text-white/40 hover:border-white/25 hover:text-white">
            Load sample data →
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw ambience — the lighting rig around the stage. Everything here sits
// outside the winner card so the card itself stays readable: a rotating
// spotlight cone, expanding ripple rings on the beat of the draw, orbiting
// sparkles, and speed streaks that only whip past while the drum is spinning.
// `intensity` (0 idle → 1 spinning → 2 revealed) drives opacity and speed so
// one component covers all three beats of the draw.
// ─────────────────────────────────────────────────────────────────────────────
function DrawAmbience({ theme, intensity }: { theme: Theme; intensity: 0 | 1 | 2 }) {
  const lit = intensity > 0
  const bright = intensity === 2
  // Everything eases between beats rather than snapping on.
  const ease = 'opacity 0.7s ease, filter 0.7s ease'

  return (
    <div className="absolute -inset-16 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden="true">
      {/* Rotating spotlight cone, hung from above the stage */}
      <div
        className="absolute left-1/2"
        style={{
          translate: '-50% 0',
          top: '-30%',
          width: 640,
          height: 900,
          background: `conic-gradient(from 160deg at 50% 0%,
            transparent 0deg,
            color-mix(in srgb, ${theme.hot} 13%, transparent) 12deg,
            color-mix(in srgb, ${theme.light} 7%, transparent) 22deg,
            transparent 34deg)`,
          filter: 'blur(26px)',
          transformOrigin: '50% 0%',
          animation: `coneSweep ${bright ? '7s' : lit ? '11s' : '18s'} ease-in-out infinite`,
          opacity: bright ? 1 : lit ? 0.75 : 0.45,
          transition: ease,
        }}
      />

      {/* Ripple rings — each one expands and fades, offset so the beats stagger */}
      {[0, 1, 2, 3].map(i => (
        <div
          key={`ripple-${i}`}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: 560,
            height: 560,
            marginLeft: -280,
            marginTop: -280,
            border: `1px solid color-mix(in srgb, ${theme.hot} 55%, transparent)`,
            animation: `rippleOut ${bright ? '2.6s' : lit ? '4s' : '6.5s'} cubic-bezier(0.2, 0.7, 0.3, 1) ${i * (bright ? 0.65 : 1.1)}s infinite`,
            opacity: bright ? 0.55 : lit ? 0.32 : 0.16,
            transition: ease,
          }}
        />
      ))}

      {/* Orbiting sparkles — one rotating wrapper carries the whole ellipse, so
          they use the same orbitSpin keyframe the card's rings already rely on.
          The wrapper is scaled wide to stretch the circle into an ellipse. */}
      <div
        className="absolute left-1/2 top-1/2 w-0 h-0"
        style={{
          transform: 'scaleX(1.6)',
          animation: `orbitSpin ${bright ? '7s' : lit ? '12s' : '22s'} linear infinite`,
          opacity: bright ? 1 : lit ? 0.75 : 0.4,
          transition: ease,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i / 6) * Math.PI * 2
          const dot = 3 + (i % 2)
          const tint = i % 3 === 0 ? theme.light : i % 3 === 1 ? theme.mint : theme.violet
          return (
            <span
              key={`orbit-${i}`}
              className="absolute rounded-full block"
              style={{
                width: dot,
                height: dot,
                left: -dot / 2,
                top: -220 - dot / 2,
                background: tint,
                boxShadow: `0 0 9px ${tint}`,
                // Counter-scale so the wrapper's stretch doesn't smear the dot.
                transform: `rotate(${angle}rad) scaleX(0.625)`,
                animation: `starTwinkle ${2 + (i % 3)}s ease-in-out ${i * 0.42}s infinite`,
              }}
            />
          )
        })}
      </div>

      {/* Speed streaks — only while the drum is actually turning */}
      {lit && Array.from({ length: 9 }).map((_, i) => (
        <div
          key={`streak-${i}`}
          className="absolute rounded-full"
          style={{
            top: `${6 + (i * 11) % 88}%`,
            width: 90 + (i % 4) * 70,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${i % 3 === 0 ? theme.light : theme.hot}, transparent)`,
            animation: `streakPast ${bright ? '0.7s' : '1.5s'} linear ${i * 0.14}s infinite`,
            opacity: bright ? 0.85 : 0.55,
          }}
        />
      ))}

      {/* Pool of light on the floor beneath the stage */}
      <div
        className="absolute left-1/2"
        style={{
          translate: '-50% 0',
          bottom: '-6%',
          width: 720,
          height: 190,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${theme.hot}33, transparent 70%)`,
          filter: 'blur(20px)',
          animation: `poolBreathe ${bright ? '2.2s' : lit ? '3.4s' : '5s'} ease-in-out infinite`,
        }}
      />

      {/* Corner brackets that snap in when the winner lands */}
      <div
        className="absolute inset-6"
        style={{
          background: `conic-gradient(from 45deg at 0% 0%, ${theme.hot} 0deg, transparent 34deg) top left / 42px 42px no-repeat,
                       conic-gradient(from -45deg at 100% 0%, ${theme.hot} 0deg, transparent 34deg) top right / 42px 42px no-repeat,
                       conic-gradient(from -135deg at 0% 100%, ${theme.hot} 0deg, transparent 34deg) bottom left / 42px 42px no-repeat,
                       conic-gradient(from 135deg at 100% 100%, ${theme.hot} 0deg, transparent 34deg) bottom right / 42px 42px no-repeat`,
          opacity: bright ? 0.9 : 0,
          transform: `scale(${bright ? 1 : 1.12})`,
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw
// ─────────────────────────────────────────────────────────────────────────────
// Timings for the two draw phases, in ms. `slow` deliberately ends slower than
// it starts so the final pick lands with a visible beat.
const SPIN_MS = 3600
const SLOW_MS = 3000

function DrawView({
  entries,
  pastWinners,
  onWinner,
  onResetWinners,
  theme,
}: {
  entries: TicketEntry[]
  pastWinners: Winner[]
  onWinner: (w: Winner) => void
  onResetWinners: () => void
  theme: Theme
}) {
  const [state, setState] = useState<DrawState>('idle')
  const [winner, setWinner] = useState<Winner | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [showShockwave, setShowShockwave] = useState(false)
  const [winnerKey, setWinnerKey] = useState(0)
  const [drawProgress, setDrawProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  // Which prize the next draw will award. Defaults to the next in the schedule,
  // but the user can pick any remaining prize from the side panel.
  const [selectedPrize, setSelectedPrize] = useState<string | null>(null)
  // Holds every pending timeout so unmounting mid-draw can't leak a timer.
  const timeouts = useRef<number[]>([])

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timeouts.current.push(id)
    return id
  }, [])

  const clearTimers = useCallback(() => {
    timeouts.current.forEach(window.clearTimeout)
    timeouts.current = []
  }, [])

  // Cancel the draw if the user navigates away mid-spin.
  useEffect(() => () => { clearTimers() }, [clearTimers])

  // Flattens the winner history into a clipboard-ready list, newest first.
  const exportWinners = useCallback(() => {
    const text = pastWinners
      .map(w => `#${w.round}\t${w.name}\t${w.code}\t${w.prize}`)
      .join('\n')
    navigator.clipboard?.writeText(`A Rice & Shine — Winners\n${text}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [pastWinners])

  // Every code that has already won. Compared against the FULL list so a
  // participant can't repeat once the visible list has scrolled past 10.
  const wonCodes = useMemo(() => {
    const s = new Set<string>()
    for (const w of pastWinners) {
      const k = w.code.replace(/^#+/, '').replace(/[\s\-_.]/g, '').toLowerCase()
      if (k) s.add(k)
    }
    return s
  }, [pastWinners])

  // Eligibility. A ticket code that has already won is always removed from the
  // pool, so the same code can never win twice. A person who holds a different
  // ticket code stays eligible — they can win again with a new code. This is
  // the only behaviour now; the old allowRepeat toggle has been removed.
  const pool = entries.filter(e => !wonCodes.has(e.code.replace(/^#+/, '').replace(/[\s\-_.]/g, '').toLowerCase()))

  // ── Chained auto-draw state ────────────────────────────────────────────────
  // A batch draw runs several rounds back to back. Because each round's
  // `pool` excludes the previous winner, the chain has to read the newest
  // pool and the newest `runDraw` at the moment each round starts rather than
  // closing over the values from when the batch was launched. These refs carry
  // both, and are refreshed on every render.
  const runDrawRef = useRef<() => void>(() => {})
  const autoLeft = useRef(0)
  // Batches shorten the spin so 20 rounds don't take five minutes to play out.
  const spinMs = useRef(SPIN_MS)
  const slowMs = useRef(SLOW_MS)
  const inBatch = autoLeft.current > 0
  // `state` inside the tick closures would be stale, so the spin phase is
  // tracked in a ref instead.
  const spinning = useRef(false)

  useEffect(() => {
    if (selectedPrize && selectedPrize !== '__none__' && getPrizeRemaining(selectedPrize, pastWinners) <= 0) {
      const nextPrize = getNextAvailablePrize(pastWinners)
      if (nextPrize) {
        setSelectedPrize(nextPrize)
      }
    }
  }, [selectedPrize, pastWinners])

  const runDraw = () => {
    const active = pool
    if (active.length === 0) return

    clearTimers()
    setWinner(null)
    setShowFlash(false)
    setShowShockwave(false)
    setShowConfetti(false)
    setDrawProgress(0)
    setState('spinning')

    const pick = () => active[Math.floor(Math.random() * active.length)]

    // Wall-clock driven so progress tracks real elapsed time and never
    // outruns or lags behind the reveal.
    const start = performance.now()
    let slowStart = 0

    const finish = () => {
      clearTimers()
      spinning.current = false
      const win = pick()
      // The round is captured from the live history at the moment of the pick,
      // so the card can never disagree with the record it writes.
      const idx = pastWinners.length
      // Use the prize the user picked from the side panel, or fall back to
      // the next available prize in the automatic schedule. The '__none__'
      // sentinel means the draw awards no prize at all.
      const awardedPrize = selectedPrize === '__none__'
        ? 'None'
        : getNextAvailablePrize(pastWinners, selectedPrize) ?? 'None'
      const winnerRecord: Winner = {
        ...win,
        round: idx + 1,
        prize: awardedPrize,
      }
      setWinner(winnerRecord)
      setWinnerKey(k => k + 1)
      setDrawProgress(1)
      setState('winner')
      onWinner(winnerRecord)
      setShowFlash(true)
      later(() => setShowFlash(false), 600)
      later(() => setShowShockwave(true), 200)
      later(() => setShowShockwave(false), 2200)
      setShowConfetti(true)
      later(() => setShowConfetti(false), inBatch ? 1200 : 6000)

      // Chain the next round, if this is a batch. Uses the ref so the follow-up
      // picks from a pool that already excludes this winner.
      if (autoLeft.current > 0) {
        autoLeft.current -= 1
        later(() => runDrawRef.current(), inBatch ? 900 : 2600)
      }
    }

    const slowTick = () => {
      const t = (performance.now() - slowStart) / slowMs.current
      if (t >= 1) { finish(); return }
      setDrawProgress(0.7 + t * 0.3)
      later(slowTick, 90 + t * 340)
    }

    const fastTick = () => {
      const elapsed = performance.now() - start
      if (elapsed >= spinMs.current) {
        setState('slowing')
        slowStart = performance.now()
        setDrawProgress(0.7)
        later(slowTick, 90)
        return
      }
      const t = elapsed / spinMs.current
      setDrawProgress(t * 0.7)
      // Start fast, ease off as the phase completes.
      later(fastTick, 45 + t * 95)
    }

    later(fastTick, 0)
  }

  // Clears the stage AND the winner history — otherwise everyone stays
// "already won" and the draw can never be run again.
  runDrawRef.current = runDraw

  // Draws every remaining round unattended. The chain stops on its own once
  // `autoLeft` hits zero, so it can never pick the same person twice.
  const drawAll = () => {
    // Bounded by the prizes left and by the pool, but never below one round,
    // so a batch can't spin forever on an empty or already-complete draw.
    const rounds = Math.max(1, Math.min(prizesLeft, pool.length || 1))
    autoLeft.current = rounds - 1
    spinMs.current = Math.max(1400, SPIN_MS / 3)
    slowMs.current = Math.max(900, SLOW_MS / 3)
    runDraw()
  }

  const reset = () => {
    clearTimers()
    spinning.current = false
    autoLeft.current = 0
    spinMs.current = SPIN_MS
    slowMs.current = SLOW_MS
    onResetWinners()
    setState('idle')
    setWinner(null)
    setShowFlash(false)
    setShowShockwave(false)
    setShowConfetti(false)
    setDrawProgress(0)
  }

  const isEmpty = entries.length === 0
  const isSpinning = state === 'spinning' || state === 'slowing'
  const isFast = state === 'spinning'
  // Drives the stage ambience: quiet while idle, lit while spinning, full
  // reveal once a winner is showing.
  const ambience: 0 | 1 | 2 = state === 'winner' ? 2 : isSpinning ? 1 : 0
  // How many tickets this round is actually choosing from. This is the real
  // pool size, not a running subtraction, so it stays correct when entries are
  // edited mid-draw or when repeats are enabled.
  const activeCount = pool.length

  // Which prize this draw is handing out. Derived from how many draws have
  // already happened, so it advances by itself every round.
  const round = pastWinners.length + 1
  const prize = getNextAvailablePrize(pastWinners) ?? 'None'
  const prizesLeft = Math.max(0, TOTAL_PRIZES - pastWinners.length)

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 view-enter">
      <Confetti active={showConfetti} theme={theme} />
      <ScreenFlash active={showFlash} />
      <RevealFx active={state === 'winner'} theme={theme} />

      {/* Page title — every letter catches the light in sequence */}
      <div className="text-center mb-8 blur-in">
        <p className="eyebrow mb-2">Step 02 · Draw</p>
        <h1 className="font-display font-black" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>
          <span className="title-halo">
            {TITLE_LETTERS.map((ch, i) => (
              <span key={i} className="title-letter" style={{ animationDelay: `${i * 0.075}s` }}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
            <span className="title-glare" aria-hidden="true">
              {TITLE_LETTERS.map((ch, i) => (
                <span key={i}>{ch === ' ' ? '\u00A0' : ch}</span>
              ))}
            </span>
          </span>{' '}
          <span className="text-white/70 font-normal text-3xl align-middle">Draw</span>
        </h1>
      </div>

      {/* Round pill removed — the prize selector and stage show the same info */}

      {/* ── PRIZE SELECTOR on the left, STAGE centered with clearance ── */}
      <div className="relative">
        {/* Desktop: prize buttons pinned far left */}
        <div className="hidden lg:flex lg:flex-col lg:gap-2 absolute left-0 top-0 w-48" style={{ zIndex: 20 }}>
            {/* Blank / Auto option */}
            <button onClick={() => setSelectedPrize(null)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: selectedPrize === null ? `${theme.hot}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selectedPrize === null ? theme.hot : 'rgba(255,255,255,0.08)'}`,
              }}>
              <span className="text-lg flex-shrink-0">🎲</span>
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-white/85">Auto (next in list)</div>
                <div className="font-mono text-[10px]" style={{ color: theme.mint }}>Default order</div>
              </div>
              {selectedPrize === null && (
                <span className="ml-auto text-xs flex-shrink-0" style={{ color: theme.hot }}>✓</span>
              )}
            </button>

            {PRIZES.map(p => {
              const won = pastWinners.filter(w => w.prize === p.label).length
              const remaining = Math.max(0, p.winners - won)
              const isSelected = selectedPrize === p.label
              return (
                <button key={p.label} onClick={() => setSelectedPrize(p.label)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: isSelected ? `${theme.hot}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSelected ? theme.hot : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  <span className="text-lg flex-shrink-0">{p.icon}</span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-white/85 truncate">{p.label}</div>
                    <div className="font-mono text-[10px]" style={{ color: remaining > 0 ? theme.mint : 'rgba(255,255,255,0.25)' }}>
                      {remaining > 0 ? `${remaining} left` : 'All won'}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="ml-auto text-xs flex-shrink-0" style={{ color: theme.hot }}>✓</span>
                  )}
                </button>
              )
            })}

            {/* None — draw a winner without awarding a prize */}
            <button onClick={() => setSelectedPrize('__none__')}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: selectedPrize === '__none__' ? `${theme.hot}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selectedPrize === '__none__' ? theme.hot : 'rgba(255,255,255,0.08)'}`,
              }}>
              <span className="text-lg flex-shrink-0">🚫</span>
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-white/85">None</div>
                <div className="font-mono text-[10px]" style={{ color: theme.mint }}>No prize</div>
              </div>
              {selectedPrize === '__none__' && (
                <span className="ml-auto text-xs flex-shrink-0" style={{ color: theme.hot }}>✓</span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile: horizontal scrollable prize buttons above the card */}
        <div className="lg:hidden flex flex-row gap-2 overflow-x-auto pb-3 mb-2">
          <button onClick={() => setSelectedPrize(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-shrink-0"
            style={{
              background: selectedPrize === null ? `${theme.hot}20` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selectedPrize === null ? theme.hot : 'rgba(255,255,255,0.08)'}`,
            }}>
            🎲 Auto
          </button>
          {PRIZES.map(p => {
            const won = pastWinners.filter(w => w.prize === p.label).length
            const remaining = Math.max(0, p.winners - won)
            const isSelected = selectedPrize === p.label
            return (
              <button key={p.label} onClick={() => setSelectedPrize(p.label)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-shrink-0"
                style={{
                  background: isSelected ? `${theme.hot}20` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? theme.hot : 'rgba(255,255,255,0.08)'}`,
                }}>
                {p.icon} {p.label}
              </button>
            )
          })}
          <button onClick={() => setSelectedPrize('__none__')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-shrink-0"
            style={{
              background: selectedPrize === '__none__' ? `${theme.hot}20` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selectedPrize === '__none__' ? theme.hot : 'rgba(255,255,255,0.08)'}`,
            }}>
            🚫 None
          </button>
        </div>

        {/* ── STAGE — centered, prize selector pinned far left ── */}
        <div className="relative mx-auto mb-8" style={{ maxWidth: 700 }}>

        {/* ── OUTSIDE THE CARD: animated background effects ── */}
        {/* The full lighting rig — cones, ripples, orbiting sparks, streaks */}
        <DrawAmbience theme={theme} intensity={ambience} />

        {/* Pulsing glow behind the card */}
        <div className="absolute -inset-8 rounded-3xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${theme.hot}15, transparent 70%)`,
            animation: 'breathe 3s ease-in-out infinite',
          }} />

        {/* Rotating light beams */}
        {[0, 1, 2, 3].map(i => (
          <div key={`beam-${i}`} className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              width: 400,
              height: 2,
              marginTop: -1,
              marginLeft: -200,
              background: `linear-gradient(90deg, transparent, ${theme.hot}60, transparent)`,
              transformOrigin: 'center',
              transform: `rotate(${i * 45}deg)`,
              animation: `rays ${8 + i * 2}s linear infinite`,
              opacity: isSpinning ? 0.6 : 0.2,
              transition: 'opacity 0.6s',
            }} />
        ))}

        {/* Floating particles around the card */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`particle-${i}`} className="absolute rounded-full pointer-events-none"
            style={{
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              background: i % 3 === 0 ? theme.hot : i % 3 === 1 ? theme.violet : theme.mint,
              top: `${10 + (i * 7) % 80}%`,
              left: i < 6 ? `${-20 - (i * 15)}px` : `calc(100% + ${20 + ((i - 6) * 15)}px)`,
              animation: `floatParticle ${6 + (i % 4) * 2}s linear ${i * 0.5}s infinite`,
              opacity: 0.5,
            }} />
        ))}

        {/* Animated gradient border ring */}
        <div className="absolute -inset-1 rounded-2xl pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${theme.hot}, ${theme.violet}, ${theme.mint}, ${theme.hot})`,
            backgroundSize: '300% 300%',
            animation: 'gradientBorder 4s ease infinite',
            opacity: isSpinning ? 0.4 : 0.15,
            transition: 'opacity 0.6s',
            zIndex: -1,
          }} />

        {/* ── THE CARD ── */}
        <div className="relative overflow-hidden rounded-lg"
          style={{
            background: 'linear-gradient(160deg,#26091f 0%,#160d20 45%,#12061d 100%)',
            border: state === 'winner'
              ? `2px solid ${theme.hot}`
              : isSpinning
              ? `1px solid ${theme.hot}80`
              : '1px solid rgba(255,138,190,0.16)',
            minHeight: 460,
            transition: 'border-color 0.4s',
            animation: state === 'winner' ? 'winnerBorder 2s ease-in-out infinite' : undefined,
          }}>

        {/* Spotlights during winner */}
        <Spotlights active={state === 'winner'} />

        {/* Lightning during fast spin */}
        <Lightning active={isFast} theme={theme} />

        {/* Rotating rays */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div style={{
            width: 900, height: 900, borderRadius: '50%',
            background: 'conic-gradient(from 0deg,transparent 0deg,color-mix(in srgb, var(--t-hot) 14%, transparent) 7deg,transparent 14deg,transparent 44deg,color-mix(in srgb, var(--t-mint) 11%, transparent) 51deg,transparent 58deg,transparent 94deg,color-mix(in srgb, var(--t-violet) 11%, transparent) 101deg,transparent 108deg,transparent 148deg,color-mix(in srgb, var(--t-deep) 10%, transparent) 155deg,transparent 162deg,transparent 196deg,color-mix(in srgb, var(--t-hot) 14%, transparent) 203deg,transparent 210deg,transparent 248deg,color-mix(in srgb, var(--t-mint) 11%, transparent) 255deg,transparent 262deg,transparent 300deg,color-mix(in srgb, var(--t-violet) 11%, transparent) 307deg,transparent 314deg,transparent 354deg,color-mix(in srgb, var(--t-deep) 10%, transparent) 361deg)',
            animation: `rays ${state === 'winner' ? '2.5s' : isSpinning ? '6s' : '22s'} linear infinite`,
            opacity: state === 'winner' ? 1 : isSpinning ? 0.7 : 0.4,
            transition: 'opacity 0.6s',
          }} />
        </div>

        {/* Shockwave rings on reveal */}
        <Shockwaves active={showShockwave} />

        {/* Rotating halo, grand prize only */}
        {state === 'winner' && round === 1 && (
          <>
            <div className="grand-halo absolute left-1/2 top-1/2 w-[560px] h-[560px] -ml-[280px] -mt-[280px] opacity-30 pointer-events-none z-[1]" />
            <div className="grand-halo absolute left-1/2 top-1/2 w-[420px] h-[420px] -ml-[210px] -mt-[210px] opacity-40 pointer-events-none z-[1]"
              style={{ animationDirection: 'reverse', animationDuration: '9s' }} />
          </>
        )}

        {/* Church watermark */}
        <div className="absolute bottom-4 right-4 w-16 h-16 opacity-[0.07] pointer-events-none">
          <img src={churchLogo} alt="" className="w-full h-full object-contain" />
        </div>

        {/* ── Content — stable flex column, nothing moves ── */}
        <div className="relative flex flex-col items-center justify-center py-12 px-6 text-center"
          style={{ minHeight: 460, userSelect: 'none' }}>

          {/* ── IDLE ── */}
          {state === 'idle' && (
            <div className="relative z-10" style={{ animation: 'fadeSlideUp 0.5s ease both' }}>
              <div className="text-7xl mb-4" style={{ animation: 'floatBob 3s ease-in-out infinite' }}>🌾</div>
              {isEmpty ? (
                <>
                  <p className="text-white/30 font-mono text-sm">No tickets registered.</p>
                  <p className="text-white/20 font-mono text-xs mt-1">Go to Register tab to add participants.</p>
                </>
              ) : (
                <>
                  <p className="font-mono text-white/50 text-base mb-1 font-medium">{entries.length} participant{entries.length !== 1 ? 's' : ''} ready</p>
                  <p className="font-mono text-white/20 text-xs">Press Start to begin the draw</p>
                </>
              )}
            </div>
          )}

          {/* ── DRAW CARD — rectangle, fixed height, never jumps ── */}
          {(isSpinning || state === 'winner') && (
            <div className="relative z-10 w-full" style={{ maxWidth: 640 }}>

              {/* Rectangle card — minimal radius, fixed height */}
              <div className={`relative ${state === 'winner' ? 'shadow-pulse zoom-in' : ''}`}
                style={{
                  height: 380,
                  background: 'linear-gradient(160deg,#1c0c18 0%,#120616 100%)',
                  border: state === 'winner'
                    ? '2px solid color-mix(in srgb, var(--t-hot) 85%, transparent)'
                    : '1.5px solid rgba(255,138,190,0.18)',
                  borderRadius: 6,
                  boxShadow: state === 'winner'
                    ? '0 0 70px color-mix(in srgb, var(--t-deep) 35%, transparent), 0 0 140px color-mix(in srgb, var(--t-violet) 14%, transparent)'
                    : '0 4px 40px rgba(0,0,0,0.6)',
                  transition: 'border-color 0.8s ease, box-shadow 0.8s ease',
                  overflow: 'hidden',
                }}>

                {/* ── SPINNING — animated rings + particles ── */}
                {isSpinning && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    paddingBottom: 48,
                  }}>
                    {/* Particle dots orbiting (decorative) */}
                    {[0,1,2,3,4,5,6,7].map(i => (
                      <div key={i} style={{
                        position: 'absolute',
                        width: i % 2 === 0 ? 5 : 3,
                        height: i % 2 === 0 ? 5 : 3,
                        borderRadius: '50%',
                        background: i % 3 === 0 ? theme.hot : i % 3 === 1 ? theme.mint : theme.light,
                        boxShadow: `0 0 6px ${i % 3 === 0 ? theme.hot : i % 3 === 1 ? theme.mint : theme.light}`,
                        top: `${50 + 38 * Math.sin(i * Math.PI / 4)}%`,
                        left: `${50 + 38 * Math.cos(i * Math.PI / 4)}%`,
                        animation: `starTwinkle ${isFast ? 0.3 + i * 0.06 : 0.8 + i * 0.15}s ease-in-out ${i * 0.1}s infinite`,
                        opacity: 0.7,
                      }} />
                    ))}

                    {/* Ring set */}
                    <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
                      {/* Outer ring */}
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        border: '3px solid rgba(255,138,190,0.12)',
                        borderTopColor: theme.hot,
                        borderRightColor: 'color-mix(in srgb, var(--t-deep) 30%, transparent)',
                        boxShadow: '0 0 24px color-mix(in srgb, var(--t-hot) 50%, transparent)',
                        animation: `orbitSpin ${isFast ? '0.75s' : '2s'} linear infinite`,
                      }} />
                      {/* Mid ring */}
                      <div style={{
                        position: 'absolute', inset: 22, borderRadius: '50%',
                        border: '2.5px solid rgba(255,255,255,0.03)',
                        borderBottomColor: theme.mint,
                        borderLeftColor: 'color-mix(in srgb, var(--t-mint) 30%, transparent)',
                        animation: `orbitSpin ${isFast ? '0.55s' : '1.5s'} linear infinite reverse`,
                      }} />
                      {/* Inner ring */}
                      <div style={{
                        position: 'absolute', inset: 46, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.03)',
                        borderTopColor: theme.light,
                        borderRightColor: 'color-mix(in srgb, var(--t-soft) 28%, transparent)',
                        animation: `orbitSpin ${isFast ? '1s' : '2.7s'} linear infinite`,
                      }} />
                      {/* Innermost ring */}
                      <div style={{
                        position: 'absolute', inset: 66, borderRadius: '50%',
                        border: '1.5px solid color-mix(in srgb, var(--t-hot) 18%, transparent)',
                        borderBottomColor: 'color-mix(in srgb, var(--t-hot) 60%, transparent)',
                        animation: `orbitSpin ${isFast ? '0.4s' : '1.2s'} linear infinite reverse`,
                      }} />
                      {/* Center glow */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          width: 72, height: 72, borderRadius: '50%',
                          background: 'radial-gradient(circle,color-mix(in srgb, var(--t-hot) 25%, transparent) 0%,transparent 70%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '2.4rem',
                          animation: isFast ? 'flameDance 0.5s ease-in-out infinite' : 'floatBob 2s ease-in-out infinite',
                        }}>
                          {isFast ? '🎲' : '🍀'}
                        </div>
                      </div>
                    </div>

                    {/* Names reel removed — the drum spins without showing names */}

                    <p className="font-mono mt-5"
                      style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.4em', textTransform: 'uppercase' }}>
                      {isFast ? `Drawing from ${activeCount}…` : 'Selecting winner…'}
                    </p>
                  </div>
                )}

                {/* ── WINNER — absolute fill, NAME top, code bottom ── */}
                {state === 'winner' && winner && (() => {
                  // A long name must shrink, not wrap tall — wrapping makes the
                  // column out-grow the card and pushes the WINNER badge off
                  // the top. Shorter names keep the heroic size; longer ones
                  // step down so the whole winner block still fits one screen.
                  const len = (winner.name || '').trim().length
                  const nameSize = len <= 12
                    ? 'clamp(2.4rem, 8vw, 4rem)'
                    : len <= 20
                      ? 'clamp(1.9rem, 6vw, 2.8rem)'
                      : 'clamp(1.4rem, 4.5vw, 2.1rem)'
                  return (
                  <div key={winnerKey} style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '20px 36px 52px',
                  }}>
                    {/* Radial glow background */}
                    <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      background: 'radial-gradient(ellipse 90% 70% at center, color-mix(in srgb, var(--t-hot) 16%, transparent) 0%, transparent 70%)',
                      animation: 'drumFlash 2s ease-in-out infinite',
                    }} />

                    {/* Floating sparkle stars inside card */}
                    {['✨','⭐','✦','★','✨','⭐'].map((s, i) => (
                      <div key={i} style={{
                        position: 'absolute', pointerEvents: 'none', zIndex: 1,
                        fontSize: i % 2 === 0 ? '1.1rem' : '0.75rem',
                        top: `${10 + i * 14}%`,
                        left: i < 3 ? `${6 + i * 3}%` : `${82 + (i-3) * 3}%`,
                        color: i % 3 === 0 ? theme.light : i % 3 === 1 ? theme.hot : '#ffffff',
                        animation: `starTwinkle ${1.2 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
                      }}>{s}</div>
                    ))}

                    {/* WINNER label — now prominent */}
                    <div className="relative z-10 flex items-center gap-3 mb-3"
                      style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
                      <span className="swing" style={{ fontSize: '1.1rem', animation: 'flameDance 1.2s ease-in-out infinite' }}>🏆</span>
                      <span className="font-mono font-bold uppercase tracking-[0.3em]"
                        style={{ fontSize: '0.95rem', color: theme.hot, textShadow: '0 0 20px color-mix(in srgb, var(--t-hot) 85%, transparent)' }}>
                        Winner
                      </span>
                      <span style={{ fontSize: '1.1rem', animation: 'flameDance 1.2s ease-in-out 0.4s infinite' }}>🏆</span>
                    </div>

                    {/* NAME — big, white, appears immediately */}
                    <div className="font-display font-black text-center relative z-10 neon-flicker"
                      style={{
                        fontSize: nameSize,
                        lineHeight: 1.15,
                        color: '#ffffff',
                        overflowWrap: 'anywhere',
                        maxWidth: '100%',
                        marginBottom: 14,
                        animation: 'fadeSlideUp 0.4s ease both, nameGlow 2.5s 0.5s ease-in-out infinite',
                        textShadow: '0 0 30px rgba(255,255,255,0.3)',
                      }}>
                      {winner.name || '—'}
                    </div>

                    {/* Tinted banner under the name */}
                    <div className="winner-banner relative z-10 -mx-10 mb-3 px-10 py-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.soft }}>
                        Round {winner.round} of {TOTAL_PRIZES}
                      </span>
                    </div>

                    {/* Prize this draw awarded — prominent display */}
                    <div className="relative z-10 mb-3 bounce-in"
                      style={{
                        animation: 'bounceIn 0.5s 0.2s ease both',
                      }}>
                      <div className="flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-2xl"
                        style={{
                          background: `linear-gradient(135deg, ${theme.hot}30, ${theme.violet}20)`,
                          border: `1px solid ${theme.hot}60`,
                          boxShadow: `0 0 20px ${theme.hot}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
                        }}>
                        <span className="text-xl" style={{ animation: 'iconBounce 1.5s ease-in-out infinite' }}>
                          {PRIZES.find(p => p.label === winner.prize)?.icon ?? '🎁'}
                        </span>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: theme.light }}>
                            WON
                          </div>
                          <div className="font-display font-bold text-sm text-white">{winner.prize}</div>
                        </div>
                        <span className="text-xl" style={{ animation: 'iconBounce 1.5s ease-in-out 0.3s infinite' }}>
                          {PRIZES.find(p => p.label === winner.prize)?.icon ?? '🎁'}
                        </span>
                      </div>
                    </div>

                    {/* Gold divider */}
                    <div style={{
                      width: 0, height: 2, marginBottom: 12, borderRadius: 1,
                      background: 'linear-gradient(90deg,transparent,var(--t-hot),var(--t-light),var(--t-hot),transparent)',
                      boxShadow: '0 0 10px color-mix(in srgb, var(--t-hot) 50%, transparent)',
                      animation: 'barExpand 0.4s ease 0.3s both',
                    }} />

                    {/* CODE — small mono, gold, underneath */}
                    <div className="font-mono text-center relative z-10"
                      style={{
                        fontSize: '0.78rem',
                        lineHeight: 1.6,
                        color: 'color-mix(in srgb, var(--t-soft) 75%, transparent)',
                        letterSpacing: '0.07em',
                        wordBreak: 'break-all',
                        animation: 'fadeSlideUp 0.35s ease 0.35s both',
                      }}>
                      {winner.code}
                    </div>
                  </div>
                  )
                })()}

                {/* ── TIMER BAR — always at very bottom of card ── */}
                {isSpinning && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,138,190,0.1)' }}>
                    <div style={{
                      height: '100%',
                      width: `${drawProgress * 100}%`,
                      background: isFast
                        ? 'linear-gradient(90deg,var(--t-hot),var(--t-light),var(--t-hot))'
                        : 'linear-gradient(90deg,var(--t-hot),var(--t-light))',
                      transition: 'width 0.12s linear',
                      boxShadow: '0 0 8px color-mix(in srgb, var(--t-hot) 70%, transparent)',
                    }} />
                  </div>
                )}
                {state === 'winner' && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'color-mix(in srgb, var(--t-deep) 15%, transparent)' }}>
                    <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg,var(--t-hot),var(--t-light),var(--t-hot))', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite' }} />
                  </div>
                )}
              </div>

              {/* Congrats — below card, fixed space */}
              <div style={{ height: 28, marginTop: 12, textAlign: 'center' }}>
                {state === 'winner' && winner && (
                  <p className="font-mono text-white/25 text-[11px]" style={{ animation: 'fadeSlideUp 0.4s ease 0.6s both', letterSpacing: '0.05em' }}>
                    Congratulations! 🙏 God bless you.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="relative z-10 mt-8 flex gap-3 justify-center flex-wrap">
            {state === 'idle' && !isEmpty && (
              <>
                <button onClick={runDraw}
                  className="px-12 py-4 rounded-full font-black text-white text-lg transition-all hover:scale-110 active:scale-95 cursor-pointer jello"
                  style={{
                    background: 'linear-gradient(135deg,var(--t-hot),var(--t-deep))',
                    boxShadow: '0 8px 48px color-mix(in srgb, var(--t-hot) 55%, transparent)',
                    animation: 'pulse-ring 2.2s ease-in-out infinite',
                    letterSpacing: '0.05em',
                  }}>
                  🎲 Start Draw
                </button>
                {/* Draw All — runs every remaining round unattended, one reveal
                    after another, then lands on the final winner card. */}
                {prizesLeft > 1 && (
                  <button onClick={drawAll}
                    className="px-6 py-3 rounded-full font-semibold text-white/80 text-sm cursor-pointer transition-all hover:scale-105 active:scale-95 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    ⚡ Draw all {Math.max(1, Math.min(prizesLeft, activeCount))} remaining
                  </button>
                )}
              </>
            )}
            {state === 'winner' && (() => {
              // Pool size, not a subtraction, so this stays correct if entries
              // were edited while the winner card was on screen. With repeats
              // on it never runs down, which is the point of the toggle.
              const remaining = activeCount
              return (
              <>
                {remaining > 0 ? (
                  <button onClick={runDraw}
                    className="px-8 py-3 rounded-full font-semibold text-white text-sm cursor-pointer transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg,var(--t-hot),var(--t-violet))', boxShadow: '0 4px 24px color-mix(in srgb, var(--t-violet) 40%, transparent)' }}>
                    🎲 Draw Again ({remaining} left)
                  </button>
                ) : (
                  <span className="font-mono text-white/30 text-xs px-4 py-3">
                    All registered codes have won 🎉
                  </span>
                )}
                <button onClick={reset}
                  className="px-8 py-3 rounded-full font-semibold text-sm cursor-pointer transition-all hover:scale-105 bg-white/10 text-white hover:bg-white/20">
                  Reset
                </button>
              </>
            )})()}
          </div>
        </div>
      </div>
      </div>

      {/* Past winners */}
      {pastWinners.length > 0 && (() => {
        // The full winner list is kept for correctness; only the newest 10
        // are rendered, to match the capped-height list on screen.
        const SHOWN = 10
        const shown = pastWinners.slice(0, SHOWN)
        const total = pastWinners.length
        return (
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Previous Draws</p>
            <button onClick={exportWinners} className="flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10 text-white/40 hover:border-white/25 hover:text-white transition-all cursor-pointer">
              {copied ? '✓ Copied' : 'Copy list'}
            </button>
          </div>
          <div className="panel rounded-2xl overflow-hidden">
            {shown.map((w, i) => {
              return (
                <div key={i} className="flex items-center px-4 gap-3 roll-in"
                  style={{ background: i === 0 ? 'color-mix(in srgb, var(--t-hot) 9%, transparent)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.022)', borderBottom: i < shown.length - 1 ? '1px solid rgba(255,138,190,0.07)' : 'none', animation: 'rowIn 0.4s ease both', animationDelay: `${i * 0.06}s`, minHeight: 52, paddingTop: 8, paddingBottom: 8 }}>
                  <span className="font-mono text-[10px] text-white/25 w-12 text-right flex-shrink-0">#{w.round}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-bold text-white/85 truncate tracking-wide">{w.name || '—'}</div>
                    <div className="font-mono text-[11px] truncate" style={{ color: theme.mint, opacity: 0.7 }}>{w.code}</div>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-1 rounded-full flex-shrink-0 hidden sm:block"
                    style={{ background: 'color-mix(in srgb, var(--t-hot) 16%, transparent)', color: 'color-mix(in srgb, var(--t-soft) 90%, transparent)', border: '1px solid color-mix(in srgb, var(--t-deep) 28%, transparent)' }}>
                    {w.prize}
                  </span>
                  {i === 0 && <span className="text-sm flex-shrink-0" style={{ animation: 'crownBounce 0.6s ease both' }}>🏆</span>}
                </div>
              )
            })}
            {total > SHOWN && (
              <div className="text-center py-2.5 text-xs font-mono text-white/30 border-t border-white/5">
                +{total - SHOWN} earlier winner{total - SHOWN === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
        )
      })()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Persistence — tickets survive a refresh (browser-local only)
// ─────────────────────────────────────────────────────────────────────────────
const ENTRIES_KEY = 'rice-and-shine:entries:v1'

function isTicketEntry(v: unknown): v is TicketEntry {
  return typeof v === 'object' && v !== null
    && typeof (v as TicketEntry).code === 'string'
    && typeof (v as TicketEntry).name === 'string'
}

function loadEntries(): TicketEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isTicketEntry) : []
  } catch {
    // Corrupt or unreadable storage shouldn't stop the app from loading.
    return []
  }
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [entries, setEntries] = useState<TicketEntry[]>(loadEntries)
  // Lives up here rather than in DrawView so it survives switching tabs.
  const [pastWinners, setPastWinners] = useState<Winner[]>([])

  // Undo/redo history is owned here too: as component state inside RegisterView
  // it was discarded on every tab switch, silently breaking both buttons.
  // Seeded from the same array instance `entries` holds, so undo can never
// return to a list that differs from what was loaded.
  const [history, setHistory] = useState<TicketEntry[][]>(() => [entries])
  const [hIdx, setHIdx] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
    } catch {
      // Private mode / quota exceeded — keep working from memory.
    }
  }, [entries])

  const changeEntries = useCallback((next: TicketEntry[]) => {
    // A new edit discards any redo branch.
    const trimmed = history.slice(0, hIdx + 1)
    setHistory([...trimmed, next])
    setHIdx(trimmed.length)
    setEntries(next)
  }, [history, hIdx])

  const undo = useCallback(() => {
    if (hIdx === 0) return
    setHIdx(hIdx - 1)
    setEntries(history[hIdx - 1])
  }, [history, hIdx])

  const redo = useCallback(() => {
    if (hIdx >= history.length - 1) return
    setHIdx(hIdx + 1)
    setEntries(history[hIdx + 1])
  }, [history, hIdx])

  const handleWinner = useCallback((w: Winner) => {
    // Full history is kept: dropping old winners would let them win twice.
    setPastWinners(prev =>
      prev.some(p => p.code.toLowerCase() === w.code.toLowerCase()) ? prev : [w, ...prev]
    )
  }, [])

  const resetWinners = useCallback(() => setPastWinners([]), [])

  // Theme — held here so the toggle on the dashboard recolours every view.
  const [themeName, setThemeName] = useState<ThemeName>('pink')
  const theme = THEMES[themeName]
  const toggleTheme = () => setThemeName(t => (t === 'pink' ? 'yellow' : 'pink'))

  return (
    <div className="min-h-screen relative" style={{
      backgroundColor: '#100814',
      ['--t-hot' as string]: theme.hot,
      ['--t-light' as string]: theme.light,
      ['--t-soft' as string]: theme.soft,
      ['--t-deep' as string]: theme.deep,
      ['--t-violet' as string]: theme.violet,
      ['--t-mint' as string]: theme.mint,
      ['--t-cream' as string]: theme.cream,
    }}>
      <Atmosphere />
      <StarField />
      <FloatingParticles theme={theme} />
      <RisingBubbles theme={theme} />
      <Nav view={view} setView={setView} ticketCount={entries.length} theme={theme} />
      {view === 'dashboard' && <DashboardView entries={entries} pastWinners={pastWinners} setView={setView} theme={theme} themeName={themeName} onToggleTheme={toggleTheme} />}
      {view === 'register'  && <RegisterView entries={entries} onChange={changeEntries} onUndo={undo} onRedo={redo} canUndo={hIdx > 0} canRedo={hIdx < history.length - 1} theme={theme} />}
      {view === 'draw'      && <DrawView entries={entries} pastWinners={pastWinners} onWinner={handleWinner} onResetWinners={resetWinners} theme={theme} />}
      <Footer onNavigate={setView} />
    </div>
  )
}
