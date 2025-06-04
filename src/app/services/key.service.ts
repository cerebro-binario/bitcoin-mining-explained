import { Injectable } from '@angular/core';
import { Keys } from '../models/node';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import { ripemd160 } from '@noble/hashes/legacy';
import bs58 from 'bs58';
import { bech32 } from 'bech32';
import wordlist from '../../assets/bip39-words.json';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private readonly WORDLIST = wordlist.words;
  private readonly BIP32_SEED = 'Bitcoin seed';

  constructor() {}

  generateSeed(): string {
    const words = [];
    for (let i = 0; i < 12; i++) {
      const idx = Math.floor(Math.random() * this.WORDLIST.length);
      words.push(this.WORDLIST[idx]);
    }
    return words.join(' ');
  }

  /**
   * Deriva um par de chaves determinístico a partir da seed usando BIP32
   * @param seed Seed para derivação
   * @param count Quantidade de chaves a serem derivadas (opcional, padrão: 1)
   * @param path Caminho de derivação (opcional, padrão: m/0'/0/0)
   * @returns Array de pares de chaves
   */
  deriveKeysFromSeed(
    seed: string,
    count: number = 1,
    path: string = "m/0'/0/0"
  ): Keys[] {
    // 1. Gerar a master key usando HMAC-SHA512
    const seedBytes = new TextEncoder().encode(seed);
    const hmacResult = hmac(sha256, this.BIP32_SEED, seedBytes);

    // 2. Dividir o resultado em chave privada (32 bytes) e chain code (32 bytes)
    const masterKey = hmacResult.slice(0, 32);
    const chainCode = hmacResult.slice(32);

    const keys: Keys[] = [];

    // 3. Derivar as chaves filhas
    for (let i = 0; i < count; i++) {
      // Para cada chave, incrementamos o último índice do path
      const currentPath = path.replace(/\d+$/, i.toString());

      // Derivar a chave filha usando o chain code e o índice
      const childKey = this.deriveChildKey(masterKey, chainCode, i);

      // Derivar a chave pública
      const pub = KeyService.derivePublicKey(KeyService.bytesToHex(childKey));

      keys.push({
        priv: KeyService.bytesToHex(childKey),
        pub: pub,
        path: currentPath,
      });
    }

    return keys;
  }

  /**
   * Deriva uma chave filha usando o algoritmo BIP32
   * @param parentKey Chave privada do pai
   * @param chainCode Chain code do pai
   * @param index Índice da chave filha
   * @returns Chave privada da chave filha
   */
  private deriveChildKey(
    parentKey: Uint8Array,
    chainCode: Uint8Array,
    index: number
  ): Uint8Array {
    // 1. Preparar os dados para HMAC
    const data = new Uint8Array(37); // 1 byte para flag + 32 bytes para chave + 4 bytes para índice

    // Se índice >= 2^31, usar chave pública
    if (index >= 0x80000000) {
      data[0] = 0x00;
      const pubKey = secp256k1.getPublicKey(parentKey, true);
      data.set(pubKey, 1);
    } else {
      data[0] = 0x00;
      data.set(parentKey, 1);
    }

    // Adicionar o índice (4 bytes, big-endian)
    data[33] = (index >> 24) & 0xff;
    data[34] = (index >> 16) & 0xff;
    data[35] = (index >> 8) & 0xff;
    data[36] = index & 0xff;

    // 2. Calcular HMAC-SHA512
    const hmacResult = hmac(sha256, chainCode, data);

    // 3. Dividir o resultado em chave privada e novo chain code
    const childKey = hmacResult.slice(0, 32);
    const newChainCode = hmacResult.slice(32);

    // 4. Ajustar a chave privada para estar no intervalo válido da curva
    const childKeyBigInt = BigInt('0x' + KeyService.bytesToHex(childKey));
    const n = BigInt(
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
    ); // ordem da curva secp256k1

    // Se a chave estiver fora do intervalo válido, ajustar
    if (childKeyBigInt >= n) {
      return this.deriveChildKey(parentKey, newChainCode, index + 1);
    }

    return childKey;
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
    // Remove o prefixo '0x' se existir
    const cleanPubKey = publicKey.startsWith('0x')
      ? publicKey.slice(2)
      : publicKey;

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
