import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Extraction Variables
EXTRACTION_VARIABLES = [
    "Aorta",
    "VE Diastólico",
    "Parede posterior",
    "VDF",
    "FE Teicholz",
    "Massa do VE",
    "Átrio esquerdo",
    "VE Sistólico",
    "Septo interventricular",
    "VSF",
    "FE Simpson"
]

# AWS Configuration
AWS_CONFIG = {
    "ACCESS_KEY": os.getenv('AWS_ACCESS_KEY'),
    "SECRET_KEY": os.getenv('AWS_SECRET_KEY'),
    "REGION": "us-east-1"
}

# File Processing Configuration
FILE_CONFIG = {
    "ALLOWED_IMAGE_EXTENSIONS": ('.png', '.jpg', '.jpeg'),
    "ALLOWED_DOC_EXTENSIONS": ('.pdf',),
    "MAX_FILE_SIZE": 10 * 1024 * 1024  # 10MB in bytes
}

# LLM Configuration
LLM_CONFIG = {
    "API_URL": "http://localhost:11434/v1/chat/completions",
    "MODEL": "llama3.1",
}

# OCR Configuration
OCR_CONFIG = {
    "VARIANT": "tesseract",  # Options: "tesseract", "docling", "aws"
    "CONFIDENCE_THRESHOLD": 90.0,  # Threshold for considering text as "confident"
}
