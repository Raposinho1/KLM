import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, Play, Pause, Plus, X, Timer, SlidersHorizontal, Waves, Leaf, CloudRain, Wind, Trees, Moon, Sun, Volume2, RotateCcw, Headphones, Sparkles, Check, Download, Menu } from 'lucide-react'
import { audioEngine, type Layer, type SoundKind } from './audio'

const soundInfo: Record<SoundKind, { name: string; note: string; icon: typeof Waves; color: string }> = {
  white: { name: 'Blanco', note: 'Todas las frecuencias', icon: Waves, color: '#d7d9d1' },
  pink: { name: 'Rosa', note: 'Equilibrado y suave', icon: Waves, color: '#d9a8a5' },
  blue: { name: 'Azul', note: 'Brillante y definido', icon: Waves, color: '#9ebbd0' },
  brown: { name: 'Marrón', note: 'Profundo y envolvente', icon: Waves, color: '#b78e70' },
  green: { name: 'Verde', note: 'Medios naturales', icon: Leaf, color: '#9eaf83' },
  rain: { name: 'Lluvia', note: 'Lluvia constante', icon: CloudRain, color: '#9eb7b3' },
  wind: { name: 'Viento', note: 'Brisa grave y suave', icon: Wind, color: '#b4c2a8' },
  forest: { name: 'Bosque', note: 'Ambiente natural', icon: Trees, color: '#829b78' }
}
const groups = [
  { title: 'RUIDO', items: ['white','pink','blue','brown','green'] as SoundKind[] },
  { title: 'NATURALEZA', items: ['rain','wind','forest'] as SoundKind[] }
]
const presets = [
  { name: 'Enfoque profundo', description: 'Rosa + lluvia suave', layers: [{kind:'pink' as SoundKind,gain:.35},{kind:'rain' as SoundKind,gain:.2}], duration:50 },
  { name: 'Lectura tranquila', description: 'Ruido marrón', layers: [{kind:'brown' as SoundKind,gain:.42}], duration:25 },
  { name: 'Bosque al atardecer', description: 'Bosque + viento', layers: [{kind:'forest' as SoundKind,gain:.22},{kind:'wind' as SoundKind,gain:.2}], duration:0 },
  { name: 'Descanso', description: 'Lluvia y ruido rosa', layers: [{kind:'rain' as SoundKind,gain:.25},{kind:'pink' as SoundKind,gain:.16}], duration:0 }
]

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2,'0')
  const s = (seconds % 60).toString().padStart(2,'0')
  return `${m}:${s}`
}

export default function App() {
  const [layers, setLayers] = useState<Layer[]>([])
  const [playing, setPlaying] = useState(false)
  const [master, setMaster] = useState(80)
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 })
  const [timer, setTimer] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [activeTab, setActiveTab] = useState<'sound'|'sessions'>('sound')
  const [showEQ, setShowEQ] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [dark, setDark] = useState(false)
  const [toast, setToast] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const layersRef = useRef(layers)
  layersRef.current = layers

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2300)
  }

  const addLayer = useCallback(async (kind: SoundKind, gain = 0.35) => {
    try {
      const layer = await audioEngine.addLayer(kind, gain)
      setLayers(prev => [...prev, layer])
      setPlaying(true)
    } catch (error) {
      console.error(error)
      notify('No se ha podido iniciar el audio. Prueba de nuevo.')
    }
  }, [])

  const removeLayer = (id: string) => {
    audioEngine.removeLayer(id)
    setLayers(prev => prev.filter(layer => layer.id !== id))
    if (layers.length <= 1) setPlaying(false)
  }

  const toggleLayer = (id: string) => {
    const active = audioEngine.toggleLayer(id)
    setLayers(prev => prev.map(l => l.id === id ? { ...l, active: active ?? l.active } : l))
  }

  const changeGain = (id: string, value: number) => {
    audioEngine.setGain(id, value)
    setLayers(prev => prev.map(l => l.id === id ? { ...l, gain: value } : l))
  }

  const togglePlayback = async () => {
    if (layers.length === 0) {
      await addLayer('pink')
      return
    }
    if (!audioEngine.context) return
    if (playing) {
      layers.forEach(l => { if (l.active) audioEngine.toggleLayer(l.id) })
      setLayers(prev => prev.map(l => ({...l, active: false})))
      setPlaying(false)
    } else {
      if (audioEngine.context.state === 'suspended') await audioEngine.context.resume()
      layers.forEach(l => {
        const current = audioEngine.layers.get(l.id)
        if (current && !current.active) audioEngine.toggleLayer(l.id)
      })
      setLayers(prev => prev.map(l => ({...l, active: true})))
      setPlaying(true)
    }
  }

  const loadPreset = async (preset: typeof presets[number]) => {
    await audioEngine.stopAll()
    setLayers([])
    for (const item of preset.layers) {
      const layer = await audioEngine.addLayer(item.kind, item.gain)
      setLayers(prev => [...prev, layer])
    }
    setPlaying(true)
    if (preset.duration) {
      setTimer(preset.duration)
      setRemaining(preset.duration * 60)
      setTimerActive(true)
    } else {
      setTimer(0); setRemaining(0); setTimerActive(false)
    }
    setActiveTab('sound')
    notify(`Sesión «${preset.name}» preparada`)
  }

  useEffect(() => {
    if (!timerActive || remaining <= 0) return
    const id = window.setInterval(() => setRemaining(v => Math.max(0, v - 1)), 1000)
    return () => window.clearInterval(id)
  }, [timerActive, remaining > 0])

  useEffect(() => {
    if (timerActive && remaining === 0) {
      setTimerActive(false)
      const ctx = audioEngine.context
      if (ctx) {
        layersRef.current.forEach(l => {
          const node = audioEngine.layers.get(l.id)?.gainNode
          if (node) node.gain.setTargetAtTime(0, ctx.currentTime, 2)
        })
        window.setTimeout(() => {
          audioEngine.stopAll()
          setLayers([])
          setPlaying(false)
        }, 7000)
      }
      notify('Sesión terminada. Buen descanso.')
    }
  }, [remaining, timerActive])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    const draw = () => {
      const width = canvas.clientWidth * window.devicePixelRatio
      const height = canvas.clientHeight * window.devicePixelRatio
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      ctx.clearRect(0,0,width,height)
      const analyser = audioEngine.analyser
      const data = new Uint8Array(analyser?.frequencyBinCount || 128)
      if (playing && analyser) analyser.getByteTimeDomainData(data)
      else for (let i=0;i<data.length;i++) data[i] = 128 + Math.sin(i*.13 + frame*.018)*2
      ctx.beginPath()
      const step = width / (data.length - 1)
      for (let i=0;i<data.length;i++) {
        const x = i*step
        const amp = playing ? (data[i]-128)/128 : Math.sin(i*.08+frame*.015)*.018
        const y = height/2 + amp*height*.38
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      }
      ctx.strokeStyle = dark ? '#b4c49b' : '#748d71'
      ctx.lineWidth = 2*window.devicePixelRatio
      ctx.lineCap = 'round'
      ctx.stroke()
      frame++
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, dark])

  useEffect(() => {
    audioEngine.setMaster(master / 100)
  }, [master])
  useEffect(() => {
    audioEngine.setEQ('low', eq.low)
    audioEngine.setEQ('mid', eq.mid)
    audioEngine.setEQ('high', eq.high)
  }, [eq])

  const activeCount = layers.filter(l => l.active).length
  const totalDuration = timer > 0 ? timer * 60 : 0
  const progress = totalDuration ? 1 - remaining / totalDuration : 0

  return (
    <div className={`app-shell ${dark ? 'night' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Quiet Field inicio">
          <span className="brand-mark"><Waves size={19}/></span>
          <span>quiet<span className="brand-light">field</span><small>AN AMBIENT SOUND SPACE</small></span>
        </a>
        <nav className="main-nav">
          <button className={activeTab==='sound'?'nav-active':''} onClick={()=>setActiveTab('sound')}>Escuchar</button>
          <button className={activeTab==='sessions'?'nav-active':''} onClick={()=>setActiveTab('sessions')}>Sesiones</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" title="Ecualizador" onClick={()=>setShowEQ(v=>!v)}><SlidersHorizontal size={18}/></button>
          <button className="icon-button" title="Cambiar apariencia" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
        </div>
      </header>

      <main className="main-content">
        <section className="intro">
          <div className="eyebrow"><span className="eyebrow-dot"/> TU ESPACIO, TU RITMO</div>
          <h1>Encuentra tu<br/><em>propio silencio.</em></h1>
          <p>Un paisaje sonoro para acompañar lo que necesitas.<br className="desktop-break"/> Sin distracciones. Sin prisa. Solo escucha.</p>
        </section>

        <section className="player-card">
          <div className="player-topline">
            <span><span className={`status-dot ${playing?'is-playing':''}`}/>{playing?'REPRODUCIENDO':'EN PAUSA'}</span>
            <span>{activeCount} {activeCount===1?'CAPA ACTIVA':'CAPAS ACTIVAS'}</span>
          </div>
          <div className="visualizer-wrap">
            <canvas ref={canvasRef} className="visualizer" aria-label="Visualizador de sonido"/>
            <div className="visualizer-label"><span>AMBIENT FIELD</span><span>{playing?'● LIVE':'○ READY'}</span></div>
          </div>
          <div className="player-controls">
            <div className="master-control">
              <Volume2 size={17}/>
              <input aria-label="Volumen general" type="range" min="0" max="100" value={master} onChange={e=>setMaster(Number(e.target.value))}/>
              <span>{master}%</span>
            </div>
            <button className="play-button" onClick={togglePlayback} aria-label={playing?'Pausar':'Reproducir'}>
              {playing?<Pause fill="currentColor" size={21}/>:<Play fill="currentColor" size={21}/>}
            </button>
            <button className="reset-button" onClick={async()=>{await audioEngine.stopAll();setLayers([]);setPlaying(false);setTimerActive(false);setRemaining(0)}} title="Detener y limpiar"><RotateCcw size={17}/></button>
          </div>
          {timerActive && <div className="timer-progress"><div style={{width:`${progress*100}%`}}/></div>}
        </section>

        {activeTab === 'sound' ? (
          <>
            <section className="section-block">
              <div className="section-heading"><div><span className="section-kicker">01 / EXPLORA</span><h2>Elige tu ambiente</h2></div><span className="muted-count">08 SONIDOS</span></div>
              {groups.map(group=><div className="sound-group" key={group.title}>
                <div className="group-label">{group.title}</div>
                <div className="sound-grid">
                  {group.items.map(kind=>{
                    const info=soundInfo[kind], Icon=info.icon
                    const selected=layers.some(l=>l.kind===kind)
                    return <button className={`sound-tile ${selected?'selected':''}`} key={kind} onClick={()=>selected?removeLayer(layers.find(l=>l.kind===kind)!.id):addLayer(kind)}>
                      <span className="sound-icon" style={{'--sound-color':info.color} as React.CSSProperties}><Icon size={20}/></span>
                      <span className="sound-name">{info.name}</span>
                      <span className="sound-note">{info.note}</span>
                      {selected&&<span className="selected-mark"><Check size={12}/></span>}
                    </button>
                  })}
                </div>
              </div>)}
            </section>

            <section className="section-block mixer-section">
              <div className="section-heading"><div><span className="section-kicker">02 / MEZCLA</span><h2>Tu paisaje sonoro</h2></div><span className="muted-count">{layers.length} CAPAS</span></div>
              {layers.length===0 ? <div className="empty-state"><AudioLines size={24}/><span>Aún no hay sonidos. Añade uno para empezar a crear tu ambiente.</span></div> :
                <div className="layer-list">{layers.map(layer=>{
                  const info=soundInfo[layer.kind], Icon=info.icon
                  return <div className={`layer-row ${!layer.active?'layer-muted':''}`} key={layer.id}>
                    <button className="layer-toggle" onClick={()=>toggleLayer(layer.id)}>{layer.active?<Pause size={14}/>:<Play size={14}/>}</button>
                    <span className="layer-symbol" style={{color:info.color}}><Icon size={18}/></span>
                    <div className="layer-info"><strong>{info.name}</strong><small>{info.note}</small></div>
                    <input aria-label={`Volumen ${info.name}`} type="range" min="0" max="1" step=".01" value={layer.gain} onChange={e=>changeGain(layer.id,Number(e.target.value))}/>
                    <span className="layer-percent">{Math.round(layer.gain*100)}%</span>
                    <button className="remove-layer" aria-label={`Quitar ${info.name}`} onClick={()=>removeLayer(layer.id)}><X size={16}/></button>
                  </div>
                })}</div>}
              <button className="add-layer-button" onClick={()=>document.querySelector('.sound-group')?.scrollIntoView({behavior:'smooth',block:'center'})}><Plus size={15}/> Añadir otra capa</button>
            </section>

            {showEQ && <section className="section-block eq-panel">
              <div className="section-heading"><div><span className="section-kicker">03 / AJUSTE FINO</span><h2>Ecualizador</h2></div><button className="text-button" onClick={()=>setEq({low:0,mid:0,high:0})}>Restablecer</button></div>
              {(['low','mid','high'] as const).map((band,i)=><div className="eq-row" key={band}><span>{['Graves','Medios','Agudos'][i]}</span><input type="range" min="-12" max="12" value={eq[band]} onChange={e=>setEq(v=>({...v,[band]:Number(e.target.value)}))}/><b>{eq[band]>0?'+':''}{eq[band]} dB</b></div>)}
            </section>}
          </>
        ) : (
          <section className="section-block sessions-view">
            <div className="section-heading"><div><span className="section-kicker">01 / RITUALES</span><h2>El tiempo que necesitas</h2></div></div>
            <p className="sessions-intro">Pequeños espacios para volver a ti. Elige un ambiente y deja que el tiempo haga su trabajo.</p>
            <div className="preset-grid">{presets.map(p=><button className="preset-card" key={p.name} onClick={()=>loadPreset(p)}><span className="preset-icon"><Sparkles size={18}/></span><strong>{p.name}</strong><small>{p.description}</small><span className="preset-duration">{p.duration?p.duration+' MIN':'SIN LÍMITE'} <span>↗</span></span></button>)}</div>
            <div className="timer-card">
              <div><span className="section-kicker">TEMPORIZADOR</span><h3>{remaining?formatTime(remaining):'Sin límite de tiempo'}</h3><p>El sonido se desvanecerá suavemente al terminar.</p></div>
              <div className="timer-options">{[15,25,45,60,90].map(min=><button className={timer===min?'chosen':''} key={min} onClick={()=>{setTimer(min);setRemaining(min*60);setTimerActive(false)}}>{min}′</button>)}</div>
              <div className="timer-actions"><button className="primary-button" onClick={()=>{if(timer===0){setTimer(25);setRemaining(1500)}setTimerActive(true);notify('Temporizador iniciado')}}><Timer size={16}/> Iniciar temporizador</button><button className="secondary-button" onClick={()=>{setTimerActive(false);setTimer(0);setRemaining(0)}}>Desactivar</button></div>
            </div>
          </section>
        )}

        <section className="bottom-note"><span className="note-icon"><Leaf size={17}/></span><p>Diseñado para acompañarte, no para interrumpirte.<br/><strong>Escucha a tu manera.</strong></p><span className="note-end">QF / 001</span></section>
      </main>

      <footer><span>QUIET FIELD © 2026</span><span>HECHO PARA ESCUCHAR · NO PARA MIRAR</span><span>100% GRATUITO</span></footer>
      {toast&&<div className="toast"><Check size={15}/>{toast}</div>}
      <button className="mobile-timer" onClick={()=>{setActiveTab('sessions');window.scrollTo({top:0,behavior:'smooth'})}}><Timer size={18}/></button>
    </div>
  )
}
