# server/python/ocr_service/main.py

import sys
import os
from utils import convert_pdf_to_images, extract_text_from_images

def process_document(pdf_path: str) -> str:
    try:
        images = convert_pdf_to_images(pdf_path)
        text = extract_text_from_images(images)
        return text
    except Exception as e:
        return f"[ERROR] OCR failed: {e}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"[ERROR] File not found: {pdf_path}")
        sys.exit(1)

    result = process_document(pdf_path)
    print(result)
