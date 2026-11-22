"""
Runs OCR on one image and prints the text lines as JSON (top to bottom).

Started as a separate process by id_document.py so a crash in the native OCR
libraries (or a very slow image) can never take down the API server.

    python -m app.services.ocr_worker <image path>
"""
import json
import sys


def main(path: str) -> None:
    from rapidocr_onnxruntime import RapidOCR

    result, _ = RapidOCR()(path)
    result = result or []
    # [[box, text, score], ...]: order by the top edge, then left edge
    result.sort(key=lambda r: (min(p[1] for p in r[0]), min(p[0] for p in r[0])))
    print(json.dumps([str(r[1]).strip() for r in result if str(r[1]).strip()]))


if __name__ == "__main__":
    main(sys.argv[1])
