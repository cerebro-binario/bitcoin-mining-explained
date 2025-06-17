import { sha256 } from '@noble/hashes/sha2';
import bs58 from 'bs58';
import * as CryptoJS from 'crypto-js';
import { BipType } from '../models/wallet.model';

export function textToHex(text: string): string {
  return text
    .split('')
    .map((char) => padHex(char.charCodeAt(0))) // Converte cada caractere para hexadecimal
    .join(''); // Junta todos os valores hexadecimais em uma string
}

export function hexToText(hex: string): string {
  // Divide a string hexadecimal em pares de dois caracteres (cada byte em hexadecimal tem 2 caracteres)
  const hexPairs = hex.match(/.{1,2}/g) || [];

  // Converte cada par de hexadecimal em seu caractere correspondente
  return hexPairs
    .map((byte) => String.fromCharCode(parseInt(byte, 16)))
    .join('');
}

export function hexToBinary(hex: string): string {
  // Converte cada caractere hexadecimal em seu valor binário correspondente
  return hex
    .split('') // Divide o hexadecimal em caracteres individuais
    .map((char) => padBinary(parseInt(char, 16), 4)) // Converte cada caractere para binário (4 bits)
    .join(''); // Junta todos os valores binários em uma única string
}

export function hexToDecimal(hex: string): string {
  // Remove prefixo '0x' se existir
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }

  // Converte o hexadecimal para decimal usando BigInt para suportar valores grandes
  const decimalValue = BigInt(`0x${hex}`);
  return decimalValue.toString(); // Retorna o valor decimal como string
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => padHex(b))
    .join('');
}

export function bytesToBinary(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => padBinary(b))
    .join('');
}

export function padBinary(num: number | bigint, length: number = 8): string {
  return num.toString(2).padStart(length, '0');
}

export function padHex(num: number | bigint, length: number = 2): string {
  return num.toString(16).padStart(length, '0');
}

export function hashSHA256(data: string, enc: 'text' | 'hex' = 'text'): string {
  if (enc === 'text') {
    data = textToHex(data);
  }

  return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(data)).toString(
    CryptoJS.enc.Hex
  );
}

export function dupHashSHA256(
  data: string,
  enc: 'text' | 'hex' = 'text'
): string {
  return hashSHA256(hashSHA256(data, enc), 'hex');
}

export function ripemd160OfSHA256(hash: string): string {
  return CryptoJS.RIPEMD160(hash).toString(CryptoJS.enc.Hex);
}

export function getRandomAmount(max = 10): number {
  return parseFloat((Math.random() * max).toFixed(8));
}

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function getWeightedRandomInput(): number {
  const weights = [70, 20, 10];
  const cumulativeWeights = weights.map(
    (
      (sum) => (value) =>
        (sum += value)
    )(0)
  );
  const random =
    Math.random() * cumulativeWeights[cumulativeWeights.length - 1];

  return cumulativeWeights.findIndex((weight) => random < weight) + 1;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

// Método para encurtar endereços, mostrando apenas os primeiros e últimos caracteres
export function shortenValue(value: string, size: number = 6): string {
  if (value.length < size * 2 + 1) return value;

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function zip<T>(...arrays: T[][]): T[][] {
  return arrays[0].map((_, i) => arrays.map((arr) => arr[i]));
}

export function hexToWif(hex: string): string {
  // 1. Converte o hex para bytes
  const privKey = hexToBytes(hex);

  // 2. Prepara os bytes para WIF:
  // - 0x80 (versão mainnet)
  // - chave privada (32 bytes)
  // - 0x01 (flag de compressão)
  const wifBytes = new Uint8Array(34);
  wifBytes[0] = 0x80; // versão mainnet
  wifBytes.set(privKey, 1);
  wifBytes[33] = 0x01; // flag de compressão

  // 3. Calcula o checksum (primeiros 4 bytes do SHA256(SHA256(wifBytes)))
  const hash = sha256(sha256(wifBytes));
  const checksum = hash.slice(0, 4);

  // 4. Concatena tudo
  const finalBytes = new Uint8Array(38);
  finalBytes.set(wifBytes, 0);
  finalBytes.set(checksum, 34);

  // 5. Codifica em Base58
  const wif = bs58.encode(finalBytes);
  return wif;
}

export function copyToClipboard(text: string | undefined): void {
  if (!text) return;
  navigator.clipboard.writeText(text);
}

export function getAddressType(address: string): BipType {
  if (address.startsWith('bc1')) return 'bip84';
  if (address.startsWith('3')) return 'bip49';
  return 'bip44';
}

export function ceilBigInt(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}
