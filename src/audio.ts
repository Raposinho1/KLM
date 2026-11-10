export type SoundKind = 'white' | 'pink' | 'blue' | 'brown' | 'green' | 'rain' | 'wind' | 'forest' | 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'

export type Layer = {
  id: string
  kind: SoundKind
  gain: number
  active: boolean
  node?: AudioWorkletNode | ScriptProcessorNode
  gainNode?: GainNode
  filter?: BiquadFilterNode
  oscillators?: OscillatorNode[]
  panNodes?: StereoPannerNode[]
}

export class AudioEngine {
  context: AudioContext | null = null
  master: GainNode | null = null
  analyser: AnalyserNode | null = null
  low: BiquadFilterNode | null = null
  mid: BiquadFilterNode | null = null
  high: BiquadFilterNode | null = null
  layers = new Map<string, Layer>()
  workletReady = false

  async init() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume()
      return
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    this.context = new Ctx()

    // iOS requires AudioContext.resume() to be requested directly inside
    // the user's tap handler, before awaiting network/module operations.
    const resumePromise = this.context.state === 'suspended'
      ? this.context.resume()
      : Promise.resolve()

    // Load the processor from the same origin. If unavailable, use the
    // ScriptProcessor fallback rather than leaving the interface silent.
    if (this.context.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        const processorUrl = new URL('noise-processor.js', document.baseURI).href
        await this.context.audioWorklet.addModule(processorUrl)
        this.workletReady = true
      } catch (error) {
        console.warn('KLM: AudioWorklet unavailable, using compatibility audio engine.', error)
        this.workletReady = false
      }
    }

    await resumePromise
    this.master = this.context.createGain()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.82
    this.low = this.context.createBiquadFilter()
    this.low.type = 'lowshelf'
    this.low.frequency.value = 180
    this.mid = this.context.createBiquadFilter()
    this.mid.type = 'peaking'
    this.mid.frequency.value = 1000
    this.mid.Q.value = 0.8
    this.high = this.context.createBiquadFilter()
    this.high.type = 'highshelf'
    this.high.frequency.value = 5000
    this.master.gain.value = 0.8
    this.master.connect(this.low).connect(this.mid).connect(this.high).connect(this.analyser).connect(this.context.destination)
  }

  async addLayer(kind: SoundKind, gain = 0.35, fadeInSeconds = 0.35) {
    await this.init()
    const ctx = this.context!
    if (ctx.state !== 'running') await ctx.resume()
    const id = `${kind}-${Date.now()}-${Math.random().toString(16).slice(2,6)}`
    const binauralHz: Partial<Record<SoundKind, number>> = { delta: 2, theta: 6, alpha: 10, beta: 20, gamma: 40 }
    const beatHz = binauralHz[kind]
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    let node: AudioWorkletNode | ScriptProcessorNode | undefined
    let filter: BiquadFilterNode | undefined
    let oscillators: OscillatorNode[] | undefined
    let panNodes: StereoPannerNode[] | undefined

    if (beatHz) {
      // A binaural beat is perceived when each ear receives a slightly different tone.
      // Use separate hard-panned oscillators: headphones are required for the intended effect.
      const carrierHz = 220
      oscillators = []
      panNodes = []
      for (const [pan, frequency] of [[-1, carrierHz], [1, carrierHz + beatHz]] as const) {
        const oscillator = ctx.createOscillator()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        const earGain = ctx.createGain()
        earGain.gain.value = 0.5
        const panner = ctx.createStereoPanner()
        panner.pan.value = pan
        oscillator.connect(earGain).connect(panner).connect(gainNode)
        oscillator.start()
        oscillators.push(oscillator)
        panNodes.push(panner)
      }
    } else if (this.workletReady && typeof AudioWorkletNode !== 'undefined') {
      node = new AudioWorkletNode(ctx, 'noise-maker', { numberOfOutputs: 1, outputChannelCount: [1] })
      node.port.postMessage({ kind })
    } else {
      // Compatibility fallback for older mobile browsers.
      const processor = ctx.createScriptProcessor(2048, 0, 1)
      let brown = 0
      let last = 0
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0
      let phase = 0
      processor.onaudioprocess = (event) => {
        const output = event.outputBuffer.getChannelData(0)
        for (let i=0; i<output.length; i++) {
          const white = Math.random() * 2 - 1
          let sample = white
          if (kind === 'pink' || kind === 'rain' || kind === 'forest') {
            b0=0.99886*b0+white*0.0555179
            b1=0.99332*b1+white*0.0750759
            b2=0.96900*b2+white*0.1538520
            b3=0.86650*b3+white*0.3104856
            b4=0.55000*b4+white*0.5329522
            b5=-0.7616*b5-white*0.0168980
            sample=(b0+b1+b2+b3+b4+b5+b6+white*0.5362)*0.11
            b6=white*0.115926
          } else if (kind === 'brown' || kind === 'wind') {
            brown=(brown+0.02*white)/1.02
            sample=brown*3.5
          } else if (kind === 'blue') {
            sample=(white-last)*0.5
            last=white
          }
          if (kind === 'wind') { phase += 0.000035; sample *= 0.62 + 0.38*(0.5+0.5*Math.sin(phase)) }
          if (kind === 'rain') { phase += 0.00011; sample *= 0.76 + 0.24*(0.5+0.5*Math.sin(phase)) }
          output[i]=sample
        }
      }
      node = processor
    }
    if (kind === 'blue') {
      filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 900
    } else if (kind === 'green') {
      filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 500
      filter.Q.value = 0.65
    } else if (kind === 'rain') {
      filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 6500
    } else if (kind === 'wind') {
      filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 420
    } else if (kind === 'forest') {
      filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1800
      filter.Q.value = 0.3
    }
    if (node) {
      if (filter) node.connect(filter).connect(gainNode)
      else node.connect(gainNode)
    }
    gainNode.connect(this.master!)
    const layer: Layer = { id, kind, gain, active: true, node, gainNode, filter, oscillators, panNodes }
    this.layers.set(id, layer)
    gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + Math.max(0.02, fadeInSeconds))
    return layer
  }

  setGain(id: string, value: number) {
    const layer = this.layers.get(id)
    if (!layer || !this.context) return
    layer.gain = value
    layer.gainNode?.gain.setTargetAtTime(layer.active ? value : 0, this.context.currentTime, 0.04)
  }

  toggleLayer(id: string) {
    const layer = this.layers.get(id)
    if (!layer || !this.context) return
    layer.active = !layer.active
    layer.gainNode?.gain.setTargetAtTime(layer.active ? layer.gain : 0, this.context.currentTime, 0.06)
    return layer.active
  }

  removeLayer(id: string, fadeSeconds = 0.25) {
    const layer = this.layers.get(id)
    if (!layer || !this.context) return
    const now = this.context.currentTime
    const param = layer.gainNode?.gain
    if (param) {
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(0, now + Math.max(0.02, fadeSeconds))
    }
    window.setTimeout(() => {
      try { layer.node?.disconnect(); layer.filter?.disconnect(); layer.oscillators?.forEach(o => { try { o.stop(); o.disconnect() } catch {} }); layer.panNodes?.forEach(p => p.disconnect()); layer.gainNode?.disconnect() } catch {}
    }, Math.max(100, fadeSeconds * 1000 + 80))
    this.layers.delete(id)
  }

  setMaster(value: number) {
    if (this.master && this.context) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.05)
  }

  setEQ(which: 'low'|'mid'|'high', value: number) {
    const node = which === 'low' ? this.low : which === 'mid' ? this.mid : this.high
    if (node && this.context) node.gain.setTargetAtTime(value, this.context.currentTime, 0.05)
  }

  fadeOutAll(seconds = 2.5) {
    if (!this.context) return
    const now = this.context.currentTime
    for (const layer of this.layers.values()) {
      const param = layer.gainNode?.gain
      if (!param) continue
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(0, now + Math.max(0.1, seconds))
    }
  }

  async stopAll(fadeSeconds = 0.25) {
    for (const id of [...this.layers.keys()]) this.removeLayer(id, fadeSeconds)
  }
}

export const audioEngine = new AudioEngine()
