class NoiseMaker extends AudioWorkletProcessor {
  constructor() {
    super()
    this.b0=0; this.b1=0; this.b2=0; this.b3=0; this.b4=0; this.b5=0; this.b6=0;
    this.brown=0; this.last=0; this.phase=0; this.kind='white';
    this.port.onmessage = (e) => { this.kind = e.data.kind }
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
        if (this.kind==='wind') { this.phase += 0.000035; sample *= 0.62 + 0.38*(0.5+0.5*Math.sin(this.phase)) }
        if (this.kind==='rain') { this.phase += 0.00011; sample *= 0.76 + 0.24*(0.5+0.5*Math.sin(this.phase)) }
        channel[i]=sample
      }
    }
    return true
  }
}
registerProcessor('noise-maker', NoiseMaker)
