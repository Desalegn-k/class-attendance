const crypto = require("crypto");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

/**
 * Short human-typeable code for manual entry, e.g. "7K4P2Q"
 */
function generateShortCode(length = 6) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Long, non-guessable token embedded in the QR code payload.
 */
function generateQrToken() {
  return crypto.randomBytes(24).toString("base64url");
}
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Random temporary password for admin-created accounts, e.g. "k7Qm2Rpz4N"
 */
function generateTempPassword(length = 10) {
  let pass = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pass += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return pass;
}


module.exports = { generateShortCode, generateQrToken, generateTempPassword };