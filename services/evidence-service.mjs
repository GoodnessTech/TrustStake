import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Hash, Hex } from 'ox';

const EVIDENCE_DIR = path.resolve('evidence/samples');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

export class EvidenceService {
  /**
   * Save an offchain evidence payload and compute both keccak256 (EVM standard)
   * and sha256 hashes for cryptographic proof.
   */
  static storeEvidence({ commitmentId, submitter, title, description, metrics, data }) {
    const payload = {
      commitmentId: commitmentId.toString(),
      submitter,
      title,
      description,
      metrics: metrics || {},
      data: data || {},
      timestamp: new Date().toISOString()
    };

    const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());
    const keccakHash = Hash.keccak256(Hex.fromString(canonicalJson));
    const sha256Hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

    const fileName = `${keccakHash.slice(2, 18)}.json`;
    const filePath = path.join(EVIDENCE_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify({
      ...payload,
      hashes: {
        keccak256: keccakHash,
        sha256: `0x${sha256Hash}`
      }
    }, null, 2));

    return {
      keccakHash,
      sha256Hash: `0x${sha256Hash}`,
      evidenceURI: `ipfs://bafybei${keccakHash.slice(2, 26)}`,
      filePath
    };
  }

  static getEvidenceByHash(hash) {
    const files = fs.readdirSync(EVIDENCE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, file), 'utf8'));
        if (content.hashes && (content.hashes.keccak256 === hash || content.hashes.sha256 === hash)) {
          return content;
        }
      }
    }
    return null;
  }

  static verifyEvidenceIntegrity(onchainHash, payloadObject) {
    const { hashes, ...purePayload } = payloadObject;
    const canonicalJson = JSON.stringify(purePayload, Object.keys(purePayload).sort());
    const computedKeccak = Hash.keccak256(Hex.fromString(canonicalJson));
    return {
      isValid: computedKeccak.toLowerCase() === onchainHash.toLowerCase(),
      computedHash: computedKeccak,
      expectedHash: onchainHash
    };
  }
}
