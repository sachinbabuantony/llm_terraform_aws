# Standard library imports
import os
import sys
import signal
import json

# Third-party imports
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

# Local imports
from file_handler import FileHandler
from extraction_service import blueprint as extraction_service

# Constants and Configuration
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

# Flask App Initialization
app = Flask(__name__, 
    static_folder='../frontend/static',  
    static_url_path=''  
)

# Set up file handler dirs in app config
app.config['STEP_6_DIR'] = os.path.join(BACKEND_DIR, 'files_workflow', 'step_6_with_llm_structured_data')

# Initialize Services
file_handler = FileHandler(BACKEND_DIR)

# Register Blueprints
app.register_blueprint(extraction_service)

# Cleanup and Signal Handling
def signal_handler(sig, frame):
    print('Received shutdown signal. Cleaning up...')
    file_handler.cleanup_workflow_files()
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)  # Handle termination signal
signal.signal(signal.SIGINT, signal_handler)   # Handle keyboard interrupt (Ctrl+C)

# Basic Routes
@app.route('/')
def serve_index():
    """Serve the main application page"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/preprocessed/<path:filename>')
def serve_preprocessed(filename):
    """Serve files from the preprocessed directory (step 2)"""
    preprocessed_dir = file_handler.preprocessed_dir
    return send_from_directory(preprocessed_dir, filename)

# File Management Routes
@app.route('/cleanup', methods=['POST'])
def cleanup():
    """Cleanup all workflow directories"""
    file_handler.cleanup_workflow_files()
    return jsonify({'success': True, 'message': 'Cleanup successful'})

@app.route('/upload', methods=['POST'])
def upload_files():
    """Handle file uploads and processing"""
    # Clean up before processing new files
    file_handler.cleanup_workflow_files()
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    files = request.files.getlist('file')
    results = []
    
    for file in files:
        if file.filename == '':
            continue
            
        if file_handler.handle_file_type(file.filename) == 'unknown':
            continue
            
        filename = secure_filename(file.filename)
        filepath = os.path.join(file_handler.upload_dir, filename)
        
        try:
            file.save(filepath)
            result = file_handler.process_file(filepath)
            results.append(result)
        except Exception as e:
            app.logger.error(f"Error processing {filename}: {str(e)}")
            return jsonify({'error': f'Error processing {filename}'}), 500
    
    return jsonify({
        'success': True,
        'results': results
    })

# OCR Routes
@app.route('/ocr/save-corrections', methods=['POST'])
def save_corrections():
    """Save OCR corrections to JSON file"""
    try:
        data = request.json
        filename = data['filename']
        page = data['page']
        
        # Create filename for corrected JSON
        base_name = os.path.splitext(filename)[0]
        if page > 1:
            json_filename = f"{base_name}_page_{page}_ocr_corrected.json"
        else:
            json_filename = f"{base_name}_ocr_corrected.json"
        
        json_path = os.path.join(file_handler.confirmed_ocr_dir, json_filename)
        
        # Save corrected data
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': 'Corrections saved successfully',
            'path': json_path
        })
        
    except Exception as e:
        app.logger.error(f"Error saving corrections: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Main Entry Point
if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 8080))
    host = os.environ.get('FLASK_HOST', '0.0.0.0')  
    app.run(port=port, host=host, debug=False)
