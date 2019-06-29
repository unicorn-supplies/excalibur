import os
import subprocess
import sys
import traceback

from .. import configuration as conf


def mkdirs(path):
    if not os.path.isdir(path):
        os.makedirs(path)


def allowed_filename(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in conf.ALLOWED_EXTENSIONS
    )


def ocr_file(
    pdf_or_image_filename,
    output_suffix=None,
    language=None,
    output_type=None,
    force_ocr=None,
):
    language = language or "Cyrillic+Latin+eng+swe+nor"  # "nor"
    output_pdf = pdf_or_image_filename + (output_suffix or "")
    output_type = output_type or "pdf"  # or "pdfa"

    deskew = False
    rotate_pages = False
    remove_vectors = True
    mask_barcodes = False
    clean_final = False
    remove_background = True
    min_dpi = 300

    command = list(
        filter(
            None,
            [
                "ocrmypdf",
                f"--language={language}",
                f"--output-type={output_type}",
                "--rotate-pages" if rotate_pages else "",
                "--remove-vectors" if remove_vectors else "",
                "--mask-barcodes" if mask_barcodes else "",
                "--deskew" if deskew else "",
                "--clean",
                "--clean-final" if clean_final else "",
                "--remove-background" if remove_background else "",
                f"--oversample={min_dpi}" if min_dpi is not None else "",
                "--skip-text"
                if force_ocr is not True
                else "--force-ocr"
                if force_ocr
                else "",
                "--quiet",
                pdf_or_image_filename,
                output_pdf,
            ],
        )
    )

    try:
        subprocess.check_call(command, stderr=subprocess.STDOUT, close_fds=True)

    except Exception as e:
        print(f"OCR error:{e!s}")
        traceback.print_exc()
        sys.exit(1)

    print(f"OCR success: input={pdf_or_image_filename}, output={output_pdf}")
    return output_pdf
