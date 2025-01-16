import * as CryptoJS from 'crypto-js';

export function hashSHA256(data: string): string {
  return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(data)).toString(
    CryptoJS.enc.Hex
  );
}

export function dupHashSHA256(data: string): string {
  return hashSHA256(hashSHA256(data));
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
