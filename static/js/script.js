// ============================================================
// MONKY SOUND PRO - MAIN APPLICATION (FULL VERSION)
// ============================================================
// This script is identical to the one in the Python version, but works with the Node backend.
// All API endpoints are the same, so no changes needed.

const state = {
    currentFile: null,
    currentProcessedFile: null,
    isPlaying: false,
    isPaused: false,
    duration: 0,
    effects: {},
    selectedStyle: 'demonic',
    uploadedFiles: [],
    processedFiles: [],
    audioCtx: null,
    audioBuffer: null,
    sourceNode: null,
    gainNode: null,
    analyser: null,
    pianoRecording: [],
    pianoNotes: [],
    seqPattern: { kick: [], snare: [], hihat: [], clap: [] },
    seqPlaying: false,
    seqInterval: null,
    seqStep: 0,
    seqBPM: 120,
    seqSwing: 0.5,
    activeInst: 'kick',
    generatedVoiceUrl: null,
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const DOM = {
    canvas: $('#bgCanvas'),
    waveformCanvas: $('#waveformCanvas'),
    playBtn: $('#playBtn'),
    pauseBtn: $('#pauseBtn'),
    stopBtn: $('#stopBtn'),
    seekSlider: $('#seekSlider'),
    timeDisplay: $('#timeDisplay'),
    volumeSlider: $('#volumeSlider'),
    effectsGrid: $('#effectsGrid'),
    applyEffectsBtn: $('#applyEffectsBtn'),
    resetEffectsBtn: $('#resetEffectsBtn'),
    downloadBtn: $('#downloadBtn'),
    translationGrid: $('#translationGrid'),
    translateBtn: $('#translateBtn'),
    libraryGrid: $('#libraryGrid'),
    refreshLibraryBtn: $('#refreshLibraryBtn'),
    processingBanner: $('#processingBanner'),
    progressBar: $('#progressBar'),
    statusText: $('#statusText'),
    navBtns: $$('.nav-btn'),
    tabs: $$('.tab-content'),
    pianoKeyboard: $('#pianoKeyboard'),
    pianoNotesDisplay: $('#pianoNotesDisplay'),
    recordPianoBtn: $('#recordPianoBtn'),
    stopPianoBtn: $('#stopPianoBtn'),
    playPianoBtn: $('#playPianoBtn'),
    clearPianoBtn: $('#clearPianoBtn'),
    sequencerGrid: $('#sequencerGrid'),
    playSeqBtn: $('#playSeqBtn'),
    stopSeqBtn: $('#stopSeqBtn'),
    clearSeqBtn: $('#clearSeqBtn'),
    bpmInput: $('#bpmInput'),
    swingSlider: $('#swingSlider'),
    instBtns: $$('.inst-btn'),
    lyricsInput: $('#lyricsInput'),
    voiceStyleSelect: $('#voiceStyleSelect'),
    generateVoiceBtn: $('#generateVoiceBtn'),
    playVoiceBtn: $('#playVoiceBtn'),
    downloadVoiceBtn: $('#downloadVoiceBtn'),
    lyricsStatus: $('#lyricsStatus'),
    lyricsPreview: $('#lyricsPreview'),
};

// ---------- Background Animation ----------
class BgAnim {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.parts = [];
        this.wave = [];
        this.resize();
        this.init();
        this.animate();
        window.addEventListener('resize', () => this.resize());
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    init() {
        const count = 100;
        for (let i=0; i<count; i++) {
            this.parts.push({ x: Math.random()*this.canvas.width, y: Math.random()*this.canvas.height, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3, r: Math.random()*2+1, a: Math.random()*0.5+0.1, h: 240+Math.random()*60 });
        }
        for (let i=0; i<50; i++) {
            this.wave.push({ x: (i/50)*this.canvas.width, y: this.canvas.height/2, ty: this.canvas.height/2 });
        }
    }
    animate() {
        const ctx = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;
        ctx.clearRect(0,0,w,h);
        const t = Date.now()/2000;
        for (let i=0; i<this.wave.length; i++) {
            const p = this.wave[i];
            const phase = (i/this.wave.length)*Math.PI*2;
            p.ty = h/2 + Math.sin(t+phase)*40 + Math.sin(t*1.5+phase*2)*20;
            p.y += (p.ty-p.y)*0.05;
        }
        ctx.beginPath();
        for (let i=0; i<this.wave.length; i++) {
            if (i===0) ctx.moveTo(this.wave[i].x, this.wave[i].y);
            else ctx.lineTo(this.wave[i].x, this.wave[i].y);
        }
        const grad = ctx.createLinearGradient(0,0,w,0);
        grad.addColorStop(0,'rgba(108,60,224,0.3)');
        grad.addColorStop(0.5,'rgba(224,60,140,0.4)');
        grad.addColorStop(1,'rgba(60,224,200,0.3)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(108,60,224,0.3)';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
        for (const p of this.parts) {
            p.x += p.vx; p.y += p.vy;
            if (p.x<0) p.x=w; if (p.x>w) p.x=0;
            if (p.y<0) p.y=h; if (p.y>h) p.y=0;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            ctx.fillStyle = `hsla(${p.h},80%,70%,${p.a})`;
            ctx.shadowColor = `hsla(${p.h},80%,70%,0.2)`;
            ctx.shadowBlur = 8;
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        requestAnimationFrame(() => this.animate());
    }
}

// ---------- Audio Engine ----------
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.src = null;
        this.gain = null;
        this.analyser = null;
        this.buffer = null;
        this.playing = false;
        this.paused = false;
        this.startTime = 0;
        this.pausedAt = 0;
        this.onEnd = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gain = this.ctx.createGain();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 2048;
            this.gain.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
            this.gain.gain.value = 0.8;
        }
    }
    async load(url) {
        this.init();
        const resp = await fetch(url);
        const ab = await resp.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(ab);
        return this.buffer;
    }
    play() {
        if (!this.buffer) return;
        if (this.paused) {
            this.src = this.ctx.createBufferSource();
            this.src.buffer = this.buffer;
            this.src.connect(this.gain);
            this.src.start(0, this.pausedAt);
            this.startTime = this.ctx.currentTime - this.pausedAt;
            this.playing = true;
            this.paused = false;
            this.src.onended = () => { this.playing = false; this.pausedAt = 0; if (this.onEnd) this.onEnd(); };
            return;
        }
        if (this.playing) return;
        this.src = this.ctx.createBufferSource();
        this.src.buffer = this.buffer;
        this.src.connect(this.gain);
        this.src.start(0);
        this.startTime = this.ctx.currentTime;
        this.playing = true;
        this.paused = false;
        this.src.onended = () => { this.playing = false; this.pausedAt = 0; if (this.onEnd) this.onEnd(); };
    }
    pause() {
        if (!this.playing) return;
        this.src.stop();
        this.pausedAt = this.ctx.currentTime - this.startTime;
        this.playing = false;
        this.paused = true;
    }
    stop() {
        if (this.src) try { this.src.stop(); } catch(e) {}
        this.playing = false;
        this.paused = false;
        this.pausedAt = 0;
    }
    seek(t) {
        if (!this.buffer) return;
        const wasPlay = this.playing, wasPause = this.paused;
        if (wasPlay) this.stop();
        if (wasPause) this.stop();
        this.pausedAt = Math.min(t, this.buffer.duration);
        if (wasPlay) this.play();
        else if (wasPause) { this.paused = true; this.src = this.ctx.createBufferSource(); this.src.buffer = this.buffer; this.src.connect(this.gain); this.src.start(0, this.pausedAt); this.startTime = this.ctx.currentTime - this.pausedAt; this.playing = true; this.paused = true; this.src.onended = () => { this.playing = false; this.pausedAt = 0; if (this.onEnd) this.onEnd(); }; }
    }
    setVolume(v) { if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, v/100)); }
    getCurrentTime() { return this.playing ? this.ctx.currentTime - this.startTime : this.pausedAt || 0; }
    getDuration() { return this.buffer ? this.buffer.duration : 0; }
    getWaveform() { if (!this.analyser) return null; const arr = new Uint8Array(this.analyser.fftSize); this.analyser.getByteTimeDomainData(arr); return arr; }
    getFrequency() { if (!this.analyser) return null; const arr = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteFrequencyData(arr); return arr; }
    destroy() { if (this.src) try { this.src.stop(); } catch(e) {} this.playing = false; this.paused = false; this.buffer = null; }
}

// ---------- Waveform Visualizer ----------
class WaveVis {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        this.drawPlaceholder();
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = this.canvas.parentElement.clientWidth - 4;
        this.canvas.height = Math.max(150, rect.height - 60);
    }
    drawPlaceholder() {
        const w=this.canvas.width, h=this.canvas.height;
        this.ctx.clearRect(0,0,w,h);
        this.ctx.fillStyle = '#12121f';
        this.ctx.fillRect(0,0,w,h);
        this.ctx.fillStyle = 'rgba(108,60,224,0.15)';
        this.ctx.font = '18px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🎵 Audio visualizer', w/2, h/2);
    }
    drawWaveform(data) {
        const w=this.canvas.width, h=this.canvas.height;
        this.ctx.clearRect(0,0,w,h);
        this.ctx.fillStyle = '#0a0a12';
        this.ctx.fillRect(0,0,w,h);
        const step = Math.max(1, Math.floor(data.length / w));
        const amp = h/2 - 4;
        this.ctx.beginPath();
        for (let i=0; i<w; i++) {
            const idx = Math.floor(i*step);
            const val = data[idx]/128.0 - 1.0;
            const y = h/2 + val*amp;
            if (i===0) this.ctx.moveTo(i, y);
            else this.ctx.lineTo(i, y);
        }
        const grad = this.ctx.createLinearGradient(0,0,w,0);
        grad.addColorStop(0,'#6c3ce0');
        grad.addColorStop(0.5,'#e03c8c');
        grad.addColorStop(1,'#3ce0c8');
        this.ctx.strokeStyle = grad;
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = 'rgba(108,60,224,0.3)';
        this.ctx.shadowBlur = 12;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.lineTo(w, h);
        this.ctx.lineTo(0, h);
        this.ctx.closePath();
        const grad2 = this.ctx.createLinearGradient(0, h/2, 0, h);
        grad2.addColorStop(0, 'rgba(108,60,224,0.05)');
        grad2.addColorStop(1, 'rgba(108,60,224,0.01)');
        this.ctx.fillStyle = grad2;
        this.ctx.fill();
    }
}

// ---------- API ----------
const API = {
    async upload(file) { const fd = new FormData(); fd.append('audio', file); const r = await fetch('/api/upload', {method:'POST', body:fd}); return r.json(); },
    async process(filename, effects) { const r = await fetch('/api/process', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({filename, effects})}); return r.json(); },
    async translate(filename, style) { const r = await fetch('/api/translate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({filename, style})}); return r.json(); },
    async getFiles() { const r = await fetch('/api/files'); return r.json(); },
    async getEffects() { const r = await fetch('/api/effects'); return r.json(); },
    async getStyles() { const r = await fetch('/api/styles'); return r.json(); },
    async deleteFile(name) { const r = await fetch(`/api/delete/${name}`, {method:'DELETE'}); return r.json(); },
    getPlayUrl(name) { return `/api/play/${name}`; },
    getDownloadUrl(name) { return `/api/download/${name}`; },
    async generateVoice(text, style) { const r = await fetch('/api/generate_voice', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, style})}); return r.json(); }
};

// ---------- App ----------
class App {
    constructor() {
        this.bg = new BgAnim(DOM.canvas);
        this.vis = new WaveVis(DOM.waveformCanvas);
        this.audio = new AudioEngine();
        this.audio.onEnd = () => { DOM.playBtn.style.display='flex'; DOM.pauseBtn.style.display='none'; this.updatePlaybackUI(); };
        this.init();
    }
    async init() {
        await this.loadEffects();
        await this.loadStyles();
        await this.refreshLibrary();
        this.setupEvents();
        this.initPiano();
        this.initSequencer();
        this.startVisualizerLoop();
        DOM.navBtns.forEach(btn => btn.addEventListener('click', () => setTimeout(() => this.vis.resize(), 100)));
    }
    async loadEffects() {
        try {
            const data = await API.getEffects();
            DOM.effectsGrid.innerHTML = '';
            for (const [key, cfg] of Object.entries(data)) {
                const item = document.createElement('div');
                item.className = 'effect-item';
                if (cfg.type === 'range') {
                    const val = cfg.default || 0;
                    state.effects[key] = val;
                    item.innerHTML = `<label>${cfg.label}</label><input type="range" min="${cfg.min}" max="${cfg.max}" value="${val}" data-effect="${key}"><span class="effect-value">${val}</span>`;
                    const inp = item.querySelector('input'), span = item.querySelector('.effect-value');
                    inp.addEventListener('input', () => { const v = parseInt(inp.value); span.textContent = v; state.effects[key] = v; });
                } else if (cfg.type === 'toggle') {
                    const val = cfg.default || false;
                    state.effects[key] = val;
                    item.classList.add('toggle');
                    item.innerHTML = `<label>${cfg.label}</label><input type="checkbox" ${val?'checked':''} data-effect="${key}">`;
                    const inp = item.querySelector('input');
                    inp.addEventListener('change', () => { state.effects[key] = inp.checked; });
                }
                DOM.effectsGrid.appendChild(item);
            }
        } catch(e) { console.error('Effects load error', e); }
    }
    async loadStyles() {
        try {
            const data = await API.getStyles();
            DOM.translationGrid.innerHTML = '';
            for (const st of data) {
                const btn = document.createElement('button');
                btn.className = 'style-btn' + (st.id === state.selectedStyle ? ' active' : '');
                btn.dataset.style = st.id;
                btn.textContent = st.label;
                btn.addEventListener('click', () => {
                    DOM.translationGrid.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.selectedStyle = st.id;
                });
                DOM.translationGrid.appendChild(btn);
            }
        } catch(e) { console.error('Styles load error', e); }
    }
    setupEvents() {
        DOM.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                DOM.tabs.forEach(t => t.classList.remove('active'));
                const target = document.getElementById(`tab-${tab}`);
                if (target) target.classList.add('active');
                setTimeout(() => this.vis.resize(), 100);
            });
        });
        DOM.playBtn.addEventListener('click', () => this.play());
        DOM.pauseBtn.addEventListener('click', () => this.pause());
        DOM.stopBtn.addEventListener('click', () => this.stop());
        DOM.seekSlider.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value);
            const dur = this.audio.getDuration();
            this.audio.seek((pct/100)*dur);
            this.updatePlaybackUI();
        });
        DOM.volumeSlider.addEventListener('input', (e) => this.audio.setVolume(parseInt(e.target.value)));
        DOM.applyEffectsBtn.addEventListener('click', () => this.applyEffects());
        DOM.resetEffectsBtn.addEventListener('click', () => this.resetEffects());
        DOM.downloadBtn.addEventListener('click', () => this.download());
        DOM.translateBtn.addEventListener('click', () => this.translateVoice());
        DOM.refreshLibraryBtn.addEventListener('click', () => this.refreshLibrary());
        DOM.generateVoiceBtn.addEventListener('click', () => this.generateVoice());
        DOM.playVoiceBtn.addEventListener('click', () => this.playGeneratedVoice());
        DOM.downloadVoiceBtn.addEventListener('click', () => this.downloadGeneratedVoice());
    }
    async play() {
        if (!state.currentFile && !state.currentProcessedFile) {
            const files = await API.getFiles();
            if (files.processed.length) state.currentProcessedFile = files.processed[0].name;
            else if (files.uploaded.length) state.currentFile = files.uploaded[0].name;
            else { alert('No audio loaded. Upload a file.'); return; }
        }
        const filename = state.currentProcessedFile || state.currentFile;
        if (!filename) return;
        if (this.audio.buffer && this.audio.paused) {
            this.audio.play();
            DOM.playBtn.style.display = 'none';
            DOM.pauseBtn.style.display = 'flex';
            return;
        }
        const url = API.getPlayUrl(filename);
        try {
            await this.audio.load(url);
            this.audio.play();
            DOM.playBtn.style.display = 'none';
            DOM.pauseBtn.style.display = 'flex';
        } catch(e) { alert('Playback error'); }
    }
    pause() { this.audio.pause(); DOM.playBtn.style.display='flex'; DOM.pauseBtn.style.display='none'; }
    stop() { this.audio.stop(); DOM.playBtn.style.display='flex'; DOM.pauseBtn.style.display='none'; this.updatePlaybackUI(); }
    updatePlaybackUI() {
        const dur = this.audio.getDuration(), cur = this.audio.getCurrentTime();
        const pct = dur > 0 ? (cur/dur)*100 : 0;
        DOM.seekSlider.value = pct;
        DOM.timeDisplay.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)}`;
    }
    formatTime(s) { if (!s || isNaN(s)) return '0:00'; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; }
    startVisualizerLoop() {
        const loop = () => {
            if (this.audio.playing || this.audio.paused) {
                const data = this.audio.getWaveform();
                if (data) this.vis.drawWaveform(data);
            }
            requestAnimationFrame(loop);
        };
        loop();
    }
    async applyEffects() {
        if (!state.currentFile) { alert('Upload a file first.'); return; }
        this.showProcessing('Applying effects...');
        try {
            const res = await API.process(state.currentFile, state.effects);
            if (res.success) {
                state.currentProcessedFile = res.filename;
                this.hideProcessing('✅ Done!');
                await this.refreshLibrary();
                setTimeout(() => this.play(), 300);
            } else { this.hideProcessing('❌ Error'); }
        } catch(e) { this.hideProcessing('❌ Error'); }
    }
    resetEffects() {
        DOM.effectsGrid.querySelectorAll('input[type="range"]').forEach(inp => {
            const def = inp.getAttribute('value') || 0;
            inp.value = def;
            const span = inp.parentElement.querySelector('.effect-value');
            if (span) span.textContent = def;
            state.effects[inp.dataset.effect] = parseInt(def);
        });
        DOM.effectsGrid.querySelectorAll('input[type="checkbox"]').forEach(inp => {
            inp.checked = false;
            state.effects[inp.dataset.effect] = false;
        });
    }
    async translateVoice() {
        if (!state.currentFile) { alert('Upload first.'); return; }
        this.showProcessing(`Translating to ${state.selectedStyle}...`);
        try {
            const res = await API.translate(state.currentFile, state.selectedStyle);
            if (res.success) {
                state.currentProcessedFile = res.filename;
                this.hideProcessing('✅ Translated!');
                await this.refreshLibrary();
                setTimeout(() => this.play(), 300);
            } else { this.hideProcessing('❌ Error'); }
        } catch(e) { this.hideProcessing('❌ Error'); }
    }
    async download() {
        const name = state.currentProcessedFile || state.currentFile;
        if (!name) { alert('No file to download.'); return; }
        window.open(API.getDownloadUrl(name), '_blank');
    }
    async refreshLibrary() {
        try {
            const data = await API.getFiles();
            state.uploadedFiles = data.uploaded;
            state.processedFiles = data.processed;
            const grid = DOM.libraryGrid;
            grid.innerHTML = '';
            const all = [...data.uploaded, ...data.processed];
            if (all.length === 0) {
                grid.innerHTML = `<div class="library-empty"><span>🎵</span><p>No files yet. Upload something!</p></div>`;
                return;
            }
            for (const f of all) {
                const card = document.createElement('div');
                card.className = 'library-card';
                const isProcessed = data.processed.some(p => p.name === f.name);
                card.innerHTML = `
                    <span class="card-icon">${isProcessed ? '🎛️' : '📄'}</span>
                    <div class="card-name">${f.name}</div>
                    <div class="card-meta">${(f.size/1024).toFixed(1)} KB</div>
                    <div class="card-actions">
                        <button class="play-card" data-file="${f.name}">▶ Play</button>
                        <button class="delete-card" data-file="${f.name}">🗑️</button>
                    </div>
                `;
                card.querySelector('.play-card').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const name = e.target.dataset.file;
                    if (data.processed.some(p => p.name === name)) state.currentProcessedFile = name;
                    else state.currentFile = name;
                    this.play();
                });
                card.querySelector('.delete-card').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const name = e.target.dataset.file;
                    if (confirm(`Delete ${name}?`)) {
                        await API.deleteFile(name);
                        this.refreshLibrary();
                    }
                });
                grid.appendChild(card);
            }
        } catch(e) { console.error('Library refresh error', e); }
    }
    showProcessing(msg) {
        DOM.processingBanner.classList.add('active');
        DOM.statusText.textContent = msg;
        DOM.progressBar.style.width = '0%';
        let p = 0;
        const interval = setInterval(() => {
            p += Math.random()*15;
            if (p > 95) p = 95;
            DOM.progressBar.style.width = p + '%';
        }, 200);
        DOM.processingBanner._interval = interval;
    }
    hideProcessing(msg) {
        DOM.progressBar.style.width = '100%';
        if (DOM.processingBanner._interval) clearInterval(DOM.processingBanner._interval);
        DOM.statusText.textContent = msg || 'Done!';
        setTimeout(() => {
            DOM.processingBanner.classList.remove('active');
        }, 600);
    }
    // ---------- Piano ----------
    initPiano() {
        const notes = ['C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4','C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5'];
        const isBlack = [false,true,false,true,false,false,true,false,true,false,true,false,false,true,false,true,false,false,true,false,true,false,true,false];
        const keyboard = DOM.pianoKeyboard;
        keyboard.innerHTML = '';
        notes.forEach((note, i) => {
            const key = document.createElement('div');
            key.className = `piano-key ${isBlack[i] ? 'black' : 'white'}`;
            if (isBlack[i]) key.style.height = '65%';
            key.dataset.note = note;
            key.innerHTML = `<span>${note}</span>`;
            key.addEventListener('mousedown', () => this.playPianoNote(note, key));
            key.addEventListener('mouseup', () => this.stopPianoNote(note, key));
            key.addEventListener('mouseleave', () => this.stopPianoNote(note, key));
            keyboard.appendChild(key);
        });
        document.addEventListener('keydown', (e) => {
            const map = { 'a':'C4','w':'C#4','s':'D4','e':'D#4','d':'E4','f':'F4','t':'F#4','g':'G4','y':'G#4','h':'A4','u':'A#4','j':'B4','k':'C5','o':'C#5','l':'D5','p':'D#5',';':'E5','\'':'F5' };
            const note = map[e.key.toLowerCase()];
            if (note) {
                const keys = keyboard.querySelectorAll('.piano-key');
                const target = Array.from(keys).find(k => k.dataset.note === note);
                if (target && !target.classList.contains('active')) {
                    this.playPianoNote(note, target);
                }
                e.preventDefault();
            }
        });
        document.addEventListener('keyup', (e) => {
            const map = { 'a':'C4','w':'C#4','s':'D4','e':'D#4','d':'E4','f':'F4','t':'F#4','g':'G4','y':'G#4','h':'A4','u':'A#4','j':'B4','k':'C5','o':'C#5','l':'D5','p':'D#5',';':'E5','\'':'F5' };
            const note = map[e.key.toLowerCase()];
            if (note) {
                const keys = keyboard.querySelectorAll('.piano-key');
                const target = Array.from(keys).find(k => k.dataset.note === note);
                if (target) this.stopPianoNote(note, target);
                e.preventDefault();
            }
        });
        DOM.recordPianoBtn.addEventListener('click', () => {
            const recording = DOM.recordPianoBtn.textContent.includes('Stop');
            if (!recording) {
                DOM.recordPianoBtn.textContent = '⏹ Stop Recording';
                state.pianoRecording = [];
                state.pianoNotes = [];
                DOM.pianoNotesDisplay.innerHTML = '<span style="color:var(--accent-2);">🔴 Recording...</span>';
            } else {
                DOM.recordPianoBtn.textContent = '⏺ Record';
                DOM.pianoNotesDisplay.innerHTML = `<span>✅ Recorded ${state.pianoRecording.length} notes.</span>`;
            }
        });
        DOM.stopPianoBtn.addEventListener('click', () => {
            DOM.recordPianoBtn.textContent = '⏺ Record';
            DOM.pianoNotesDisplay.innerHTML = '<span style="color:var(--text-secondary);">Recording stopped.</span>';
        });
        DOM.playPianoBtn.addEventListener('click', () => this.playPianoRecording());
        DOM.clearPianoBtn.addEventListener('click', () => {
            state.pianoRecording = [];
            state.pianoNotes = [];
            DOM.pianoNotesDisplay.innerHTML = '<span style="color:var(--text-secondary);">🎵 Cleared.</span>';
        });
        this._pianoCtx = null;
    }
    playPianoNote(note, key) {
        if (!this._pianoCtx) this._pianoCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this._pianoCtx;
        const freq = this.noteToFreq(note);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1);
        key.classList.add('active');
        if (DOM.recordPianoBtn.textContent.includes('Stop')) {
            state.pianoRecording.push({ note, time: performance.now() });
            state.pianoNotes.push(note);
            DOM.pianoNotesDisplay.innerHTML = state.pianoNotes.map(n => `<span style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:12px;">${n}</span>`).join(' ');
        }
        setTimeout(() => key.classList.remove('active'), 200);
    }
    stopPianoNote(note, key) { key.classList.remove('active'); }
    noteToFreq(note) {
        const map = { 'C':0, 'C#':1, 'D':2, 'D#':3, 'E':4, 'F':5, 'F#':6, 'G':7, 'G#':8, 'A':9, 'A#':10, 'B':11 };
        const match = note.match(/([A-G]#?)(\d+)/);
        if (!match) return 440;
        const [, name, oct] = match;
        const n = map[name];
        const o = parseInt(oct);
        return 440 * Math.pow(2, (n - 9 + (o - 4)*12) / 12);
    }
    async playPianoRecording() {
        if (state.pianoRecording.length === 0) return;
        if (!this._pianoCtx) this._pianoCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this._pianoCtx;
        const startTime = state.pianoRecording[0].time;
        for (const ev of state.pianoRecording) {
            const delay = (ev.time - startTime) / 1000;
            setTimeout(() => {
                const freq = this.noteToFreq(ev.note);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.8);
            }, delay * 1000);
        }
        DOM.pianoNotesDisplay.innerHTML = '<span style="color:var(--accent-3);">▶ Playing recording...</span>';
        setTimeout(() => {
            DOM.pianoNotesDisplay.innerHTML = state.pianoNotes.map(n => `<span style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:12px;">${n}</span>`).join(' ');
        }, (state.pianoRecording[state.pianoRecording.length-1].time - startTime) + 500);
    }
    // ---------- Sequencer ----------
    initSequencer() {
        const instruments = ['kick','snare','hihat','clap'];
        const steps = 16;
        const grid = DOM.sequencerGrid;
        grid.innerHTML = '';
        const headerRow = document.createElement('div');
        headerRow.className = 'seq-row';
        const label = document.createElement('div');
        label.className = 'seq-label';
        label.textContent = '';
        headerRow.appendChild(label);
        for (let i=0; i<steps; i++) {
            const cell = document.createElement('div');
            cell.className = 'seq-label';
            cell.textContent = i+1;
            cell.style.fontSize = '9px';
            headerRow.appendChild(cell);
        }
        grid.appendChild(headerRow);
        instruments.forEach(inst => {
            const row = document.createElement('div');
            row.className = 'seq-row';
            const lbl = document.createElement('div');
            lbl.className = 'seq-label';
            lbl.textContent = inst;
            row.appendChild(lbl);
            state.seqPattern[inst] = [];
            for (let i=0; i<steps; i++) {
                state.seqPattern[inst][i] = false;
                const cell = document.createElement('div');
                cell.className = 'seq-cell';
                cell.dataset.inst = inst;
                cell.dataset.step = i;
                cell.addEventListener('click', () => {
                    if (state.activeInst === inst || !cell.classList.contains('active')) {
                        cell.classList.toggle('active');
                        state.seqPattern[inst][i] = cell.classList.contains('active');
                    }
                });
                row.appendChild(cell);
            }
            grid.appendChild(row);
        });
        DOM.instBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.instBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.activeInst = btn.dataset.inst;
            });
        });
        DOM.playSeqBtn.addEventListener('click', () => this.startSequencer());
        DOM.stopSeqBtn.addEventListener('click', () => this.stopSequencer());
        DOM.clearSeqBtn.addEventListener('click', () => this.clearSequencer());
        DOM.bpmInput.addEventListener('change', () => {
            state.seqBPM = parseInt(DOM.bpmInput.value) || 120;
            if (this.seqPlaying) { this.stopSequencer(); this.startSequencer(); }
        });
        DOM.swingSlider.addEventListener('input', () => {
            state.seqSwing = parseFloat(DOM.swingSlider.value) / 100;
        });
    }
    startSequencer() {
        if (this.seqPlaying) return;
        this.seqPlaying = true;
        this.seqStep = 0;
        const interval = 60000 / state.seqBPM / 4;
        DOM.playSeqBtn.textContent = '▶ Playing';
        DOM.playSeqBtn.style.background = 'var(--accent-2)';
        this.seqInterval = setInterval(() => {
            this.playSeqStep(this.seqStep);
            this.seqStep = (this.seqStep + 1) % 16;
        }, interval);
    }
    stopSequencer() {
        this.seqPlaying = false;
        if (this.seqInterval) clearInterval(this.seqInterval);
        DOM.playSeqBtn.textContent = '▶ Play';
        DOM.playSeqBtn.style.background = '';
        document.querySelectorAll('.seq-cell.playing').forEach(c => c.classList.remove('playing'));
    }
    clearSequencer() {
        this.stopSequencer();
        document.querySelectorAll('.seq-cell.active').forEach(c => c.classList.remove('active'));
        const insts = ['kick','snare','hihat','clap'];
        insts.forEach(inst => {
            for (let i=0; i<16; i++) state.seqPattern[inst][i] = false;
        });
    }
    playSeqStep(step) {
        document.querySelectorAll('.seq-cell.playing').forEach(c => c.classList.remove('playing'));
        document.querySelectorAll(`.seq-cell[data-step="${step}"]`).forEach(c => c.classList.add('playing'));
        const insts = ['kick','snare','hihat','clap'];
        for (const inst of insts) {
            if (state.seqPattern[inst][step]) {
                this.playSeqSound(inst);
            }
        }
    }
    playSeqSound(inst) {
        if (!this._seqCtx) this._seqCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this._seqCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        let freq = 100, type = 'sine', duration = 0.15, volume = 0.3;
        switch(inst) {
            case 'kick': freq = 60; type = 'sine'; duration = 0.2; volume = 0.5; break;
            case 'snare': freq = 200; type = 'sawtooth'; duration = 0.1; volume = 0.3; break;
            case 'hihat': freq = 6000; type = 'square'; duration = 0.05; volume = 0.2; break;
            case 'clap': freq = 800; type = 'triangle'; duration = 0.06; volume = 0.3; break;
        }
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }
    // ---------- Lyrics ----------
    async generateVoice() {
        const text = DOM.lyricsInput.value.trim();
        if (!text) { DOM.lyricsStatus.textContent = '⚠️ Please enter some lyrics.'; return; }
        const style = DOM.voiceStyleSelect.value;
        DOM.lyricsStatus.textContent = '⏳ Generating voice...';
        this.showProcessing('Generating voice with ' + style + ' style...');
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            if (style === 'demonic') { utterance.pitch = 0.4; utterance.rate = 0.7; }
            else if (style === 'robot') { utterance.pitch = 0.6; utterance.rate = 0.8; }
            else if (style === 'angelic') { utterance.pitch = 1.6; utterance.rate = 0.8; }
            else if (style === 'monster') { utterance.pitch = 0.3; utterance.rate = 0.5; }
            else if (style === 'chipmunk') { utterance.pitch = 2.0; utterance.rate = 1.5; }
            else if (style === 'deep') { utterance.pitch = 0.3; utterance.rate = 0.6; }
            window.speechSynthesis.speak(utterance);
            DOM.lyricsStatus.textContent = '🔊 Speaking...';
            DOM.lyricsPreview.style.display = 'block';
            DOM.lyricsPreview.textContent = `"${text}" (${style} style)`;
            this.hideProcessing('✅ Voice spoken!');
            DOM.playVoiceBtn.style.display = 'none';
            DOM.downloadVoiceBtn.style.display = 'none';
            DOM.lyricsStatus.textContent = '✅ Voice generated using browser TTS. Download not supported in this demo.';
        } catch(e) {
            DOM.lyricsStatus.textContent = '❌ Error: ' + e.message;
            this.hideProcessing('❌ Error');
        }
    }
    playGeneratedVoice() { }
    downloadGeneratedVoice() { }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.app = app;
});
