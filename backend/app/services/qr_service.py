import io
import json

import qrcode
from qrcode.constants import ERROR_CORRECT_H


def generate_qr_code(asset_data: dict) -> bytes:
    """Generate a QR code PNG image from asset data dictionary.

    The QR code encodes a JSON payload containing asset details like:
    id, name, serial, category, status, assignedTo, branch, scanUrl.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    payload = json.dumps(asset_data, default=str, ensure_ascii=False)
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()
