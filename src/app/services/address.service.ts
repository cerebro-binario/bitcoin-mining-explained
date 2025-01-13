import { Injectable } from '@angular/core';
import { BitcoinAddress } from '../models/address.model';
import { Balances } from '../models/balance.model';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private bitcoinAddressRegex = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,39}$/;

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

  isValidBitcoinAddress(address: string): address is BitcoinAddress {
    return this.bitcoinAddressRegex.test(address);
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
}
