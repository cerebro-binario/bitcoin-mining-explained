import { Injectable } from '@angular/core';
import { BitcoinAddress } from '../models/address.model';
import { AddressService } from './address.service';

@Injectable({
  providedIn: 'root',
})
export class MinerService {
  private miners: Record<BitcoinAddress, boolean> = {};
  private creationProbability = 0.3;

  constructor(private addressService: AddressService) {}

  // Gera um miner aleatório ou seleciona um existente
  getRandomMiner(): BitcoinAddress {
    const createNew = Math.random() < this.creationProbability;

    if (createNew) {
      const newMiner = this.createNewMiner();
      return newMiner;
    } else {
      const existingMiner = this.selectExistingMiner();
      return existingMiner;
    }
  }

  // Cria um novo miner (endereço aleatório)
  private createNewMiner(): BitcoinAddress {
    let newMinerAddress: BitcoinAddress;

    do {
      newMinerAddress = this.addressService.generateRandomAddress();
    } while (this.miners[newMinerAddress]); // Garante que o endereço não exista no dicionário

    this.miners[newMinerAddress] = true; // Adiciona o miner ao dicionário
    this.addressService.addBalance(newMinerAddress, 0); // Inicializa saldo do miner
    return newMinerAddress;
  }

  // Seleciona um miner existente aleatoriamente
  private selectExistingMiner(): BitcoinAddress {
    const minerAddresses = this.getAllMiners();

    if (minerAddresses.length === 0) {
      return this.createNewMiner();
    }

    const randomIndex = Math.floor(Math.random() * minerAddresses.length);
    return minerAddresses[randomIndex];
  }

  // Retorna todos os miners existentes
  getAllMiners(): BitcoinAddress[] {
    return Object.keys(this.miners).map((a) => a as BitcoinAddress);
  }
}
