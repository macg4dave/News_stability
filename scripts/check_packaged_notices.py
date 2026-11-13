"""Verify license files in built images without development mounts or network access."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def check_image(image, files):
    result = subprocess.run(
        ["docker", "run", "--rm", "--network", "none", "--entrypoint", "sha256sum",
         image, *[target for _, target in files]],
        check=True, capture_output=True, text=True,
    )
    lines = result.stdout.splitlines()
    if len(lines) != len(files):
        raise ValueError(f"Unexpected checksum output from {image}")
    for (source, target), line in zip(files, lines):
        expected = hashlib.sha256((ROOT / source).read_bytes()).hexdigest()
        if line.split()[0] != expected:
            raise ValueError(f"Packaged notice differs: {image}:{target}")
    return len(files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-image", default="news_stability-app")
    parser.add_argument("--web-image", default="news_stability-web")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "licenses/manifest.json").read_text(encoding="utf-8"))
    sources = list(dict.fromkeys([entry["file"] for entry in manifest]
                                + ["licenses/manifest.json", "THIRD_PARTY_NOTICES.md"]))
    app = check_image(args.app_image, [(source, "/usr/share/licenses/news-stability/" + source)
                                      for source in sources])
    web = check_image(args.web_image, [("web/third-party-notices.txt",
                                       "/usr/share/nginx/html/third-party-notices.txt")])
    print(f"Verified {app} app license files and {web} public notice bundle in built images.")


if __name__ == "__main__":
    main()
