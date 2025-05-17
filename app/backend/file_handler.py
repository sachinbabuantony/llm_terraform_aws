import os
import cv2
import fitz
import numpy as np
from PIL import Image
from typing import List, Dict
from ocr_processing import perform_ocr_processing
import json
from config import FILE_CONFIG

class FileHandler:
    def __init__(self, base_dir: str):
        """
        Initialize FileHandler with base directory and create workflow directories
        
        Args:
            base_dir (str): Base directory for all workflow folders
        """
        # Set up all directory paths
        self.setup_directories(base_dir)
        
        # Create all needed directories
        self.create_workflow_directories()

    def setup_directories(self, base_dir: str):
        """Define all directory paths used in the workflow"""
        # Main workflow directory
        self.workflow_dir = os.path.join(base_dir, 'files_workflow')
        
        # Step-by-step directories for the processing pipeline
        self.upload_dir = os.path.join(self.workflow_dir, 'step_1_from_user_uploaded_files')
        self.preprocessed_dir = os.path.join(self.workflow_dir, 'step_2_for_ocr_preprocessed_files')
        self.processed_dir = os.path.join(self.workflow_dir, 'step_3_with_ocr_proccessed_files')
        self.confirmed_ocr_dir = os.path.join(self.workflow_dir, 'step_3_5_with_confirmed_ocr_files')
        self.structured_dir = os.path.join(self.workflow_dir, 'step_6_with_llm_structured_data')
        
        # Frontend resources directory
        self.static_resources_dir = os.path.join(base_dir, '..', 'frontend', 'static', 'ressources')

    def create_workflow_directories(self):
        """Create all required workflow directories"""
        directories = [
            self.workflow_dir,
            self.upload_dir,
            self.preprocessed_dir,
            self.processed_dir,
            self.confirmed_ocr_dir,
            self.structured_dir,
            self.static_resources_dir
        ]
        
        # Create each directory if it doesn't exist
        for directory in directories:
            os.makedirs(directory, exist_ok=True)

    # File Type Handling
    @staticmethod
    def handle_file_type(filename: str) -> str:
        """
        Determine file type based on file extension
        
        Args:
            filename (str): Name of the file
            
        Returns:
            str: 'image', 'pdf', or 'unknown'
        """
        lower_filename = filename.lower()
        
        # Check if it's an image file
        if lower_filename.endswith(FILE_CONFIG["ALLOWED_IMAGE_EXTENSIONS"]):
            return 'image'
        
        # Check if it's a PDF file
        elif lower_filename.endswith(FILE_CONFIG["ALLOWED_DOC_EXTENSIONS"]):
            return 'pdf'
            
        # Unknown file type
        return 'unknown'

    # File Saving Functions
    def save_preprocessed_image(self, image: np.ndarray, filename: str) -> str:
        """
        Save preprocessed image to step 2 directory
        
        Args:
            image (np.ndarray): Image as numpy array
            filename (str): Filename to save as
            
        Returns:
            str: Path where image was saved
        """
        save_path = os.path.join(self.preprocessed_dir, filename)
        cv2.imwrite(save_path, image)
        return save_path

    def save_processed_result(self, text: str, filename: str, json_data: dict = None) -> tuple:
        """
        Save OCR result to step 3 directory - both text and JSON format
        
        Args:
            text (str): The extracted OCR text
            filename (str): Original filename
            json_data (dict): JSON data containing OCR results with word objects
            
        Returns:
            tuple: (text_path, json_path)
        """
        base_name = os.path.splitext(filename)[0]
        
        # Save text file
        text_path = os.path.join(self.processed_dir, f"{base_name}_ocr.txt")
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(text)
        
        # Save JSON file if provided
        json_path = None
        if json_data:
            json_path = os.path.join(self.processed_dir, f"{base_name}_ocr.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            
        return text_path, json_path

    # Image Processing Functions
    def process_image(self, img: np.ndarray, filename: str) -> Dict:
        """
        Process a single image through OCR
        
        Args:
            img (np.ndarray): Image as numpy array
            filename (str): Original filename
            
        Returns:
            Dict: Processing results with paths and OCR data
        """
        # Step 2: Preprocess and save image
        preprocessed_path = self.save_preprocessed_image(
            img, 
            f"preprocessed_{filename}"
        )
        
        # Step 3: Perform OCR
        ocr_result = perform_ocr_processing(img, filename)
        
        # Save OCR results
        processed_path, json_path = self.save_processed_result(
            ocr_result['text'], 
            filename,
            json_data={
                'text': ocr_result['text'],
                'word_objects': ocr_result['word_objects'],
                'mean_confidence': ocr_result['mean_confidence']
            }
        )
        
        # Return page information
        return {
            'page': 1,
            'text': ocr_result['text'],
            'word_objects': ocr_result['word_objects'],
            'mean_confidence': ocr_result['mean_confidence'],
            'preprocessed_path': preprocessed_path,
            'processed_path': processed_path,
            'json_path': json_path
        }

    def process_pdf(self, filepath: str, filename: str) -> List[Dict]:
        """
        Process a PDF file, extracting and processing each page
        
        Args:
            filepath (str): Path to the PDF file
            filename (str): Original filename
            
        Returns:
            List[Dict]: List of page results
        """
        pages = []
        
        # Open PDF document
        doc = fitz.open(filepath)
        
        # Process each page
        for page_num, page in enumerate(doc, 1):
            # Create a filename for this page
            page_filename = f"{os.path.splitext(filename)[0]}_page_{page_num}.jpg"
            
            # Convert PDF page to image
            pix = page.get_pixmap()
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_array = np.array(img)[:, :, ::-1]  # Convert RGB to BGR
            
            # Process the page image
            page_result = self.process_image(img_array, page_filename)
            
            # Add page number to result
            page_result['page'] = page_num
            
            pages.append(page_result)
            
        # Close the PDF
        doc.close()
        
        return pages

    # Main Processing Functions
    def process_file(self, filepath: str) -> Dict:
        """
        Process file through all workflow steps
        
        Args:
            filepath (str): Path to the file to process
            
        Returns:
            Dict: Processing results with all page data
        """
        # Get the filename and determine file type
        filename = os.path.basename(filepath)
        file_type = self.handle_file_type(filename)
        
        # Check file size
        self.check_file_size(filepath, filename)
        
        try:
            pages = []
            
            # Process based on file type
            if file_type == 'image':
                # Load and process single image
                img = cv2.imread(filepath)
                if img is not None:
                    page_result = self.process_image(img, filename)
                    pages.append(page_result)
                    
            elif file_type == 'pdf':
                # Process multi-page PDF
                pages = self.process_pdf(filepath, filename)

            # Return complete file processing results
            return {
                'filename': filename,
                'pages': pages
            }

        except Exception as e:
            raise RuntimeError(f"Error processing file {filename}: {str(e)}")

    def check_file_size(self, filepath: str, filename: str):
        """
        Check if file size is within allowed limits
        
        Args:
            filepath (str): Path to the file
            filename (str): Name of the file
            
        Raises:
            RuntimeError: If file exceeds maximum size
        """
        if os.path.getsize(filepath) > FILE_CONFIG["MAX_FILE_SIZE"]:
            max_mb = FILE_CONFIG["MAX_FILE_SIZE"] / (1024 * 1024)
            raise RuntimeError(f"File {filename} exceeds maximum size limit of {max_mb}MB")

    # Cleanup Functions
    def cleanup_directory(self, directory):
        """
        Delete all files in a directory
        
        Args:
            directory (str): Path to directory to clean
        """
        if os.path.exists(directory):
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                except Exception as e:
                    print(f"Error deleting {file_path}: {str(e)}")
                
    def cleanup_workflow_files(self):
        """Clean all workflow directories and static resources"""
        directories = [
            self.upload_dir,              # step_1_from_user_uploaded_files
            self.preprocessed_dir,        # step_2_for_ocr_preprocessed_files
            self.processed_dir,           # step_3_with_ocr_proccessed_files
            self.confirmed_ocr_dir,       # step_3.5_with_confirmed_ocr_files
            self.structured_dir,          # step_6_with_llm_structured_data
            self.static_resources_dir     # frontend/static/ressources
        ]
        
        # Clean each directory
        for directory in directories:
            self.cleanup_directory(directory)