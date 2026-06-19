const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('static'));

// Ensure upload folders exist
['uploads', 'processed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Multer config
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates/index.html'));
});

// Upload endpoint
app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.filename, filepath: req.file.path });
});

// Process audio (apply effects using ffmpeg)
app.post('/api/process', async (req, res) => {
  const { filename, effects } = req.body;
  if (!filename) return res.status(400).json({ error: 'No filename' });
  const src = path.join('uploads', filename);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'File not found' });

  const outId = uuidv4().slice(0, 8);
  const outName = `processed_${outId}.wav`;
  const outPath = path.join('processed', outName);

  // Build ffmpeg command with effects
  let command = ffmpeg(src);
  // Simple pitch shift (using asetrate + atempo)
  const pitch = effects?.pitch || 0;
  if (pitch !== 0) {
    const factor = Math.pow(2, pitch / 12);
    command = command.audioFilters(`asetrate=44100*${factor},atempo=${1/factor}`);
  }
  // Reverb (using aecho)
  const reverb = effects?.reverb || 0;
  if (reverb > 0) {
    const delay = 50 + reverb * 2;
    const decay = 0.3 + (reverb / 100) * 0.5;
    command = command.audioFilters(`aecho=0.8:${decay}:${delay}:0.5`);
  }
  // Distortion (overdrive)
  const distortion = effects?.distortion || 0;
  if (distortion > 0) {
    command = command.audioFilters(`overdrive=${distortion/100}:${distortion/100}`);
  }
  // Echo
  const echo = effects?.echo || 0;
  if (echo > 0) {
    const delay = 100 + echo * 2;
    const decay = 0.2 + (echo / 100) * 0.6;
    command = command.audioFilters(`aecho=0.8:${decay}:${delay}:0.5`);
  }
  // Demonic (pitch down + distortion + reverb)
  if (effects?.demonic) {
    command = command.audioFilters('asetrate=22050,atempo=0.5,overdrive=0.4,aecho=0.8:0.5:80:0.5');
  }
  // Robot (pitch + distortion + echo)
  if (effects?.robot) {
    command = command.audioFilters('asetrate=35280,atempo=0.8,overdrive=0.5,aecho=0.8:0.3:60:0.3');
  }

  command.output(outPath)
    .on('end', () => {
      res.json({ success: true, filename: outName, duration: 10 }); // duration not used
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: 'Processing failed' });
    })
    .run();
});

// Translate voice
app.post('/api/translate', async (req, res) => {
  const { filename, style } = req.body;
  if (!filename) return res.status(400).json({ error: 'No filename' });
  const src = path.join('uploads', filename);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'File not found' });

  const outId = uuidv4().slice(0, 8);
  const outName = `translated_${outId}.wav`;
  const outPath = path.join('processed', outName);

  let command = ffmpeg(src);
  switch (style) {
    case 'demonic':
      command = command.audioFilters('asetrate=22050,atempo=0.5,overdrive=0.4,aecho=0.8:0.5:80:0.5');
      break;
    case 'robot':
      command = command.audioFilters('asetrate=35280,atempo=0.8,overdrive=0.5,aecho=0.8:0.3:60:0.3');
      break;
    case 'angelic':
      command = command.audioFilters('asetrate=48000*1.3,atempo=0.77,aecho=0.8:0.4:100:0.4');
      break;
    case 'monster':
      command = command.audioFilters('asetrate=18000,atempo=0.35,overdrive=0.6,aecho=0.8:0.7:120:0.7');
      break;
    case 'chipmunk':
      command = command.audioFilters('asetrate=48000*1.8,atempo=0.56');
      break;
    case 'deep':
      command = command.audioFilters('asetrate=22050,atempo=0.6,aecho=0.8:0.2:60:0.2');
      break;
    default:
      break;
  }
  command.output(outPath)
    .on('end', () => {
      res.json({ success: true, filename: outName, style });
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: 'Translation failed' });
    })
    .run();
});

// Download
app.get('/api/download/:filename', (req, res) => {
  const file = path.join('processed', req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
  res.download(file);
});

// Play (stream)
app.get('/api/play/:filename', (req, res) => {
  let file = path.join('processed', req.params.filename);
  if (!fs.existsSync(file)) file = path.join('uploads', req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(file);
});

// List files
app.get('/api/files', (req, res) => {
  const uploads = fs.readdirSync('uploads').filter(f => fs.statSync(path.join('uploads', f)).isFile()).map(f => ({ name: f, size: fs.statSync(path.join('uploads', f)).size }));
  const processed = fs.readdirSync('processed').filter(f => fs.statSync(path.join('processed', f)).isFile()).map(f => ({ name: f, size: fs.statSync(path.join('processed', f)).size }));
  res.json({ uploaded: uploads, processed });
});

// Delete
app.delete('/api/delete/:filename', (req, res) => {
  const f = req.params.filename;
  for (const folder of ['processed', 'uploads']) {
    const p = path.join(folder, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      return res.json({ success: true });
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// Effects and styles endpoints (static data)
app.get('/api/effects', (req, res) => {
  res.json({
    pitch: { type: 'range', min: -12, max: 12, default: 0, label: 'Pitch' },
    reverb: { type: 'range', min: 0, max: 100, default: 0, label: 'Reverb' },
    distortion: { type: 'range', min: 0, max: 100, default: 0, label: 'Distortion' },
    echo: { type: 'range', min: 0, max: 100, default: 0, label: 'Echo' },
    demonic: { type: 'toggle', default: false, label: '👹 Demonic' },
    robot: { type: 'toggle', default: false, label: '🤖 Robot' },
  });
});

app.get('/api/styles', (req, res) => {
  res.json([
    { id: 'demonic', label: '👹 Demonic' },
    { id: 'robot', label: '🤖 Robot' },
    { id: 'angelic', label: '😇 Angelic' },
    { id: 'monster', label: '👾 Monster' },
    { id: 'chipmunk', label: '🐿️ Chipmunk' },
    { id: 'deep', label: '🌊 Deep' },
  ]);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Monky Sound Pro running on http://localhost:${PORT}`);
});
