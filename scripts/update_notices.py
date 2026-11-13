"""Copy pinned dependency license texts and publish a complete attribution bundle.

Reads the Go module cache (run go mod download all first). No network requests,
license rewriting, or deletion of old license files is performed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LICENSES = ROOT / "licenses"
LICENSE_NAMES = {"license", "license.md", "license.txt", "copying", "notice", "notice.txt", "patents"}


def module_inventory():
    raw = subprocess.check_output(["go", "list", "-m", "-json", "all"], cwd=ROOT, text=True)
    decoder = json.JSONDecoder()
    modules = []
    while raw.strip():
        value, end = decoder.raw_decode(raw.lstrip())
        raw = raw.lstrip()[end:]
        if not value.get("Main"):
            if value.get("Replace"):
                raise ValueError("Review replacement-module licenses explicitly before generating notices")
            if not value.get("Dir"):
                raise ValueError("Run go mod download all before generating notices")
            modules.append(value)
    return sorted(modules, key=lambda item: item["Path"])


def generate():
    outputs = {}
    manifest = []
    notice = (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    modules = module_inventory()
    for item in modules:
        if f"| {item['Path']} | {item['Version']} |" not in notice:
            raise ValueError(f"Review the license and update THIRD_PARTY_NOTICES.md for {item['Path']} {item['Version']}")
    for name, version, source in [
        (item["Path"], item["Version"], Path(item["Dir"])) for item in modules
    ] + [("Go standard library", "build toolchain", Path(subprocess.check_output(["go", "env", "GOROOT"], text=True).strip()))]:
        files = sorted((path for path in source.iterdir() if path.is_file() and path.name.lower() in LICENSE_NAMES), key=lambda path: path.name)
        if not any(path.name.lower().startswith(("license", "copying")) for path in files):
            raise ValueError(f"No license found for {name}; inspect its distribution before proceeding")
        for path in files:
            slug = re.sub(r"[^A-Za-z0-9._-]+", "_", f"{name}@{version}")
            target = LICENSES / f"{slug}--{path.name}"
            data = path.read_bytes()
            outputs[target] = data
            manifest.append({"component": name, "version": version, "source_file": path.name,
                             "file": target.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(data).hexdigest()})
    for name, component, revision in [
        ("Miniflux-Apache-2.0.txt", "miniflux/v2", "fb043227ef6ad98569c848e8cdade0d237dab87e"),
        ("Fusion-MIT.txt", "0x2E/fusion", "c31ade09b481fa877633899e8cf5d4c86a72c4f9"),
        ("Shiori-MIT.txt", "go-shiori/shiori", "aebb4021a56048eed4c8feb325399be5f46e5470"),
        ("Memos-MIT.txt", "usememos/memos", "30f8bad87d586228381c54beea686162cd8c5265"),
    ]:
        path = LICENSES / name
        data = path.read_bytes()
        outputs[path] = data
        manifest.append({"component": component, "revision": revision, "source_file": "LICENSE",
                         "file": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(data).hexdigest()})
    outputs[LICENSES / "manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    bundle = [notice]
    for entry in manifest:
        bundle.append(f"\n{'=' * 72}\n{entry['component']} — {entry['file']}\n{'=' * 72}\n")
        bundle.append(outputs[ROOT / entry["file"]].decode("utf-8"))
    outputs[ROOT / "web/third-party-notices.txt"] = "\n".join(bundle).encode("utf-8")
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = generate()
    stale = []
    for path, data in outputs.items():
        if path.exists() and path.read_bytes() == data:
            continue
        if args.check:
            stale.append(path.relative_to(ROOT).as_posix())
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    if stale:
        print("Notice files need regeneration: " + ", ".join(stale), file=sys.stderr)
        return 1
    print("Notice files are current." if args.check else "Updated dependency licenses and public notices.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
