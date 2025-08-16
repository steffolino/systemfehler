<script setup lang="ts">
/**
 * Props:
 *  - max (px): max rendered width, default 720
 *  - ariaLabel: fallback if no i18n available
 */
const props = withDefaults(defineProps<{
  max?: number
  ariaLabel?: string
}>(), { max: 720, ariaLabel: 'Find help faster' })
</script>

<template>
  <div class="w-full flex items-center justify-center my-2">
    <svg
      class="hero-svg"
      :style="{ maxWidth: `min(90vw, ${props.max}px)` }"
      viewBox="0 0 600 600"
      role="img"
      :aria-label="$t ? $t('heroTitle') : props.ariaLabel"
    >
      <defs>
        <!-- Theme-driven gradient -->
        <radialGradient id="g" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   style="stop-color: var(--g0)" />
          <stop offset="45%"  style="stop-color: var(--g1)" />
          <stop offset="100%" style="stop-color: var(--g2)" />
        </radialGradient>

        <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- background glow -->
      <g opacity="0.22" filter="url(#soft-glow)">
        <circle cx="300" cy="300" r="190" fill="url(#g)"/>
      </g>

    <!-- lens + animated center ring highlight -->
      <g class="lens float">
        <circle cx="300" cy="300" r="86" class="lens-bg"/>
        <circle cx="300" cy="300" r="48" fill="none" stroke="white" stroke-width="2"/>
      </g>


      <!-- concentric pulses -->
      <g fill="none" stroke="url(#g)" stroke-width="2">
        <circle cx="300" cy="300" r="210" class="pulse"/>
        <circle cx="300" cy="300" r="250" class="pulse delay-1"/>
        <circle cx="300" cy="300" r="290" class="pulse delay-2"/>
      </g>

      <!-- ===== ORBIT LANES (inner faster, outer slower; mixed directions) ===== -->
      <!-- lane radii: 120, 150, 185, 220, 255 -->
      <!-- Lane 1 — fastest, CW -->
      <g class="orbit lane-1 cw" transform-origin="300 300">
        <g transform="rotate(0,300,300)"><circle cx="300" cy="180" r="5"  class="c-p"/></g>
        <g transform="rotate(72,300,300)"><circle cx="300" cy="180" r="4.5" class="c-s"/></g>
        <g transform="rotate(144,300,300)"><circle cx="300" cy="180" r="4.5" class="c-a"/></g>
        <g transform="rotate(216,300,300)"><circle cx="300" cy="180" r="4.5" class="c-p" opacity=".85"/></g>
        <g transform="rotate(288,300,300)"><circle cx="300" cy="180" r="4.5" class="c-s" opacity=".85"/></g>
      </g>

      <!-- Lane 2 — medium-fast, CCW -->
      <g class="orbit lane-2 ccw" transform-origin="300 300">
        <g transform="rotate(30,300,300)"><circle cx="300" cy="150" r="5"   class="c-s"/></g>
        <g transform="rotate(90,300,300)"><circle cx="300" cy="150" r="4.5" class="c-a"/></g>
        <g transform="rotate(150,300,300)"><circle cx="300" cy="150" r="4.5" class="c-p"/></g>
        <g transform="rotate(210,300,300)"><circle cx="300" cy="150" r="4.5" class="c-a"/></g>
        <g transform="rotate(270,300,300)"><circle cx="300" cy="150" r="4.5" class="c-s"/></g>
      </g>

      <!-- Lane 3 — medium, CW -->
      <g class="orbit lane-3 cw" transform-origin="300 300">
        <g transform="rotate(15,300,300)"><circle cx="300" cy="115" r="5"   class="c-a"/></g>
        <g transform="rotate(75,300,300)"><circle cx="300" cy="115" r="4.5" class="c-p"/></g>
        <g transform="rotate(135,300,300)"><circle cx="300" cy="115" r="4.5" class="c-s"/></g>
        <g transform="rotate(195,300,300)"><circle cx="300" cy="115" r="4.5" class="c-a"/></g>
        <g transform="rotate(255,300,300)"><circle cx="300" cy="115" r="4.5" class="c-p"/></g>
      </g>

      <!-- Lane 4 — medium-slow, CCW -->
      <g class="orbit lane-4 ccw" transform-origin="300 300">
        <g transform="rotate(0,300,300)"><circle cx="300" cy="80"  r="5"   class="c-p" opacity=".9"/></g>
        <g transform="rotate(60,300,300)"><circle cx="300" cy="80"  r="4.5" class="c-s" opacity=".9"/></g>
        <g transform="rotate(120,300,300)"><circle cx="300" cy="80"  r="4.5" class="c-a" opacity=".9"/></g>
        <g transform="rotate(180,300,300)"><circle cx="300" cy="80"  r="4.5" class="c-p" opacity=".9"/></g>
        <g transform="rotate(240,300,300)"><circle cx="300" cy="80"  r="4.5" class="c-s" opacity=".9"/></g>
        <g transform="rotate(300,300,300)"><circle cx="300" cy="80"  r="4.5" class="c-a" opacity=".9"/></g>
      </g>

      <!-- Lane 5 — slowest, CW -->
      <g class="orbit lane-5 cw" transform-origin="300 300">
        <g transform="rotate(0,300,300)"><circle cx="300" cy="45" r="5"   class="c-s"/></g>
        <g transform="rotate(60,300,300)"><circle cx="300" cy="45" r="4.5" class="c-a"/></g>
        <g transform="rotate(120,300,300)"><circle cx="300" cy="45" r="4.5" class="c-p"/></g>
        <g transform="rotate(180,300,300)"><circle cx="300" cy="45" r="4.5" class="c-s"/></g>
        <g transform="rotate(240,300,300)"><circle cx="300" cy="45" r="4.5" class="c-a"/></g>
        <g transform="rotate(300,300,300)"><circle cx="300" cy="45" r="4.5" class="c-p"/></g>
      </g>

      <!-- sparkles (pulled in, even 4-quadrant layout) -->
      <g class="sparkles" stroke="white" stroke-linecap="round" opacity="0.9">
        <g class="twinkle"        transform="translate(420 210)"><line x1="-6" y1="0" x2="6" y2="0" stroke-width="2"/><line x1="0" y1="-6" x2="0" y2="6" stroke-width="2"/></g>
        <g class="twinkle delay1" transform="translate(200 210)"><line x1="-5" y1="0" x2="5" y2="0" stroke-width="2"/><line x1="0" y1="-5" x2="0" y2="5" stroke-width="2"/></g>
        <g class="twinkle delay2" transform="translate(420 390)"><line x1="-4" y1="0" x2="4" y2="0" stroke-width="2"/><line x1="0" y1="-4" x2="0" y2="4" stroke-width="2"/></g>
        <g class="twinkle delay3" transform="translate(200 390)"><line x1="-4" y1="0" x2="4" y2="0" stroke-width="2"/><line x1="0" y1="-4" x2="0" y2="4" stroke-width="2"/></g>
      </g>


      <!-- dashed ring (outer) -->
      <g class="spin-slow" transform-origin="300 300">
        <circle cx="300" cy="300" r="160" fill="none" stroke="white" stroke-opacity="0.45" stroke-dasharray="6 10"/>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.hero-svg {
  height: auto;

  /* map theme vars to local gradient stops */
  --g0: hsl(var(--p));
  --g1: hsl(var(--s));
  --g2: hsl(var(--a));

  --pulse: 3.6s;
  --float: 4.8s;
  --twinkle: 2.8s;
}

/* SVG transform boilerplate */
.pulse, .orbit, .spin-slow, .lens, .twinkle, .sweep-ring {
  transform-box: fill-box;
  transform-origin: center;
}

/* Theme-driven fills for dots */
.c-p { fill: hsl(var(--p)); }
.c-s { fill: hsl(var(--s)); }
.c-a { fill: hsl(var(--a)); }

/* ===== base animations ===== */
@keyframes pulse-kf {
  0%   { opacity:.12; transform: scale(.965); }
  50%  { opacity:.45; transform: scale(1.02); }
  100% { opacity:.12; transform: scale(.965); }
}
.pulse { animation: pulse-kf var(--pulse) ease-in-out infinite; }
.pulse.delay-1 { animation-delay: .6s; }
.pulse.delay-2 { animation-delay: 1.2s; }

@keyframes orbit-cw  { to { transform: rotate(360deg); } }
@keyframes orbit-ccw { to { transform: rotate(-360deg); } }

/* orbit lanes: inner faster → outer slower */
.orbit { animation-timing-function: linear; animation-iteration-count: infinite; }
.lane-1 { animation-duration: 10s; }
.lane-2 { animation-duration: 14s; }
.lane-3 { animation-duration: 18s; }
.lane-4 { animation-duration: 24s; }
.lane-5 { animation-duration: 32s; }
.cw  { animation-name: orbit-cw; }
.ccw { animation-name: orbit-ccw; }

/* outer dashed ring */
@keyframes spin-slow-kf { to { transform: rotate(-360deg); } }
.spin-slow { animation: spin-slow-kf 28s linear infinite; }

/* twinkles */
@keyframes twinkle-kf {
  0%, 100% { opacity:.25; transform: scale(.9); }
  50%      { opacity:.95; transform: scale(1.15); }
}
.twinkle { animation: twinkle-kf var(--twinkle) ease-in-out infinite; }
.twinkle.delay1 { animation-delay: .5s; }
.twinkle.delay2 { animation-delay: 1.0s; }
.twinkle.delay3 { animation-delay: 1.5s; }

/* center lens */
.lens-bg { fill: hsla(var(--b1) / 0.08); }
:global(html[data-theme='dark']) .lens-bg { fill: hsla(var(--b1) / 0.06); }

/* center “sparkle ring” — reliable, theme gradient, rotates smoothly */
.sweep-ring {
  fill: rgba(250,250,250,0.9);
  stroke: url(#g);
  stroke-width: 16;
  stroke-linecap: round;
  /* circumference ~ 427 (2π·68). Short arc + big gap looks like a highlight */
  stroke-dasharray: 56 371;
  animation: ring-rot 7s linear infinite, ring-pulse 3.5s ease-in-out infinite;
}
@keyframes ring-rot { to { transform: rotate(360deg); } }
@keyframes ring-pulse { 50% { stroke-dasharray: 78 349; } }

/* gentle float for the whole lens */
@keyframes float-kf {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
.float { animation: float-kf var(--float) ease-in-out infinite; }
</style>
