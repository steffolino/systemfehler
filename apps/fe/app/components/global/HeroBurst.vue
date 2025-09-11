<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  max?: number
  ratio?: '3:1' | '21:9'
  starCount?: number
  parallax?: number    // 0..1
  blinkMin?: number    // 0..1
  logoSrc?: string
}>(), {
  max: 1200,
  ratio: '3:1',
  starCount: 110,
  parallax: 0.25,
  blinkMin: 0.25,
  logoSrc: '/img/web-app-manifest-512x512.png'
})

const wrapRef = ref<HTMLDivElement|null>(null)
const canvasRef = ref<HTMLCanvasElement|null>(null)
const bgRef = ref<HTMLDivElement|null>(null)
let ctx: CanvasRenderingContext2D|null = null
let stars: {x:number,y:number,r:number,phase:number,speed:number}[] = []
let raf = 0
let scrollY = 0
let resizeObs: ResizeObserver | null = null

/* === utils =============================================================== */
function lerp(a:number,b:number,t:number){ return a+(b-a)*t }
function clamp(v:number,a=0,b=1){ return Math.min(b,Math.max(a,v)) }
function rgbToHex(r:number,g:number,b:number){
  return '#'+[r,g,b].map(n=>Math.round(n).toString(16).padStart(2,'0')).join('')
}
function darken(hex:string, amt=0.18){
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if(!m) return hex
  const r = Math.max(0, parseInt(m[1],16)*(1-amt))
  const g = Math.max(0, parseInt(m[2],16)*(1-amt))
  const b = Math.max(0, parseInt(m[3],16)*(1-amt))
  return rgbToHex(r,g,b)
}

/* sample dominant-ish color from the logo (fast average of dark pixels) */
async function sampleLogoBlue(src:string): Promise<string> {
  return new Promise((resolve)=>{
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => {
      const w = 64, h = 64
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const cctx = c.getContext('2d')!
      cctx.drawImage(img, 0, 0, w, h)
      const data = cctx.getImageData(0,0,w,h).data
      let r=0,g=0,b=0,n=0
      for(let i=0;i<data.length;i+=4){
        const R=data[i], G=data[i+1], B=data[i+2], A=data[i+3]
        if(A<200) continue          // ignore transparent
        const l = 0.2126*R+0.7152*G+0.0722*B
        if(l>120) continue          // keep only darker pixels → background navy
        r+=R; g+=G; b+=B; n++
      }
      if(!n){ resolve(getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#112633'); return }
      resolve(rgbToHex(r/n, g/n, b/n))
    }
    img.onerror = () => resolve('#112633')
  })
}

/* === stars ============================================================== */
function initStars(width:number,height:number,count:number) {
  stars = Array.from({length:count},()=>({
    x: Math.random()*width,
    y: Math.random()*height,
    r: Math.random()*1.4+0.6,
    phase: Math.random()*Math.PI*2,
    speed: 0.01 + Math.random()*0.02
  }))
}
function draw() {
  if (!ctx || !canvasRef.value) return
  const {width,height} = canvasRef.value
  ctx.clearRect(0,0,width,height)
  const offsetY = scrollY * props.parallax

  for (const s of stars){
    s.phase += s.speed
    const alpha = props.blinkMin + (1-props.blinkMin)*Math.abs(Math.sin(s.phase))
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(s.x, s.y + offsetY, s.r, 0, Math.PI*2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  raf = requestAnimationFrame(draw)
}

/* === layout / lifecycle ================================================ */
function fitCanvas(){
  if(!canvasRef.value) return
  const el = canvasRef.value
  const box = el.getBoundingClientRect()
  el.width = Math.max(1, Math.floor(box.width))
  el.height = Math.max(1, Math.floor(box.height))
  initStars(el.width, el.height, props.starCount)
}

function onScroll(){ scrollY = window.scrollY }

onMounted(async ()=>{
  // set background from sampled logo navy + vignette
  const base = await sampleLogoBlue(props.logoSrc)      // e.g. #0f2236
  const dark = darken(base, 0.22)                       // vignette target
  if (bgRef.value){
    bgRef.value.style.setProperty('--bg-base', base)
    bgRef.value.style.setProperty('--bg-dark', dark)
  }

  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  fitCanvas()
  draw()

  resizeObs = new ResizeObserver(()=>{ fitCanvas() })
  resizeObs.observe(wrapRef.value!)
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(()=>{
  cancelAnimationFrame(raf)
  window.removeEventListener('scroll', onScroll)
  resizeObs?.disconnect()
})
</script>

<template>
  <!-- 3:1, wide, centered -->
  <div
ref="wrapRef"
       class="relative w-full mx-auto overflow-hidden rounded-xl"
       :style="{ maxWidth: `min(95vw, ${max}px)`, paddingTop: ratio==='21:9' ? '42.85%' : '33.333%' }">
    <!-- background: sampled blue + vignette -->
    <div ref="bgRef" class="absolute inset-0 bg-[var(--bg-base)]">
      <div
class="absolute inset-0 pointer-events-none"
           style="background:
             radial-gradient(120% 120% at 50% 50%, transparent 40%, rgba(0,0,0,0.28) 100%),
             radial-gradient(140% 140% at 50% 70%, var(--bg-base) 0%, var(--bg-dark) 100%);"/>
    </div>

    <!-- centered logo (keeps original PNG), sits below stars -->
    <img
:src="logoSrc" alt="Systemfehler Logo"
         class="absolute inset-0 m-auto h-full object-contain z-10" >

    <!-- stars overlay -->
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full pointer-events-none z-20"/>
  </div>
</template>

<style scoped>
/* fallback if sampling fails */
:host { --bg-base: var(--color-primary); --bg-dark: #0a1320; }
</style>
