import { Injectable } from '@angular/core';
import { ripemd160 } from '@noble/hashes/legacy';
import { sha256 } from '@noble/hashes/sha2';
import * as secp256k1 from '@noble/secp256k1';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { bech32 } from 'bech32';
import bs58 from 'bs58';
import wordlist from '../../assets/bip39-words.json';
import {
  BipType,
  BitcoinAddress,
  Keys,
  MAX_PRIVATE_KEY_VALUE,
  Wallet,
} from '../models/wallet.model';
import {
  bytesToBinary,
  bytesToHex,
  getRandomBytes,
  hexToBytes,
  hexToDecimal,
  hexToWif,
  padBinary,
  padHex,
  zip,
} from '../utils/tools';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private readonly WORDLIST = wordlist.words;

  constructor() {}

  generateSeed(): string[] {
    // 1. Generate 128 bits (16 bytes) of entropy
    const entropy = getRandomBytes(16);

    // 2. Calculate SHA256 hash of entropy
    const hash = sha256(entropy);

    // 3. Get first 4 bits of hash for checksum
    const firstByte = hash[0];
    const checksum = (firstByte >> 4) & 0x0f;

    // 4. Convert entropy to binary string (128 bits)
    const entropyBinary = bytesToBinary(entropy);

    // 5. Convert checksum to 4-bit binary string
    const checksumBinary = padBinary(checksum, 4);

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
    return words;
  }

  deriveBitcoinAddresses(
    mnemonic: string,
    count: number = 10,
    startIndex: number = 0
  ): BitcoinAddress[] {
    const bip44Keys = this.deriveKeysFromSeed(
      mnemonic,
      count,
      'bip44',
      startIndex
    );
    const bip49Keys = this.deriveKeysFromSeed(
      mnemonic,
      count,
      'bip49',
      startIndex
    );
    const bip84Keys = this.deriveKeysFromSeed(
      mnemonic,
      count,
      'bip84',
      startIndex
    );

    const keys = zip(bip44Keys, bip49Keys, bip84Keys);

    return keys.map(([bip44Keys, bip49Keys, bip84Keys]) => {
      const bip44Address = this.deriveBitcoinAddress(
        bip44Keys.pub.hex,
        'bip44'
      );
      const bip49Address = this.deriveBitcoinAddress(
        bip49Keys.pub.hex,
        'bip49'
      );
      const bip84Address = this.deriveBitcoinAddress(
        bip84Keys.pub.hex,
        'bip84'
      );

      return {
        bip44: {
          keys: bip44Keys,
          address: bip44Address,
          balance: 0,
          utxos: [],
          addressType: 'bip44',
        },
        bip49: {
          keys: bip49Keys,
          address: bip49Address,
          balance: 0,
          utxos: [],
          addressType: 'bip49',
        },
        bip84: {
          keys: bip84Keys,
          address: bip84Address,
          balance: 0,
          utxos: [],
          addressType: 'bip84',
        },
      };
    });
  }

  deriveNextBitcoinAddress(wallet: Wallet): BitcoinAddress | undefined {
    if (!wallet.seed?.length) return;

    const mnemonic = wallet.seed.join(' ');
    const passphrase = wallet.seedPassphrase || '';
    const currentCount = wallet?.addresses?.length || 0;

    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    const seedHex = bytesToHex(seed);
    const newAddresses = this.deriveBitcoinAddresses(seedHex, 1, currentCount);

    return newAddresses[0];
  }

  deriveBitcoinAddressesFromSequentialPrivateKey(
    count: number = 1,
    startIndex: bigint = 0n
  ): BitcoinAddress[] {
    const keys = this.generateSequentialKeys(startIndex, count);

    return keys.map((key) => {
      const bip44Address = this.deriveBitcoinAddress(key.pub.hex, 'bip44');
      const bip49Address = this.deriveBitcoinAddress(key.pub.hex, 'bip49');
      const bip84Address = this.deriveBitcoinAddress(key.pub.hex, 'bip84');

      return {
        bip44: {
          keys: key,
          address: bip44Address,
          balance: 0,
          utxos: [],
          addressType: 'bip44',
        },
        bip49: {
          keys: key,
          address: bip49Address,
          balance: 0,
          utxos: [],
          addressType: 'bip49',
        },
        bip84: {
          keys: key,
          address: bip84Address,
          balance: 0,
          utxos: [],
          addressType: 'bip84',
        },
      };
    });
  }

  private deriveKeysFromSeed(
    mnemonicOrSeedHex: string,
    count: number = 1,
    bipType: BipType = 'bip84',
    startIndex: number = 0
  ): Keys[] {
    let seedBytes: Uint8Array;

    // Se o input for um mnemônico (contém espaços), converte para seed
    if (mnemonicOrSeedHex.includes(' ')) {
      seedBytes = mnemonicToSeedSync(mnemonicOrSeedHex);
    } else {
      // Se já for um seed em hex, converte para bytes
      seedBytes = hexToBytes(mnemonicOrSeedHex);
    }

    // 2. Create HD wallet from seed
    const root = HDKey.fromMasterSeed(seedBytes);

    const keys: Keys[] = [];

    // 3. Derive each child key with its full path based on BIP type
    for (let i = 0; i < count; i++) {
      let fullPath: string;
      switch (bipType) {
        case 'bip44':
          fullPath = `m/44'/0'/0'/0/${startIndex + i}`; // Legacy (P2PKH)
          break;
        case 'bip49':
          fullPath = `m/49'/0'/0'/0/${startIndex + i}`; // SegWit Compatible (P2SH-P2WPKH)
          break;
        case 'bip84':
          fullPath = `m/84'/0'/0'/0/${startIndex + i}`; // Native SegWit (P2WPKH)
          break;
        default:
          throw new Error('Invalid BIP type');
      }

      const child = root.derive(fullPath);
      if (!child.publicKey) throw new Error('Failed to derive public key');

      // Get extended keys in BIP32 format
      const { xpriv, xpub } = child.toJSON();
      const cleanKeys = HDKey.fromExtendedKey(xpriv);

      const privKey = cleanKeys.privateKey;
      if (!privKey) throw new Error('Failed to get private key');

      const pubKey = cleanKeys.publicKey;
      if (!pubKey) throw new Error('Failed to get public key');

      const priv = bytesToHex(privKey);
      const pub = bytesToHex(pubKey);

      keys.push({
        xpriv,
        xpub,
        priv: {
          hex: priv,
          decimal: hexToDecimal(priv),
          wif: hexToWif(priv),
        },
        pub: {
          hex: pub,
          decimal: hexToDecimal(pub),
        },
        path: fullPath,
      });
    }

    return keys;
  }

  private deriveKeysFromPrivateKey(privateKey: string): Keys {
    const cleanPrivKey = privateKey.startsWith('0x')
      ? privateKey.slice(2)
      : privateKey;
    const pubKey = KeyService.derivePublicKey(cleanPrivKey);
    return {
      priv: {
        hex: cleanPrivKey,
        decimal: hexToDecimal(cleanPrivKey),
        wif: hexToWif(cleanPrivKey),
      },
      pub: {
        hex: pubKey,
        decimal: hexToDecimal(pubKey),
      },
    };
  }

  /**
   * Gera um endereço Bitcoin a partir da chave pública
   * @param publicKey Chave pública em formato hex
   * @param format Formato do endereço (bip44, bip49, bip84)
   * @returns Endereço Bitcoin no formato especificado
   */
  private deriveBitcoinAddress(
    publicKey: string,
    format: 'bip44' | 'bip49' | 'bip84' = 'bip84'
  ): string {
    // Se for uma chave pública estendida (xpub), extrai a chave pública real
    let cleanPubKey = publicKey;
    if (publicKey.startsWith('xpub') || publicKey.startsWith('zpub')) {
      const hdKey = HDKey.fromExtendedKey(publicKey);
      if (!hdKey.publicKey)
        throw new Error('Failed to get public key from extended key');
      cleanPubKey = bytesToHex(hdKey.publicKey);
    } else {
      // Remove o prefixo '0x' se existir
      cleanPubKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
    }

    switch (format) {
      case 'bip44':
        return KeyService.deriveBip44Address(cleanPubKey);
      case 'bip49':
        return KeyService.deriveBip49Address(cleanPubKey);
      case 'bip84':
        return KeyService.deriveBip84Address(cleanPubKey);
      default:
        throw new Error('Formato de endereço inválido');
    }
  }

  // Função para gerar chaves sequencialmente a partir de 0x0000...
  private generateSequentialKeys(
    startIndex: bigint = 0n,
    count: number = 10
  ): Keys[] {
    const keys: Keys[] = [];
    for (let i = 0; i < count; i++) {
      const index = startIndex + BigInt(i);
      if (index > MAX_PRIVATE_KEY_VALUE) break;
      const privateKey = padHex(index, 64);
      const nodeKeys = this.deriveKeysFromPrivateKey(privateKey);
      keys.push(nodeKeys);
    }
    return keys;
  }

  /**
   * Gera uma chave privada válida (nunca zero, sempre 32 bytes)
   * @param index índice (começa do 0, mas nunca retorna zero)
   */
  static derivePrivateKey(index: number): string {
    const n = BigInt(index + 1); // nunca zero
    const hex = padHex(n, 64);
    return hex;
  }

  /**
   * Deriva a chave pública comprimida a partir da chave privada (hex)
   */
  static derivePublicKey(priv: string): string {
    const privBytes = hexToBytes(priv);
    const pubBytes = secp256k1.getPublicKey(privBytes, true); // compressed
    return bytesToHex(pubBytes);
  }

  /**
   * Deriva o endereço Bitcoin P2PKH (mainnet) a partir da chave pública (hex)
   */
  private static deriveBip44Address(pubHex: string): string {
    const pubBytes = hexToBytes(pubHex);
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
  private static deriveBip49Address(pubHex: string): string {
    // 1. PubKeyHash (hash160)
    const pubBytes = hexToBytes(pubHex);
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
  private static deriveBip84Address(pubHex: string): string {
    const pubBytes = hexToBytes(pubHex);
    const pubKeyHash = ripemd160(sha256(pubBytes));
    // witness version 0, program = pubKeyHash
    const words = bech32.toWords(pubKeyHash);
    // Prepend witness version 0
    words.unshift(0x00);
    return bech32.encode('bc', words);
  }

  // Validação de endereço Bitcoin
  private validateBase58Address(address: string): boolean {
    try {
      const decoded = bs58.decode(address);
      if (decoded.length < 4) return false;
      const data = decoded.slice(0, -4);
      const checksum = decoded.slice(-4);
      // Hash duplo SHA-256
      const hash1 = sha256(data);
      const hash2 = sha256(hash1);
      const calculatedChecksum = hash2.slice(0, 4);
      // Comparar checksum
      return checksum.every((b, i) => b === calculatedChecksum[i]);
    } catch (e) {
      return false;
    }
  }

  private validateBech32Address(address: string): boolean {
    try {
      const decoded = bech32.decode(address);
      // Opcional: checar prefixo (hrp)
      if (decoded.prefix !== 'bc') return false;
      // Opcional: checar comprimento do dado
      return true;
    } catch (e) {
      return false;
    }
  }

  public validateBitcoinAddress(address: string): boolean {
    if (!address) return false;
    const addr = address.trim();
    if (addr.startsWith('1') || addr.startsWith('3')) {
      return this.validateBase58Address(addr);
    }
    if (addr.startsWith('bc1')) {
      return this.validateBech32Address(addr);
    }
    return false;
  }
}
