import * as CryptoJS from 'crypto-js';

export function textToHex(text: string): string {
  return text
    .split('')
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0')) // Converte cada caractere para hexadecimal
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
    .map((char) => parseInt(char, 16).toString(2).padStart(4, '0')) // Converte cada caractere para binário (4 bits)
    .join(''); // Junta todos os valores binários em uma única string
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
