"""Downloads a file from a public link. Google Drive share links are turned into direct downloads."""

import re
from urllib.parse import urlparse

import httpx

from .config import get_settings

UA = {"User-Agent": "Mozilla/5.0"}


class FetchError(ValueError):
    pass


def drive_id(url: str) -> str | None:
    match = re.search(r"/d/([\w-]+)", url) or re.search(r"[?&]id=([\w-]+)", url)
    return match.group(1) if match and "drive.google" in url else None


def download(url: str) -> tuple[bytes, str]:
    """Returns (bytes, filename). Raises FetchError with a message meant for the admin."""
    if urlparse(url).scheme not in ("http", "https"):
        raise FetchError("Only http(s) links are supported.")
    limit = get_settings().max_file_mb * 1024 * 1024
    file_id = drive_id(url)
    target = f"https://drive.google.com/uc?export=download&id={file_id}" if file_id else url

    with httpx.Client(follow_redirects=True, timeout=180, headers=UA) as client:
        res = client.get(target)
        if res.status_code >= 400:
            raise FetchError(f"Download failed ({res.status_code}).")
        data = res.content

        # Large Drive files answer with a "can't scan for viruses" page that holds a confirm token
        if file_id and data[:5] != b"%PDF-" and b"<html" in data[:2000].lower():
            html = res.text
            confirm = re.search(r'name="confirm" value="([^"]+)"', html)
            uuid = re.search(r'name="uuid" value="([^"]+)"', html)
            if not confirm:
                raise FetchError("Drive file is not public. Share it as 'Anyone with the link' or upload the PDF instead.")
            params = {"id": file_id, "export": "download", "confirm": confirm.group(1)}
            if uuid:
                params["uuid"] = uuid.group(1)
            res = client.get("https://drive.usercontent.google.com/download", params=params)
            data = res.content

    if len(data) > limit:
        raise FetchError(f"File is larger than {get_settings().max_file_mb} MB.")
    is_image = data[:4] == b"\x89PNG" or data[:3] == b"\xff\xd8\xff" or data[:4] == b"RIFF"
    if data[:5] != b"%PDF-" and not is_image:
        raise FetchError("Link did not return a PDF or image.")
    name = f"{file_id}.pdf" if file_id else (urlparse(url).path.rsplit("/", 1)[-1] or "download")
    return data, name
