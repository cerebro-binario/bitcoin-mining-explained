import { Injectable } from '@angular/core';
// import { bech32 } from 'bech32';
// import bs58 from 'bs58';
// import * as CryptoJS from 'crypto-js';
// import { ec } from 'elliptic';
// import {
//   BITCOIN_ADDRESS_TYPES,
//   BitcoinAddress,
//   BitcoinAddressInfo,
//   BitcoinAddressType,
//   BitcoinAddressTypeCode,
//   KeyPair,
//   KeyPairByAddress,
//   BitcoinAddresses,
//   MAX_PRIVATE_KEY,
// } from '../models/address.model';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  //   private bitcoinAddressRegex = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,39}$/;
  //   private ec = new ec('secp256k1');
  //   private addressTypes: BitcoinAddressType[] = [
  //     { code: 'P2PKH', name: 'P2PKH (Legacy)' },
  //     { code: 'P2SH', name: 'P2SH (Multisig)' },
  //     { code: 'P2WPKH', name: 'P2WPKH (SegWit - Bech32)' },
  //   ];
  //   keyPairsWithBalance: KeyPairByAddress = {};
  //   constructor() {}
  //   addBalance(
  //     keyPair: KeyPair,
  //     code: BitcoinAddressTypeCode,
  //     amount: number
  //   ): void {
  //     const addressInfo = keyPair.addresses[code];
  //     if (!addressInfo)
  //       throw new Error('Could not get address info for this key pair');
  //     if (!this.keyPairsWithBalance[addressInfo.address]) {
  //       addressInfo.balance = 0;
  //       this.keyPairsWithBalance[addressInfo.address] = keyPair;
  //     }
  //     addressInfo.balance += amount;
  //   }
  //   subtractBalance(addressInfo: BitcoinAddressInfo, amount: number): boolean {
  //     if (addressInfo.balance >= amount) {
  //       addressInfo.balance -= amount;
  //       return true;
  //     }
  //     return false;
  //   }
  //   transfer(
  //     from: BitcoinAddressInfo,
  //     to: BitcoinAddressInfo,
  //     amount: number
  //   ): boolean {
  //     if (!this.subtractBalance(from, amount)) {
  //       return false; // Saldo insuficiente
  //     }
  //     const keyPair = this.keyPairsWithBalance[to.address];
  //     this.addBalance(keyPair, to.type.code, amount);
  //     return true;
  //   }
  //   getBalance(address: BitcoinAddress): number {
  //     const addresses = Object.values(
  //       this.keyPairsWithBalance[address]?.addresses || {}
  //     );
  //     const addrInfo = addresses.find((addr) => addr.address === address);
  //     return addrInfo?.balance || 0;
  //   }
  //   getAllKeyPairsWithBalance(): KeyPair[] {
  //     return Object.values(this.keyPairsWithBalance);
  //   }
  //   getKeyPairByAddress(address: BitcoinAddress) {
  //     return this.keyPairsWithBalance[address];
  //   }
  //   isValidBitcoinAddress(address: string): address is BitcoinAddress {
  //     return this.bitcoinAddressRegex.test(address);
  //   }
  //   getAddressTypeByCode(code: BitcoinAddressTypeCode): BitcoinAddressType {
  //     const type = BITCOIN_ADDRESS_TYPES[code];
  //     if (!type) {
  //       throw new Error('Invalid code');
  //     }
  //     return type;
  //   }
  //   // Gera a chave pública a partir da chave privada (ECC Secp256k1)
  //   generatePublicKey(privateKey: string): string {
  //     const keyPair = this.ec.keyFromPrivate(privateKey, 'hex'); // Cria um par de chaves
  //     return keyPair.getPublic().encode('hex', false); // Retorna a chave pública em formato hexadecimal
  //   }
  //   generateBitcoinAddress(
  //     publicKey: string,
  //     type: BitcoinAddressTypeCode = 'P2WPKH'
  //   ): BitcoinAddress {
  //     // 1. SHA-256 da chave pública
  //     const sha256Hash = CryptoJS.SHA256(
  //       CryptoJS.enc.Hex.parse(publicKey)
  //     ).toString();
  //     // 2. RIPEMD-160 do hash SHA-256 (Public Key Hash - PKH)
  //     const ripemd160Hash = CryptoJS.RIPEMD160(
  //       CryptoJS.enc.Hex.parse(sha256Hash)
  //     ).toString();
  //     if (type === 'P2PKH') {
  //       // Endereço Legacy (P2PKH)
  //       return this.generateBase58CheckAddress(
  //         '00',
  //         ripemd160Hash
  //       ) as BitcoinAddress;
  //     } else if (type === 'P2SH') {
  //       // Endereço Multisig (P2SH)
  //       return this.generateBase58CheckAddress(
  //         '05',
  //         ripemd160Hash
  //       ) as BitcoinAddress;
  //     } else {
  //       // Endereço SegWit (Bech32 - P2WPKH)
  //       return this.generateBech32Address(ripemd160Hash) as BitcoinAddress;
  //     }
  //   }
  generateRandomAddress(): string {
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
    return `${randomPrefix}${randomPart}`;
  }
  //   generateBase58CheckAddress(prefix: string, hash160: string): string {
  //     // Prefixo + Public Key Hash (PKH)
  //     const versionedHash = prefix + hash160;
  //     // SHA-256 duas vezes para gerar checksum
  //     const firstSHA = CryptoJS.SHA256(
  //       CryptoJS.enc.Hex.parse(versionedHash)
  //     ).toString();
  //     const secondSHA = CryptoJS.SHA256(
  //       CryptoJS.enc.Hex.parse(firstSHA)
  //     ).toString();
  //     const checksum = secondSHA.substring(0, 8);
  //     // Concatena versão + PKH + checksum
  //     const fullHashHex = versionedHash + checksum;
  //     // Converte para Uint8Array
  //     const fullHashBytes = new Uint8Array(
  //       fullHashHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  //     );
  //     // Codifica em Base58Check
  //     return bs58.encode(fullHashBytes);
  //   }
  //   // Gera um endereço Bech32 (SegWit)
  //   generateBech32Address(hash160: string): string {
  //     const hashBytes = new Uint8Array(
  //       hash160.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  //     );
  //     // Criar versão SegWit (P2WPKH) com witness version 0
  //     const words = bech32.toWords(hashBytes);
  //     words.unshift(0x00); // Witness version 0
  //     // Codificar no formato Bech32 com prefixo "bc1" (Bitcoin Mainnet)
  //     return bech32.encode('bc', words);
  //   }
  //   generateRandomKeyPair(): KeyPair {
  //     const ecKeyPair = this.ec.genKeyPair();
  //     const privateKey = ecKeyPair.getPrivate('hex');
  //     const publicKey = ecKeyPair.getPublic('hex');
  //     const p2pkh = this.generateBitcoinAddress(publicKey, 'P2PKH');
  //     const p2sh = this.generateBitcoinAddress(publicKey, 'P2SH');
  //     const p2wpkh = this.generateBitcoinAddress(publicKey, 'P2WPKH');
  //     const appKeyPair: KeyPair = {
  //       privateKey,
  //       publicKey,
  //       addresses: {
  //         P2PKH: {
  //           address: p2pkh,
  //           balance: 0,
  //           type: BITCOIN_ADDRESS_TYPES['P2PKH'],
  //         },
  //         P2SH: {
  //           address: p2sh,
  //           balance: 0,
  //           type: BITCOIN_ADDRESS_TYPES['P2SH'],
  //         },
  //         P2WPKH: {
  //           address: p2wpkh,
  //           balance: 0,
  //           type: BITCOIN_ADDRESS_TYPES['P2WPKH'],
  //         },
  //       },
  //     };
  //     return appKeyPair;
  //   }
  //   getKeyPairs(start: BigInt, end: BigInt): KeyPair[] {
  //     const keyPairs: KeyPair[] = [];
  //     for (let i = start; i < end; i++) {
  //       const privateKey = this.formatPrivateKey(i);
  //       const publicKey = this.generatePublicKey(privateKey);
  //       const p2pkh = this.generateBitcoinAddress(publicKey, 'P2PKH');
  //       const p2sh = this.generateBitcoinAddress(publicKey, 'P2SH');
  //       const p2wpkh = this.generateBitcoinAddress(publicKey, 'P2WPKH');
  //       const addresses: BitcoinAddresses = {
  //         P2PKH: {
  //           type: BITCOIN_ADDRESS_TYPES['P2PKH'],
  //           address: p2pkh,
  //         },
  //         P2SH: {
  //           type: BITCOIN_ADDRESS_TYPES['P2SH'],
  //           address: p2sh,
  //         },
  //         P2WPKH: {
  //           type: BITCOIN_ADDRESS_TYPES['P2WPKH'],
  //           address: p2wpkh,
  //         },
  //       };
  //       keyPairs.push({
  //         privateKey,
  //         publicKey,
  //         addresses,
  //       });
  //     }
  //     return keyPairs;
  //   }
  //   getTotalKeyPairs(): BigInt {
  //     return BigInt('0x' + MAX_PRIVATE_KEY);
  //   }
  //   private formatPrivateKey(index: BigInt): string {
  //     return index.toString(16).padStart(64, '0');
  //   }
  //   private generateBitcoinAddress(publicKey: string, type: string): string {
  //     // TODO: Implementar geração real de endereço Bitcoin
  //     return 'bc1' + publicKey.slice(2, 10);
  //   }
}
