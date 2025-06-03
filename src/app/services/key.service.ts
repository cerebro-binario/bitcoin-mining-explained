import { Injectable } from '@angular/core';
import { Keys } from '../models/node';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import bs58 from 'bs58';
import { bech32 } from 'bech32';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private readonly WORDLIST = [
    'abandon',
    'ability',
    'able',
    'about',
    'above',
    'absent',
    'absorb',
    'abstract',
    'absurd',
    'abuse',
    // ... (lista completa de palavras BIP39)
  ];

  constructor() {}

  generateSeed(): string {
    const words = [];
    for (let i = 0; i < 12; i++) {
      const idx = Math.floor(Math.random() * this.WORDLIST.length);
      words.push(this.WORDLIST[idx]);
    }
    return words.join(' ');
  }

  deriveKeysFromSeed(seed: string): Keys {
    // TODO: Implementar derivação real de chaves usando BIP32/BIP39
    // Por enquanto, retornamos chaves simuladas
    return {
      priv: '0x' + Math.random().toString(16).slice(2, 66),
      pub: '0x' + Math.random().toString(16).slice(2, 66),
    };
  }

  deriveKeysFromPrivateKey(privateKey: string): Keys {
    // TODO: Implementar derivação real da chave pública a partir da privada
    // Por enquanto, retornamos chave pública simulada
    return {
      priv: privateKey,
      pub: '0x' + Math.random().toString(16).slice(2, 66),
    };
  }

  generateBitcoinAddress(publicKey: string): string {
    // TODO: Implementar geração real de endereço Bitcoin
    // Por enquanto, retornamos endereço simulado
    return 'bc1q' + Math.random().toString(16).slice(2, 42);
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
