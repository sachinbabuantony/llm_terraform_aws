from flask import current_app as app, request, Blueprint, jsonify, send_from_directory
import os
import json
from datetime import datetime
from llm_processing import structure_text

# Create the Blueprint for all extraction routes
blueprint = Blueprint('extraction', __name__, url_prefix='/extraction')

# Helper Functions
def get_timestamp():
    """Generate a timestamp in the format YYYYMMDD_HHMMSS"""
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def save_csv_file(csv_data, directory, timestamp):
    """Save CSV data to file and return the filepath"""
    filename = f"structured_{timestamp}.csv"
    filepath = os.path.join(directory, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(csv_data)
        
    return filename

def ensure_directory_exists(directory_path):
    """Create directory if it doesn't exist"""
    if not os.path.exists(directory_path):
        os.makedirs(directory_path, exist_ok=True)
        return False
    return True

def load_ocr_data(file_path):
    """Load OCR data from a JSON file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_text_from_ocr(ocr_data):
    """Extract plain text from OCR data word objects"""
    if 'word_objects' in ocr_data:
        return ' '.join([word['text'] for word in ocr_data['word_objects']])
    return ""

def process_single_document(file_path, filename):
    """Process a single OCR document and return structured data"""
    try:
        ocr_data = load_ocr_data(file_path)
        text = extract_text_from_ocr(ocr_data)
        
        if not text:
            return None
            
        structured_data = structure_text(text)
        
        # Add source information to each field
        fields_with_source = []
        for field in structured_data['fields']:
            fields_with_source.append({
                "name": field['name'],
                "value": field['value'],
                "source": filename
            })
        
        return {
            "filename": filename,
            "page": ocr_data.get('page', 1),
            "fields": fields_with_source
        }
    except Exception as e:
        print(f"Error processing {filename}: {str(e)}")
        return None

# Route Handlers
@blueprint.route('/', methods=['POST'])  
def extraction():
    """
    Process a single text using LLM and save as CSV
    
    Expected request format:
    {
        "text": "Text content to structure"
    }
    """
    try:
        # Get text from request
        data = request.json
        timestamp = get_timestamp()
        
        # Process with LLM
        csv_data = structure_text(data['text'])
        
        # Save to file
        csv_filename = save_csv_file(csv_data, app.config['STEP_6_DIR'], timestamp)
            
        return jsonify({
            'success': True,
            'timestamp': timestamp,
            'csv_data': csv_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@blueprint.route('/download/<timestamp>', methods=['GET'])
def download_csv(timestamp):
    """Download a previously generated CSV file by timestamp"""
    try:
        filename = f"structured_{timestamp}.csv"
        return send_from_directory(
            app.config['STEP_6_DIR'],
            filename,
            as_attachment=True,
            mimetype='text/csv'
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@blueprint.route('/process-all', methods=['POST'])
def process_all_documents():
    """Process all OCR documents in the confirmed OCR directory"""
    try:
        # Get directory path for confirmed OCR files
        confirmed_ocr_dir = os.path.join(os.path.dirname(app.config['STEP_6_DIR']), 
                                         'step_3_5_with_confirmed_ocr_files')
        
        # Check if directory exists
        if not ensure_directory_exists(confirmed_ocr_dir):
            return jsonify({
                'success': False,
                'error': f'Directory not found or empty: {confirmed_ocr_dir}'
            }), 500
            
        # Initialize result
        result_data = {"documents": []}
        
        # Get list of files
        files = os.listdir(confirmed_ocr_dir)
        
        if not files:
            return jsonify({
                'success': False,
                'error': 'No files found in directory'
            }), 500
        
        # Process each JSON file
        for filename in files:
            if filename.endswith('.json'):
                file_path = os.path.join(confirmed_ocr_dir, filename)
                document_data = process_single_document(file_path, filename)
                
                if document_data:
                    result_data['documents'].append(document_data)
        
        # Check if any documents were processed
        if not result_data['documents']:
            return jsonify({
                'success': False,
                'error': 'No documents were successfully processed'
            }), 500
        
        # Save results
        step_6_dir = app.config['STEP_6_DIR']
        ensure_directory_exists(step_6_dir)
        
        timestamp = get_timestamp()
        output_path = os.path.join(step_6_dir, f'structured_data_{timestamp}.json')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)
            
        return jsonify({
            'success': True,
            'data': result_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
