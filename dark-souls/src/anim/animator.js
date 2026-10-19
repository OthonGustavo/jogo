import * as THREE from '../../vendor/three.module.min.js';

// Nome do contrato -> nome do clip nos .glb do KayKit.
export const CLIPS = {
  idle: 'Idle', walk: 'Walking_A', run: 'Running_A', roll: 'Dodge_Forward',
  attack_light: '1H_Melee_Attack_Slice_Horizontal', attack_heavy: '2H_Melee_Attack_Chop',
  block: 'Blocking', hit: 'Hit_A', death: 'Death_A', drink: '2H_Melee_Idle',
};

// Envolve um AnimationMixer: crossfade, retorno a idle em ações não-loop, playOnce com callback.
export class Animator {
  constructor(root, clips, map = CLIPS) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const [nome, clipName] of Object.entries(map)) {
      const clip = clips.find(c => c.name === clipName);
      if (clip) this.actions[nome] = this.mixer.clipAction(clip);
    }
    this.current = null; this.name = '';
    this.mixer.addEventListener('finished', e => {
      if (e.action !== this.current) return;
      const cb = this._cb; this._cb = null;
      if (this.name !== 'death') this.play('idle');
      if (cb) cb();
    });
  }
  // loop: padrão true para idle/walk/run/block; ações únicas ficam na última pose até a lógica trocar.
  play(nome, { loop, fade = 0.15, timeScale = 1, restart = false } = {}) {
    const a = this.actions[nome] || this.actions.idle;
    if (!a) return;
    if (loop === undefined) loop = ['idle', 'walk', 'run', 'block', 'drink'].includes(nome);
    if (a === this.current && !restart) { a.timeScale = timeScale; return; }
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    a.enabled = true;
    if (this.current) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a; this.name = nome; this._cb = null;
  }
  playOnce(nome, cb, opts = {}) { this.play(nome, { ...opts, loop: false, restart: true }); this._cb = cb || null; }
  // Faz a ação durar `dur` segundos.
  fit(nome, dur) { const a = this.actions[nome]; return a ? a.getClip().duration / dur : 1; }
  update(dt) { this.mixer.update(dt); }
}
