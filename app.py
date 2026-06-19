import os, json, uuid, time, shutil
from datetime import datetime
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename

try:
    from pydub import AudioSegment
    from pydub.effects import normalize
    AUDIO_LOADED = True
except:
    AUDIO_LOADED = False

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
app.config['SECRET_KEY'] = 'monky-sound-pro-2026'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('processed', exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    filename = secure_filename(file.filename)
    uid = str(uuid.uuid4())[:8]
    saved = f"{uid}_{filename}"
    path = os.path.join(app.config['UPLOAD_FOLDER'], saved)
    file.save(path)
    return jsonify({'success': True, 'filename': saved, 'filepath': path})

@app.route('/api/process', methods=['POST'])
def process_audio():
    data = request.json
    filename = data.get('filename')
    effects = data.get('effects', {})
    if not filename:
        return jsonify({'error': 'No filename'}), 400
    src = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(src):
        return jsonify({'error': 'File not found'}), 404
    out_id = str(uuid.uuid4())[:8]
    out_name = f"processed_{out_id}.wav"
    out_path = os.path.join('processed', out_name)
    try:
        if AUDIO_LOADED:
            audio = AudioSegment.from_file(src)
            # Apply effects (simplified)
            audio.export(out_path, format="wav")
            dur = len(audio) / 1000.0
        else:
            shutil.copy(src, out_path)
            dur = 10.0
        return jsonify({'success': True, 'filename': out_name, 'duration': dur})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def translate_voice():
    data = request.json
    filename = data.get('filename')
    style = data.get('style', 'demonic')
    if not filename:
        return jsonify({'error': 'No filename'}), 400
    src = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(src):
        return jsonify({'error': 'File not found'}), 404
    out_id = str(uuid.uuid4())[:8]
    out_name = f"translated_{out_id}.wav"
    out_path = os.path.join('processed', out_name)
    try:
        if AUDIO_LOADED:
            audio = AudioSegment.from_file(src)
            audio.export(out_path, format="wav")
            dur = len(audio) / 1000.0
        else:
            shutil.copy(src, out_path)
            dur = 10.0
        return jsonify({'success': True, 'filename': out_name, 'duration': dur, 'style': style})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<filename>')
def download(filename):
    path = os.path.join('processed', filename)
    if not os.path.exists(path):
        return jsonify({'error': 'File not found'}), 404
    return send_file(path, as_attachment=True, download_name=filename)

@app.route('/api/play/<filename>')
def play(filename):
    path = os.path.join('processed', filename)
    if not os.path.exists(path):
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(path):
        return jsonify({'error': 'File not found'}), 404
    return send_file(path, mimetype='audio/wav')

@app.route('/api/effects', methods=['GET'])
def get_effects():
    return jsonify({
        'pitch': {'type': 'range', 'min': -12, 'max': 12, 'default': 0, 'label': 'Pitch'},
        'reverb': {'type': 'range', 'min': 0, 'max': 100, 'default': 0, 'label': 'Reverb'},
        'distortion': {'type': 'range', 'min': 0, 'max': 100, 'default': 0, 'label': 'Distortion'},
        'echo': {'type': 'range', 'min': 0, 'max': 100, 'default': 0, 'label': 'Echo'},
        'demonic': {'type': 'toggle', 'default': False, 'label': '👹 Demonic'},
        'robot': {'type': 'toggle', 'default': False, 'label': '🤖 Robot'},
    })

@app.route('/api/styles', methods=['GET'])
def get_styles():
    return jsonify([
        {'id': 'demonic', 'label': '👹 Demonic'},
        {'id': 'robot', 'label': '🤖 Robot'},
        {'id': 'angelic', 'label': '😇 Angelic'},
        {'id': 'monster', 'label': '👾 Monster'},
        {'id': 'chipmunk', 'label': '🐿️ Chipmunk'},
        {'id': 'deep', 'label': '🌊 Deep'},
    ])

@app.route('/api/files', methods=['GET'])
def list_files():
    uploaded = []
    processed = []
    for f in os.listdir(app.config['UPLOAD_FOLDER']):
        p = os.path.join(app.config['UPLOAD_FOLDER'], f)
        if os.path.isfile(p):
            uploaded.append({'name': f, 'size': os.path.getsize(p)})
    for f in os.listdir('processed'):
        p = os.path.join('processed', f)
        if os.path.isfile(p):
            processed.append({'name': f, 'size': os.path.getsize(p)})
    return jsonify({'uploaded': uploaded, 'processed': processed})

@app.route('/api/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    for folder in ['processed', app.config['UPLOAD_FOLDER']]:
        p = os.path.join(folder, filename)
        if os.path.exists(p):
            os.remove(p)
            return jsonify({'success': True})
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
