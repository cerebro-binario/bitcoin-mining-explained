import { Injectable } from '@angular/core';
import bs58 from 'bs58';
import * as CryptoJS from 'crypto-js';
import { ec } from 'elliptic';
import { BitcoinAddress } from '../models/address.model';
import { Balances } from '../models/balance.model';

export type AddressType = 'P2PKH' | 'P2SH' | 'P2WPKH';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private bitcoinAddressRegex = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,39}$/;
  private ec = new ec('secp256k1');

  balances: Balances = {};

  constructor() {}

  addBalance(address: BitcoinAddress, amount: number): void {
    if (!this.balances[address]) {
      this.balances[address] = 0;
    }
    this.balances[address] += amount;
  }

  subtractBalance(address: BitcoinAddress, amount: number): boolean {
    if (this.balances[address] && this.balances[address] >= amount) {
      this.balances[address] -= amount;
      return true;
    }
    return false;
  }

  transfer(from: BitcoinAddress, to: BitcoinAddress, amount: number): boolean {
    if (this.subtractBalance(from, amount)) {
      this.addBalance(to, amount);
      return true;
    }
    return false; // Saldo insuficiente
  }

  getBalance(address: BitcoinAddress): number {
    return this.balances[address] || 0;
  }

  getAllBalances(): Balances {
    return this.balances;
  }

  isValidBitcoinAddress(address: string): address is BitcoinAddress {
    return this.bitcoinAddressRegex.test(address);
  }

  // Gera a chave pública a partir da chave privada (ECC Secp256k1)
  generatePublicKey(privateKey: string): string {
    const keyPair = this.ec.keyFromPrivate('0x' + privateKey, 'hex'); // Cria um par de chaves
    return keyPair.getPublic().encode('hex', false); // Retorna a chave pública em formato hexadecimal
  }

  generateBitcoinAddress(
    publicKey: string,
    type: AddressType = 'P2WPKH'
  ): BitcoinAddress {
    // 1. SHA-256 da chave pública
    const sha256Hash = CryptoJS.SHA256(
      CryptoJS.enc.Hex.parse(publicKey)
    ).toString();

    // 2. RIPEMD-160 do hash SHA-256 (Public Key Hash - PKH)
    const ripemd160Hash = CryptoJS.RIPEMD160(
      CryptoJS.enc.Hex.parse(sha256Hash)
    ).toString();

    if (type === 'P2PKH') {
      // Endereço Legacy (P2PKH)
      return this.generateBase58CheckAddress(
        '00',
        ripemd160Hash
      ) as BitcoinAddress;
    } else if (type === 'P2SH') {
      // Endereço Multisig (P2SH)
      return this.generateBase58CheckAddress(
        '05',
        ripemd160Hash
      ) as BitcoinAddress;
    } else {
      // Endereço SegWit (Bech32 - P2WPKH)
      return this.generateBech32Address(ripemd160Hash) as BitcoinAddress;
    }
  }

  generateRandomAddress(): BitcoinAddress {
    // Prefixos possíveis para endereços Bitcoin
    const prefixes = ['1', '3', 'bc1'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];

    // Gerar o restante do endereço (25 a 39 caracteres)
    const addressLength = randomPrefix === 'bc1' ? 39 : 34; // `bc1` é mais longo que os outros
    const characters =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let randomPart = '';
    for (let i = 0; i < addressLength - randomPrefix.length; i++) {
      randomPart += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    return `${randomPrefix}${randomPart}` as BitcoinAddress;
  }

  generateBase58CheckAddress(prefix: string, hash160: string): string {
    // Prefixo + Public Key Hash (PKH)
    const versionedHash = prefix + hash160;

    // SHA-256 duas vezes para gerar checksum
    const firstSHA = CryptoJS.SHA256(
      CryptoJS.enc.Hex.parse(versionedHash)
    ).toString();
    const secondSHA = CryptoJS.SHA256(
      CryptoJS.enc.Hex.parse(firstSHA)
    ).toString();
    const checksum = secondSHA.substring(0, 8);

    // Concatena versão + PKH + checksum
    const fullHashHex = versionedHash + checksum;

    // Converte para Uint8Array
    const fullHashBytes = new Uint8Array(
      fullHashHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // Codifica em Base58Check
    return bs58.encode(fullHashBytes);
  }

  // Gera um endereço Bech32 (SegWit)
  generateBech32Address(hash160: string): string {
    // Bech32 usa "bc1" como prefixo e codifica em formato específico (sem checksum duplo)
    return `bc1${hash160.substring(0, 39)}`; // Simulação do formato Bech32
  }
}
