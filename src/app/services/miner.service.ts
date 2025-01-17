import { Injectable } from '@angular/core';
import {
  GENESIS_KEY_PAIR,
  KeyPair,
  KeyPairByPrivateKey,
} from '../models/address.model';
import { AddressService } from './address.service';

@Injectable({
  providedIn: 'root',
})
export class MinerService {
  private miners: KeyPairByPrivateKey = {
    [GENESIS_KEY_PAIR.privateKey]: GENESIS_KEY_PAIR,
  };
  private creationProbability = 0.3;

  constructor(private addressService: AddressService) {}

  // Gera um miner aleatório ou seleciona um existente
  getRandomMiner(): KeyPair {
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
  private createNewMiner(): KeyPair {
    let newMiner;
    do {
      newMiner = this.addressService.generateRandomKeyPair();
    } while (this.miners[newMiner.privateKey]);

    this.miners[newMiner.privateKey] = newMiner;

    return newMiner;
  }

  // Seleciona um miner existente aleatoriamente
  private selectExistingMiner(): KeyPair {
    const minerAddresses = this.getAllMiners();

    if (minerAddresses.length === 0) {
      return this.createNewMiner();
    }

    const randomIndex = Math.floor(Math.random() * minerAddresses.length);
    return minerAddresses[randomIndex];
  }

  // Retorna todos os miners existentes
  getAllMiners(): KeyPair[] {
    return Object.values(this.miners);
  }
}
