import sys
import ocrmypdf
import pdfplumber
import tempfile
import os

def ocr_pdf_and_extract_text(pdf_path):
    try:
        # Create a temporary OCR output file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_ocr_file:
            ocr_output_path = temp_ocr_file.name

        # Apply OCR to the PDF
        ocrmypdf.ocr(pdf_path, ocr_output_path, force_ocr=True, use_threads=True, output_type='pdf')

        # Extract text from the OCR’d PDF
        full_text = ""
        with pdfplumber.open(ocr_output_path) as pdf:
            for page in pdf.pages:
                full_text += page.extract_text() + "\n"

        # Clean up temp file
        os.remove(ocr_output_path)

        return full_text.strip()
    except Exception as e:
        return f"[ERROR] {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("[ERROR] Usage: python ocr_pdf.py <pdf_file_path>")
        sys.exit(1)

    result = ocr_pdf_and_extract_text(sys.argv[1])
    print(result)
