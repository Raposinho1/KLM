import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AudioLines, Play, Pause, Plus, X, Timer, SlidersHorizontal, Waves, Leaf, CloudRain, Wind, Trees, Moon, Sun, Volume2, RotateCcw, Sparkles, Check, Bookmark, Trash2 } from 'lucide-react'
import { audioEngine, type Layer, type SoundKind } from './audio'

const soundInfo: Record<SoundKind, { name: string; note: string; icon: typeof Waves; color: string }> = {
  white: { name: 'Blanco', note: 'Todas las frecuencias', icon: Waves, color: '#d7d9d1' },
  pink: { name: 'Rosa', note: 'Equilibrado y suave', icon: Waves, color: '#d9a8a5' },
  blue: { name: 'Azul', note: 'Brillante y definido', icon: Waves, color: '#9ebbd0' },
  brown: { name: 'Marrón', note: 'Profundo y envolvente', icon: Waves, color: '#b78e70' },
  green: { name: 'Verde', note: 'Medios naturales', icon: Leaf, color: '#9eaf83' },
  rain: { name: 'Lluvia', note: 'Lluvia constante', icon: CloudRain, color: '#9eb7b3' },
  wind: { name: 'Viento', note: 'Brisa grave y suave', icon: Wind, color: '#b4c2a8' },
  forest: { name: 'Bosque', note: 'Ambiente natural', icon: Trees, color: '#829b78' },
  delta: { name: 'Delta · 2 Hz', note: 'Ritmo binaural lento', icon: Waves, color: '#8e9ebd' },
  theta: { name: 'Theta · 6 Hz', note: 'Ritmo binaural suave', icon: Waves, color: '#a79ac4' },
  alpha: { name: 'Alfa · 10 Hz', note: 'Ritmo binaural relajado', icon: Waves, color: '#9eaf83' },
  beta: { name: 'Beta · 20 Hz', note: 'Ritmo binaural rápido', icon: Waves, color: '#d2a36e' },
  gamma: { name: 'Gamma · 40 Hz', note: 'Ritmo binaural rápido', icon: Waves, color: '#c58e91' }
}
const groups = [
  { title: 'RUIDO', items: ['white','pink','blue','brown','green'] as SoundKind[] },
  { title: 'NATURALEZA', items: ['rain','wind','forest'] as SoundKind[] },
  { title: 'TONOS BINAURALES', items: ['delta','theta','alpha','beta','gamma'] as SoundKind[] }
]
type Preset = { name: string; description: string; layers: { kind: SoundKind; gain: number }[]; duration: number }

const presets: Preset[] = [
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
  const [master, setMaster] = useState(() => Number(localStorage.getItem('klm-volume') || 80))
  const [eq, setEq] = useState(() => {
    try { return JSON.parse(localStorage.getItem('klm-eq') || '{"low":0,"mid":0,"high":0}') as { low: number; mid: number; high: number } } catch { return { low: 0, mid: 0, high: 0 } }
  })
  const [timer, setTimer] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [activeTab, setActiveTab] = useState<'sound'|'sessions'>('sound')
  const [showEQ, setShowEQ] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('klm-theme') === 'dark')
  const [fadeSeconds, setFadeSeconds] = useState(() => Number(localStorage.getItem('klm-fade') || 2))
  const [customPresets, setCustomPresets] = useState<Preset[]>(() => {
    try { return JSON.parse(localStorage.getItem('klm-presets') || '[]') as Preset[] } catch { return [] }
  })
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
      const layer = await audioEngine.addLayer(kind, gain, fadeSeconds)
      audioEngine.setMaster(master / 100)
      audioEngine.setEQ('low', eq.low); audioEngine.setEQ('mid', eq.mid); audioEngine.setEQ('high', eq.high)
      setLayers(prev => [...prev, layer])
      setPlaying(true)
    } catch (error) {
      console.error(error)
      notify('No se ha podido iniciar el audio. Prueba de nuevo.')
    }
  }, [fadeSeconds, master, eq])

  const removeLayer = (id: string) => {
    audioEngine.removeLayer(id, fadeSeconds)
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

  const loadPreset = async (preset: Preset) => {
    await audioEngine.stopAll()
    setLayers([])
    for (const item of preset.layers) {
      const layer = await audioEngine.addLayer(item.kind, item.gain, fadeSeconds)
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
      audioEngine.fadeOutAll(fadeSeconds)
      window.setTimeout(() => {
        audioEngine.stopAll(0.08)
        setLayers([])
        setPlaying(false)
      }, Math.max(250, fadeSeconds * 1000 + 150))
      notify('Sesión terminada. Buen descanso.')
    }
  }, [remaining, timerActive, fadeSeconds])

  useEffect(() => {
    localStorage.setItem('klm-theme', dark ? 'dark' : 'light')
    localStorage.setItem('klm-volume', String(master))
    localStorage.setItem('klm-eq', JSON.stringify(eq))
    localStorage.setItem('klm-fade', String(fadeSeconds))
    localStorage.setItem('klm-presets', JSON.stringify(customPresets))
  }, [dark, fadeSeconds, customPresets, master, eq])

  const saveCurrentMix = () => {
    if (!layers.length) { notify('Añade algún sonido antes de guardar la mezcla.'); return }
    const name = window.prompt('Nombre para esta mezcla:')
    if (!name?.trim()) return
    const saved: Preset = {
      name: name.trim().slice(0, 32),
      description: layers.map(l => soundInfo[l.kind].name).join(' + '),
      layers: layers.map(l => ({ kind: l.kind, gain: l.gain })),
      duration: timer
    }
    setCustomPresets(prev => [saved, ...prev].slice(0, 12))
    notify('Mezcla guardada en este dispositivo')
  }

  const deleteCustomPreset = (index: number) => {
    setCustomPresets(prev => prev.filter((_, i) => i !== index))
    notify('Mezcla eliminada')
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    const draw = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth * window.devicePixelRatio))
      const height = Math.max(1, Math.floor(canvas.clientHeight * window.devicePixelRatio))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      ctx.clearRect(0, 0, width, height)
      const analyser = audioEngine.analyser
      const bins = new Uint8Array(analyser?.frequencyBinCount || 128)
      if (playing && analyser) analyser.getByteFrequencyData(bins)
      const count = 64
      const gap = Math.max(2, width * 0.004)
      const barWidth = (width - gap * (count - 1)) / count
      for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.pow(i / count, 1.7) * (bins.length - 1))
        const raw = playing ? bins[index] / 255 : 0.035 + Math.abs(Math.sin(i * .16 + frame * .012)) * .025
        const barHeight = Math.max(3 * window.devicePixelRatio, raw * height * .78)
        const x = i * (barWidth + gap)
        const y = (height - barHeight) / 2
        ctx.fillStyle = dark ? 'rgba(190, 211, 166, .82)' : 'rgba(116, 141, 113, .82)'
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, Math.min(barWidth / 2, 4 * window.devicePixelRatio))
        ctx.fill()
      }
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
        <a className="brand" href="#" aria-label="KLM inicio">
          <span className="brand-mark"><Waves size={19}/></span>
          <span>KLM<span className="brand-light">.</span><small>AN AMBIENT SOUND SPACE</small></span>
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
          <p>Ruido, naturaleza y tonos binaurales para acompañar tu momento.<br className="desktop-break"/> Sin distracciones. Sin prisa. Solo escucha.</p>
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
              <div className="section-heading"><div><span className="section-kicker">01 / EXPLORA</span><h2>Elige tu ambiente</h2></div><span className="muted-count">13 FUENTES SONORAS</span></div>
              {groups.map(group=><div className="sound-group" key={group.title}>
                <div className="group-label">{group.title}</div>
                {group.title === 'TONOS BINAURALES' && <p className="binaural-note">Dos tonos ligeramente distintos, uno en cada oído. Utiliza auriculares estéreo a volumen bajo. Las frecuencias indican el batido acústico, no garantizan cambios en la actividad cerebral ni mejoras cognitivas.</p>}
                <div className="sound-grid">
                  {group.items.map(kind=>{
                    const info=soundInfo[kind], Icon=info.icon
                    const selected=layers.some(l=>l.kind===kind)
                    return <button className={`sound-tile ${selected?'selected':''}`} key={kind} onClick={()=>selected?removeLayer(layers.find(l=>l.kind===kind)!.id):addLayer(kind)}>
                      <span className="sound-icon" style={{'--sound-color':info.color} as CSSProperties}><Icon size={20}/></span>
                      <span className="sound-name">{info.name}</span>
                      <span className="sound-note">{info.note}</span>
                      {selected&&<span className="selected-mark"><Check size={12}/></span>}
                    </button>
                  })}
                </div>
              </div>)}
            </section>

            <section className="section-block mixer-section">
              <div className="section-heading"><div><span className="section-kicker">02 / MEZCLA</span><h2>Tu paisaje sonoro</h2></div><button className="text-button" onClick={saveCurrentMix}><Bookmark size={14}/> Guardar mezcla</button></div>
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
              <div className="eq-row fade-row"><span>Fundido</span><input type="range" min="0" max="8" step=".5" value={fadeSeconds} onChange={e=>setFadeSeconds(Number(e.target.value))}/><b>{fadeSeconds.toFixed(1)} s</b></div>
            </section>}
          </>
        ) : (
          <section className="section-block sessions-view">
            <div className="section-heading"><div><span className="section-kicker">01 / RITUALES</span><h2>El tiempo que necesitas</h2></div></div>
            <p className="sessions-intro">Pequeños espacios para volver a ti. Elige un ambiente y deja que el tiempo haga su trabajo.</p>
            <div className="preset-grid">{presets.map(p=><button className="preset-card" key={p.name} onClick={()=>loadPreset(p)}><span className="preset-icon"><Sparkles size={18}/></span><strong>{p.name}</strong><small>{p.description}</small><span className="preset-duration">{p.duration?p.duration+' MIN':'SIN LÍMITE'} <span>↗</span></span></button>)}</div>
            {customPresets.length > 0 && <div className="saved-presets"><div className="group-label">TUS MEZCLAS GUARDADAS · SOLO EN ESTE DISPOSITIVO</div><div className="preset-grid">{customPresets.map((p,i)=><div className="saved-preset-wrap" key={`${p.name}-${i}`}><button className="preset-card" onClick={()=>loadPreset(p)}><span className="preset-icon"><Bookmark size={17}/></span><strong>{p.name}</strong><small>{p.description}</small><span className="preset-duration">{p.duration?p.duration+' MIN':'SIN LÍMITE'} <span>↗</span></span></button><button className="delete-preset" aria-label={`Eliminar ${p.name}`} onClick={()=>deleteCustomPreset(i)}><Trash2 size={14}/></button></div>)}</div></div>}
            <div className="timer-card">
              <div><span className="section-kicker">TEMPORIZADOR</span><h3>{remaining?formatTime(remaining):'Sin límite de tiempo'}</h3><p>El sonido se desvanecerá suavemente al terminar.</p></div>
              <div className="timer-options">{[15,25,45,60,90].map(min=><button className={timer===min?'chosen':''} key={min} onClick={()=>{setTimer(min);setRemaining(min*60);setTimerActive(false)}}>{min}′</button>)}</div>
              <div className="timer-actions"><button className="primary-button" onClick={()=>{if(timer===0){setTimer(25);setRemaining(1500)}setTimerActive(true);notify('Temporizador iniciado')}}><Timer size={16}/> Iniciar temporizador</button><button className="secondary-button" onClick={()=>{setTimerActive(false);setTimer(0);setRemaining(0)}}>Desactivar</button></div>
            </div>
          </section>
        )}

        <section className="bottom-note"><span className="note-icon"><Leaf size={17}/></span><p>KLM · Diseñado para acompañarte, no para interrumpirte.<br/><strong>Escucha a tu manera.</strong></p><span className="note-end">QF / 001</span></section>
      </main>

      <footer><span>QUIET FIELD © 2026</span><span>HECHO PARA ESCUCHAR · NO PARA MIRAR</span><span>100% GRATUITO</span></footer>
      {toast&&<div className="toast"><Check size={15}/>{toast}</div>}
      <button className="mobile-timer" onClick={()=>{setActiveTab('sessions');window.scrollTo({top:0,behavior:'smooth'})}}><Timer size={18}/></button>
    </div>
  )
}
