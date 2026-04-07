"""DGAT binary installer - downloads pre-built binary from GitHub releases"""

import os
import sys
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Optional

GITHUB_REPO = "HyperKuvid-Labs/DGAT"
BASE_URL = f"https://github.com/{GITHUB_REPO}/releases/download/latest"


def get_system_info() -> tuple[str, str]:
    """Get OS and architecture for binary naming"""
    system = platform.system().lower()
    arch = platform.machine().lower()

    # Normalize architecture
    if arch in ("x86_64", "amd64"):
        arch = "x86_64"
    elif arch in ("aarch64", "arm64"):
        arch = "arm64"
    elif arch == "armv7l":
        arch = "armv7"

    # Normalize OS
    if system == "darwin":
        system = "macos"
    elif system == "windows":
        system = "windows"

    return system, arch


def get_binary_name() -> str:
    """Get the binary name for current platform"""
    system, arch = get_system_info()

    if system == "windows":
        return f"dgat-windows-{arch}.exe"
    else:
        return f"dgat-{system}-{arch}"


def get_install_dir() -> Path:
    """Get the directory where binary should be installed"""
    # Check if running in development mode
    package_dir = Path(__file__).parent
    if (package_dir.parent / "pyproject.toml").exists():
        dev_bin = package_dir / "bin"
        if dev_bin.exists() and (dev_bin / "dgat").exists():
            return dev_bin

    # User local bin
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "Programs" / "dgat"
    else:
        return Path.home() / ".local" / "bin"


def get_cached_binary_path() -> Optional[Path]:
    """Check if binary is already cached"""
    install_dir = get_install_dir()
    binary_path = install_dir / "dgat"

    if sys.platform == "win32":
        binary_path = install_dir / "dgat.exe"

    if binary_path.exists():
        return binary_path

    return None


def ensure_binary() -> Path:
    """Ensure the binary is available, downloading if needed"""
    # Check for cached binary
    cached = get_cached_binary_path()
    if cached:
        return cached

    # Check if we can build from source
    if can_build_from_source():
        return build_from_source()

    # Download from GitHub
    return download_binary()


def can_build_from_source() -> bool:
    """Check if we can build the binary from source"""
    # Check for CMake
    try:
        result = subprocess.run(
            ["cmake", "--version"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode != 0:
            return False
    except FileNotFoundError:
        return False

    # Check for C++ compiler
    try:
        result = subprocess.run(
            ["g++", "--version"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode != 0:
            return False
    except FileNotFoundError:
        # Try clang
        try:
            result = subprocess.run(
                ["clang++", "--version"],
                capture_output=True,
                timeout=5,
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False

    return True


def build_from_source() -> Path:
    """Build the binary from source"""
    print("Building DGAT from source...", file=sys.stderr)

    source_dir = Path(__file__).parent.parent.parent

    # Check if we have source
    if not (source_dir / "dgat.cpp").exists():
        raise FileNotFoundError(
            "Cannot build DGAT: source files not found. "
            "Please install from PyPI or provide binary manually."
        )

    build_dir = source_dir / "build"
    build_dir.mkdir(exist_ok=True)

    # Build
    subprocess.run(
        ["cmake", "-S", str(source_dir), "-B", str(build_dir)],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["cmake", "--build", str(build_dir), "--parallel"],
        check=True,
        capture_output=True,
    )

    binary_path = build_dir / "dgat"
    if not binary_path.exists():
        raise FileNotFoundError("Build failed: binary not found")

    return binary_path


def download_binary() -> Path:
    """Download the binary from GitHub releases"""
    import requests

    binary_name = get_binary_name()
    download_url = f"{BASE_URL}/{binary_name}"

    install_dir = get_install_dir()
    install_dir.mkdir(parents=True, exist_ok=True)

    binary_path = install_dir / "dgat"
    if sys.platform == "win32":
        binary_path = install_dir / "dgat.exe"

    print(
        f"Downloading DGAT binary from {download_url}...",
        file=sys.stderr,
    )

    try:
        response = requests.get(download_url, timeout=60, stream=True)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", 0))

        with open(binary_path, "wb") as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"\rDownloading: {percent:.1f}%", file=sys.stderr, end="")

        print(file=sys.stderr)

        # Make executable (not needed on Windows)
        if sys.platform != "win32":
            os.chmod(binary_path, 0o755)

        print(
            f"Installed DGAT to {binary_path}",
            file=sys.stderr,
        )

        return binary_path

    except requests.exceptions.HTTPError as e:
        raise FileNotFoundError(
            f"Failed to download DGAT binary: {e}\n"
            f"URL: {download_url}\n"
            f"Please ensure a release exists at {GITHUB_REPO}"
        )


def get_binary_path() -> Path:
    """Public function to get the binary path"""
    cached = get_cached_binary_path()
    if cached:
        return cached

    return ensure_binary()


if __name__ == "__main__":
    # Test: print the binary path
    path = get_binary_path()
    print(path)
