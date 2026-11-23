import hashlib
import hmac
import secrets


def new_token():
    return secrets.token_hex(32)


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt.encode(),
        100_000,
    ).hex()
    return password_hash, salt


def verify_password(password, salt, password_hash):
    new_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(new_hash, password_hash)
