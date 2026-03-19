import hashlib
import xxhash

def fast_fingerprint(path):
    x = xxhash.xxh3_128()
    with open(path, "rb") as f:
        while chunk := f.read(1<<20):  # 1 MB chunks
            x.update(chunk)
    return x.digest()

if __name__ == "__main__":
    digest = fast_fingerprint("install.sh")
    digest_one = fast_fingerprint("install1.sh")
    print(digest)
    print(digest_one)
    print(f"Digests match: {digest == digest_one}")
