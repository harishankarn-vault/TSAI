from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)

# Ensure upload folder exists
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.get('/')
def index():
    return render_template('index.html')


@app.post('/upload')
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    try:
        file.save(save_path)
    except Exception as exc:
        return jsonify({'error': f'Failed to save file: {exc}'}), 500

    try:
        size_bytes = os.path.getsize(save_path)
    except OSError:
        size_bytes = None

    content_type = file.mimetype or 'application/octet-stream'

    return jsonify({'name': filename, 'size_bytes': size_bytes, 'type': content_type})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)

