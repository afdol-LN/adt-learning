import SHA256 from "crypto-js/sha256";

export function hash(text) {
    return SHA256(text).toString();
}