export type SoundKind = 'white' | 'pink' | 'blue' | 'brown' | 'green' | 'rain' | 'wind' | 'forest'

export type Layer = {
  id: string
  kind: SoundKind
  gain: number
  active: boolean
  node?: AudioWorkletNode
  gainNode?: GainNode
  filter?: BiquadFilterNode
}

const workletCode = `
class NoiseMaker extends AudioWorkletProcessor {
  constructor() {
    super()
    this.b0=0; this.b1=0; this.b2=0; this.b3=0; this.b4=0; this.b5=0; this.b6=0;
    this.brown=0; this.last=0;
    this.port.onmessage = (e) => { this.kind = e.data.kind }
    this.kind = 'white'
  }
  process(inputs, outputs) {
    const out = outputs[0]
    for (let c=0;c<out.length;c++) {
      const channel=out[c]
      for (let i=0;i<channel.length;i++) {
        const white=Math.random()*2-1
        let sample=white
        if (this.kind==='pink' || this.kind==='rain' || this.kind==='forest') {
          this.b0=0.99886*this.b0+white*0.0555179
          this.b1=0.99332*this.b1+white*0.0750759
          this.b2=0.96900*this.b2+white*0.1538520
          this.b3=0.86650*this.b3+white*0.3104856
          this.b4=0.55000*this.b4+white*0.5329522
          this.b5=-0.7616*this.b5-white*0.0168980
          sample=(this.b0+this.b1+this.b2+this.b3+this.b4+this.b5+this.b6+white*0.5362)*0.11
          this.b6=white*0.115926
        } else if (this.kind==='brown' || this.kind==='wind') {
          this.brown=(this.brown+0.02*white)/1.02
          sample=this.brown*3.5
        } else if (this.kind==='blue') {
          sample=(white-this.last)*0.5
          this.last=white
        }
        channel[i]=sample
      }
    }
    return true
  }
}
registerProcessor('noise-maker', NoiseMaker)
`

export class AudioEngine {
  context: AudioContext | null = null
  master: GainNode | null = null
  analyser: AnalyserNode | null = null
  low: BiquadFilterNode | null = null
  mid: BiquadFilterNode | null = null
  high: BiquadFilterNode | null = null
  layers = new Map<string, Layer>()
  ready = false

  async init() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume()
      return
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    this.context = new Ctx()
    const blob = new Blob([workletCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    await this.context.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)

    this.master = this.context.createGain()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048
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
    this.ready = true
  }

  async addLayer(kind: SoundKind, gain = 0.45) {
    await this.init()
    const ctx = this.context!
    const id = `${kind}-${Date.now()}-${Math.random().toString(16).slice(2,6)}`
    const node = new AudioWorkletNode(ctx, 'noise-maker', { numberOfOutputs: 1, outputChannelCount: [1] })
    node.port.postMessage({ kind })
    const gainNode = ctx.createGain()
    gainNode.gain.value = 0
    let filter: BiquadFilterNode | undefined
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
    if (filter) node.connect(filter).connect(gainNode)
    else node.connect(gainNode)
    gainNode.connect(this.master!)
    const layer: Layer = { id, kind, gain, active: true, node, gainNode, filter }
    this.layers.set(id, layer)
    gainNode.gain.setTargetAtTime(gain, ctx.currentTime, 0.12)
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

  removeLayer(id: string) {
    const layer = this.layers.get(id)
    if (!layer || !this.context) return
    layer.gainNode?.gain.setTargetAtTime(0, this.context.currentTime, 0.04)
    window.setTimeout(() => {
      try { layer.node?.disconnect(); layer.filter?.disconnect(); layer.gainNode?.disconnect() } catch {}
    }, 180)
    this.layers.delete(id)
  }

  setMaster(value: number) {
    if (this.master && this.context) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.05)
  }

  setEQ(which: 'low'|'mid'|'high', value: number) {
    const node = which === 'low' ? this.low : which === 'mid' ? this.mid : this.high
    if (node && this.context) node.gain.setTargetAtTime(value, this.context.currentTime, 0.05)
  }

  async stopAll() {
    if (!this.context) return
    for (const id of [...this.layers.keys()]) this.removeLayer(id)
  }
}

export const audioEngine = new AudioEngine()
