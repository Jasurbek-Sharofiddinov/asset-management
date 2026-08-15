import io
import json

import qrcode
from qrcode.constants import ERROR_CORRECT_H


def generate_qr_code(asset_data: dict | str) -> bytes:
    """Generate a QR code PNG from a minimal asset payload or raw string."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    if isinstance(asset_data, str):
        payload = asset_data
    else:
        payload = json.dumps(asset_data, default=str, ensure_ascii=False)
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()
