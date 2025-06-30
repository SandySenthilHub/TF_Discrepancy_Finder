# server/python/ocr_service/utils.py

import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import numpy as np
import cv2
import io
from typing import List

def convert_pdf_to_images(pdf_path: str) -> List[Image.Image]:
    doc = fitz.open(pdf_path)
    images = []
    for page in doc:
        pix = page.get_pixmap(dpi=300)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        images.append(img)
    return images

def preprocess_with_opencv(pil_image: Image.Image) -> Image.Image:
    # Convert PIL to OpenCV format
    img = np.array(pil_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=30)

    # Binarize
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Deskew
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        (h, w) = binary.shape
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        binary = cv2.warpAffine(binary, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    return Image.fromarray(binary)

def extract_text_opencv_ocr(pil_image: Image.Image) -> str:
    cleaned = preprocess_with_opencv(pil_image)
    return pytesseract.image_to_string(cleaned, lang='eng')

def extract_text_from_images(images: List[Image.Image]) -> str:
    all_text = []
    for i, img in enumerate(images):
        try:
            print(f"[INFO] Extracting text from page {i + 1}")
            text = extract_text_opencv_ocr(img)
            all_text.append(text)
        except Exception as e:
            print(f"[ERROR] Failed to extract text from page {i + 1}: {e}")
            all_text.append(f"[ERROR] Failed to extract text: {e}")
    return "\n\n".join(all_text)
