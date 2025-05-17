import cv2
import numpy as np
from PIL import Image, ImageDraw
import pytesseract
import boto3
from dotenv import load_dotenv
from config import OCR_CONFIG, AWS_CONFIG, FILE_CONFIG
import os
import tempfile
from contextlib import contextmanager

# For docling OCR method
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend

# Load environment variables for AWS credentials
load_dotenv()

OCR_VARIANT = OCR_CONFIG["VARIANT"]
RESOURCES_DIR = 'frontend/static/ressources'

def create_word_object(text, confidence, bbox, color):
    """Create a word object with consistent structure"""
    return {
        "text": text,
        "confidence": confidence,
        "bbox": bbox,
        "color": color
    }

def get_word_color(confidence):
    """Get color based on confidence threshold"""
    return "green" if confidence >= OCR_CONFIG["CONFIDENCE_THRESHOLD"] else "red"

def enhance_image(img):
    """Enhance image for better OCR processing"""
    # Convert to grayscale and normalize
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    p1, p99 = np.percentile(gray, (1, 99))
    img_rescale = np.clip((gray - p1) * 255.0 / (p99 - p1), 0, 255).astype(np.uint8)
    
    # Apply bilateral filtering
    bilateral = cv2.bilateralFilter(img_rescale, d=9, sigmaColor=75, sigmaSpace=75)
    
    # Scale image up by 200%
    scale_percent = 200
    width = int(bilateral.shape[1] * scale_percent / 100)
    height = int(bilateral.shape[0] * scale_percent / 100)
    img_scaled = cv2.resize(bilateral, (width, height), interpolation=cv2.INTER_LANCZOS4)
    
    # Apply thresholding and cleanup
    binary = cv2.adaptiveThreshold(
        img_scaled, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, blockSize=21, C=11
    )
    morph = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((2,2), np.uint8))
    
    # Return the enhanced image and scale factor (for bbox scaling)
    scale_factor = scale_percent / 100
    result = cv2.bitwise_not(morph) if np.mean(morph) < 127 else morph
    
    return result, scale_factor

@contextmanager
def temp_image_file(img):
    """Context manager for temporary image file handling"""
    temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
    cv2.imwrite(temp_path, img)
    try:
        yield temp_path
    finally:
        if os.path.exists(temp_path):
            os.close(temp_fd)
            os.remove(temp_path)

def process_word_objects(words_data, scale_factor=1):
    """Process word data into word objects with confidence scores"""
    word_objects = []
    total_confidence = 0
    word_count = 0
    
    for word in words_data:
        if not word['text'].strip() or word.get('confidence', -1) == -1:
            continue
            
        confidence = float(word['confidence'])
        word_count += 1
        total_confidence += confidence
        
        # Apply scaling to all bounding box coordinates
        bbox = word['bbox']
        word_obj = create_word_object(
            text=word['text'],
            confidence=confidence,
            bbox={
                "x": int(bbox['x'] / scale_factor),
                "y": int(bbox['y'] / scale_factor),
                "width": int(bbox['width'] / scale_factor),
                "height": int(bbox['height'] / scale_factor)
            },
            color=get_word_color(confidence)
        )
        word_objects.append(word_obj)
    
    mean_confidence = total_confidence / word_count if word_count > 0 else 0.0
    return word_objects, mean_confidence

def process_tesseract_ocr(img):
    """Process image using Tesseract OCR"""
    enhanced_image, scale_factor = enhance_image(img)
    pil_image = Image.fromarray(enhanced_image)
    
    # Get text and word data
    extracted_text = pytesseract.image_to_string(pil_image, config='--psm 6 --oem 3')
    boxes_data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
    
    # Convert Tesseract data to word objects
    words_data = [
        {
            'text': boxes_data['text'][i],
            'confidence': boxes_data['conf'][i],
            'bbox': {
                'x': boxes_data['left'][i],
                'y': boxes_data['top'][i],
                'width': boxes_data['width'][i],
                'height': boxes_data['height'][i]
            }
        }
        for i in range(len(boxes_data['text']))
    ]
    
    # Process results with scaling
    word_objects, mean_confidence = process_word_objects(words_data, scale_factor)
    
    return {'text': extracted_text, 'word_objects': word_objects, 'mean_confidence': mean_confidence}

def process_docling_ocr(img):
    """Process image using Docling OCR"""
    try:
        with temp_image_file(img) as temp_path:
            # Configure and run Docling
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = True
            pipeline_options.do_table_structure = True
            
            doc_converter = DocumentConverter(
                format_options={
                    InputFormat.IMAGE: PdfFormatOption(
                        pipeline_options=pipeline_options,
                        backend=PyPdfiumDocumentBackend
                    )
                }
            )
            
            result = doc_converter.convert(temp_path)
            docling_text = ' '.join(result.document.export_to_text().split())
    except Exception as e:
        print(f"Error in Docling processing: {str(e)}")
        docling_text = ""
    
    # Use Tesseract for word detection
    enhanced_image, scale_factor = enhance_image(img)
    pil_image = Image.fromarray(enhanced_image)
    boxes_data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
    
    # Convert to word objects
    words_data = [
        {
            'text': boxes_data['text'][i],
            'confidence': boxes_data['conf'][i],
            'bbox': {
                'x': boxes_data['left'][i],
                'y': boxes_data['top'][i],
                'width': boxes_data['width'][i],
                'height': boxes_data['height'][i]
            }
        }
        for i in range(len(boxes_data['text']))
    ]
    
    word_objects, mean_confidence = process_word_objects(words_data, scale_factor)
    
    return {
        'text': docling_text if docling_text else ' '.join([w['text'] for w in word_objects]),
        'word_objects': word_objects,
        'mean_confidence': mean_confidence
    }

def process_aws_ocr(img):
    """Process image using AWS Textract OCR"""
    if not AWS_CONFIG["ACCESS_KEY"] or not AWS_CONFIG["SECRET_KEY"]:
        raise ValueError("AWS credentials not found in configuration")
    
    textract = boto3.client(
        'textract',
        aws_access_key_id=AWS_CONFIG["ACCESS_KEY"],
        aws_secret_access_key=AWS_CONFIG["SECRET_KEY"],
        region_name=AWS_CONFIG["REGION"]
    )
    
    with temp_image_file(img) as temp_path:
        with open(temp_path, 'rb') as document:
            response = textract.detect_document_text(Document={'Bytes': document.read()})
    
    # Extract text and word data
    extracted_text = '\n'.join([item['Text'] for item in response['Blocks'] 
                              if item['BlockType'] == 'LINE'])
    
    # Get original image dimensions for scaling
    img_height, img_width = img.shape[:2]
    
    words_data = [
        {
            'text': block['Text'],
            'confidence': block['Confidence'],
            'bbox': {
                'x': int(block['Geometry']['BoundingBox']['Left'] * img_width),
                'y': int(block['Geometry']['BoundingBox']['Top'] * img_height),
                'width': int(block['Geometry']['BoundingBox']['Width'] * img_width),
                'height': int(block['Geometry']['BoundingBox']['Height'] * img_height)
            }
        }
        for block in response['Blocks']
        if block['BlockType'] == 'WORD'
    ]
    
    # Process word objects (no scaling needed for AWS)
    word_objects, mean_confidence = process_word_objects(words_data, 1)
    
    return {'text': extracted_text, 'word_objects': word_objects, 'mean_confidence': mean_confidence}

def save_annotated_image(img, word_objects, filename):
    """Save image with word bounding boxes"""
    pil_image = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    drawer = ImageDraw.Draw(pil_image)
    
    for word in word_objects:
        padding = 1.5
        bbox = word['bbox']
        drawer.rectangle([
            bbox['x'] - padding,
            bbox['y'] - padding,
            bbox['x'] + bbox['width'] + padding,
            bbox['y'] + bbox['height'] + padding
        ], outline=word['color'], width=1)
    
    save_path = os.path.join(RESOURCES_DIR, f'preprocessed_{filename}')
    pil_image.save(save_path, quality=95)
    print(f"Saved annotated image to: {save_path}")

def perform_ocr_processing(img, filename=None):
    """Main OCR processing function that routes to the appropriate OCR engine"""
    ocr_processors = {
        "tesseract": process_tesseract_ocr,
        "docling": process_docling_ocr,
        "aws": process_aws_ocr
    }
    
    if OCR_VARIANT not in ocr_processors:
        raise ValueError(f"Unknown OCR variant: {OCR_VARIANT}")
    
    result = ocr_processors[OCR_VARIANT](img)
    
    if filename and result['word_objects']:
        save_annotated_image(img, result['word_objects'], filename)
    
    return result
