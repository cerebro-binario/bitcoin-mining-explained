import { Injectable } from '@angular/core';
import { ripemd160 } from '@noble/hashes/legacy';
import { sha256 } from '@noble/hashes/sha2';
import * as secp256k1 from '@noble/secp256k1';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { bech32 } from 'bech32';
import bs58 from 'bs58';
import wordlist from '../../assets/bip39-words.json';
import { Keys } from '../models/node';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private readonly WORDLIST = wordlist.words;

  constructor() {}

  generateSeed(): string {
    return this.generateMnemonic();
  }

  private generateMnemonic(): string {
    // 1. Generate 128 bits (16 bytes) of entropy
    const entropy = this.generateEntropy(16);

    // 2. Calculate SHA256 hash of entropy
    const entropyBytes = new Uint8Array(
      entropy.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const hash = sha256(entropyBytes);

    // 3. Get first 4 bits of hash for checksum
    const firstByte = hash[0];
    const checksum = (firstByte >> 4) & 0x0f;

    // 4. Convert entropy to binary string (128 bits)
    const entropyBinary = this.hexToBinary(entropy);

    // 5. Convert checksum to 4-bit binary string
    const checksumBinary = checksum.toString(2).padStart(4, '0');

    // 6. Combine entropy and checksum (132 bits total)
    const combinedBinary = entropyBinary + checksumBinary;

    // 7. Split into 11-bit chunks
    const indices: number[] = [];
    for (let i = 0; i < 12; i++) {
      const startBit = i * 11;
      const endBit = startBit + 11;
      const chunk = combinedBinary.substring(startBit, endBit);
      const index = parseInt(chunk, 2);

      // Validate index is within bounds (0-2047)
      if (index >= 2048) {
        console.error(`Invalid index ${index} at position ${i}`);
        throw new Error(`Invalid index ${index} at position ${i}`);
      }

      indices.push(index);
    }

    // 8. Convert indices to words
    const words = indices.map((index) => this.WORDLIST[index]);
    const mnemonic = words.join(' ');
    return mnemonic;
  }

  private writeBits(
    data: Uint8Array,
    startBit: number,
    length: number,
    value: number
  ): void {
    let remainingBits = length;
    let currentBit = startBit;

    while (remainingBits > 0) {
      const currentByte = Math.floor(currentBit / 8);
      const bitInByte = currentBit % 8;
      const bitsToTake = Math.min(remainingBits, 8 - bitInByte);

      const shift = 8 - bitInByte - bitsToTake;
      const mask = (1 << bitsToTake) - 1;
      const bits = (value >> (remainingBits - bitsToTake)) & mask;

      data[currentByte] |= bits << shift;
      remainingBits -= bitsToTake;
      currentBit += bitsToTake;
    }
  }

  private hexToBinary(hex: string): string {
    return hex
      .split('')
      .map((char) => {
        const binary = parseInt(char, 16).toString(2);
        return binary.padStart(4, '0');
      })
      .join('');
  }

  private generateEntropy(bytes: number): string {
    const entropy = new Uint8Array(bytes);
    crypto.getRandomValues(entropy);
    return Array.from(entropy)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  validateSeed(seed: string): boolean {
    try {
      return validateMnemonic(seed, this.WORDLIST);
    } catch (error) {
      console.error('Erro ao validar mnemônico:', error);
      return false;
    }
  }

  deriveKeysFromSeed(
    seed: string,
    count: number = 1,
    path: string = "m/84'/0'/0'"
  ): Keys[] {
    let seedBytes: Uint8Array;

    // Se o input for um mnemônico (contém espaços), converte para seed
    if (seed.includes(' ')) {
      seedBytes = mnemonicToSeedSync(seed);
    } else {
      // Se já for um seed em hex, converte para bytes
      seedBytes = KeyService.hexToBytes(seed);
    }

    // 2. Create HD wallet from seed
    const root = HDKey.fromMasterSeed(seedBytes);

    const keys: Keys[] = [];

    // 3. Derive each child key with its full path
    for (let i = 0; i < count; i++) {
      const fullPath = `m/84'/0'/0'/0/${i}`;
      const child = root.derive(fullPath);
      if (!child.publicKey) throw new Error('Failed to derive public key');

      // Get extended keys in BIP32 format
      const xpriv = child.toJSON().xpriv;
      const xpub = child.toJSON().xpub;

      keys.push({
        priv: xpriv,
        pub: xpub,
        path: fullPath,
      });
    }

    return keys;
  }

  deriveKeysFromPrivateKey(privateKey: string): Keys {
    const cleanPrivKey = privateKey.startsWith('0x')
      ? privateKey.slice(2)
      : privateKey;
    return {
      priv: privateKey,
      pub: KeyService.derivePublicKey(cleanPrivKey),
    };
  }

  /**
   * Gera um endereço Bitcoin a partir da chave pública
   * @param publicKey Chave pública em formato hex
   * @param format Formato do endereço (p2pkh, p2sh-p2wpkh, p2wpkh)
   * @returns Endereço Bitcoin no formato especificado
   */
  generateBitcoinAddress(
    publicKey: string,
    format: 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' = 'p2pkh'
  ): string {
    // Se for uma chave pública estendida (xpub), extrai a chave pública real
    let cleanPubKey = publicKey;
    if (publicKey.startsWith('xpub') || publicKey.startsWith('zpub')) {
      const hdKey = HDKey.fromExtendedKey(publicKey);
      if (!hdKey.publicKey)
        throw new Error('Failed to get public key from extended key');
      cleanPubKey = KeyService.bytesToHex(hdKey.publicKey);
    } else {
      // Remove o prefixo '0x' se existir
      cleanPubKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
    }

    switch (format) {
      case 'p2pkh':
        return KeyService.deriveBitcoinAddress(cleanPubKey);
      case 'p2sh-p2wpkh':
        return KeyService.deriveP2SH_P2WPKH(cleanPubKey);
      case 'p2wpkh':
        return KeyService.deriveBech32(cleanPubKey);
      default:
        throw new Error('Formato de endereço inválido');
    }
  }

  // Função para gerar chaves sequencialmente a partir de 0x0000...
  generateSequentialKeys(startIndex: number = 0, count: number = 10): Keys[] {
    const keys: Keys[] = [];
    for (let i = 0; i < count; i++) {
      const privateKey = '0x' + (startIndex + i).toString(16).padStart(64, '0');
      const nodeKeys = this.deriveKeysFromPrivateKey(privateKey);
      keys.push(nodeKeys);
    }
    return keys;
  }

  static padHex(num: number | bigint, length: number = 2): string {
    return num.toString(16).padStart(length, '0');
  }

  static hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
  }

  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Gera uma chave privada válida (nunca zero, sempre 32 bytes)
   * @param index índice (começa do 0, mas nunca retorna zero)
   */
  static derivePrivateKey(index: number): string {
    const n = BigInt(index + 1); // nunca zero
    const hex = n.toString(16).padStart(64, '0');
    return hex;
  }

  /**
   * Deriva a chave pública comprimida a partir da chave privada (hex)
   */
  static derivePublicKey(priv: string): string {
    const privBytes = KeyService.hexToBytes(priv);
    const pubBytes = secp256k1.getPublicKey(privBytes, true); // compressed
    return KeyService.bytesToHex(pubBytes);
  }

  /**
   * Deriva o endereço Bitcoin P2PKH (mainnet) a partir da chave pública (hex)
   */
  static deriveBitcoinAddress(pubHex: string): string {
    const pubBytes = KeyService.hexToBytes(pubHex);
    const sha = sha256(pubBytes);
    const ripe = ripemd160(sha);
    const versioned = new Uint8Array(ripe.length + 1);
    versioned[0] = 0x00;
    versioned.set(ripe, 1);
    const checksum = sha256(sha256(versioned)).slice(0, 4);
    const addressBytes = new Uint8Array(versioned.length + 4);
    addressBytes.set(versioned, 0);
    addressBytes.set(checksum, versioned.length);
    return bs58.encode(addressBytes);
  }

  /**
   * Deriva o endereço Bitcoin P2SH-P2WPKH (compatível, começa com 3) a partir da chave pública (hex)
   */
  static deriveP2SH_P2WPKH(pubHex: string): string {
    // 1. PubKeyHash (hash160)
    const pubBytes = KeyService.hexToBytes(pubHex);
    const pubKeyHash = ripemd160(sha256(pubBytes));
    // 2. ScriptSig: 0x00 0x14 <20 bytes pubKeyHash>
    const redeemScript = new Uint8Array(2 + pubKeyHash.length);
    redeemScript[0] = 0x00;
    redeemScript[1] = 0x14;
    redeemScript.set(pubKeyHash, 2);
    // 3. Hash160 do redeemScript
    const redeemScriptHash = ripemd160(sha256(redeemScript));
    // 4. Prepend version byte 0x05 (P2SH)
    const versioned = new Uint8Array(redeemScriptHash.length + 1);
    versioned[0] = 0x05;
    versioned.set(redeemScriptHash, 1);
    // 5. Checksum
    const checksum = sha256(sha256(versioned)).slice(0, 4);
    const addressBytes = new Uint8Array(versioned.length + 4);
    addressBytes.set(versioned, 0);
    addressBytes.set(checksum, versioned.length);
    return bs58.encode(addressBytes);
  }

  /**
   * Deriva o endereço Bech32 (P2WPKH, nativo, começa com bc1) a partir da chave pública (hex)
   */
  static deriveBech32(pubHex: string): string {
    const pubBytes = KeyService.hexToBytes(pubHex);
    const pubKeyHash = ripemd160(sha256(pubBytes));
    // witness version 0, program = pubKeyHash
    const words = bech32.toWords(pubKeyHash);
    // Prepend witness version 0
    words.unshift(0x00);
    return bech32.encode('bc', words);
  }
}
