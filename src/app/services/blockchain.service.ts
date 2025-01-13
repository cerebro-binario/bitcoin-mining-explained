import { Injectable } from '@angular/core';
import { Block } from '../models/block.model';
import { MempoolService } from './mempool.service';

@Injectable({
  providedIn: 'root',
})
export class BlockchainService {
  private blockchain: Block[] = []; // Lista de blocos minerados

  constructor(private mempoolService: MempoolService) {
    const prevHash = this.getLatestBlockHash();
    const height = this.getBlockchainHeight();

    this.mempoolService.createCandidateBlock(prevHash, height);
  }

  // Retorna a lista de blocos minerados
  getBlockchain(): Block[] {
    return this.blockchain;
  }

  // Retorna a lista de blocos minerados
  getBlockchainHeight(): number {
    return this.getBlockchain().length;
  }

  // Retorna o hash do último bloco
  getLatestBlockHash(): string {
    const latestBlock = this.blockchain[this.blockchain.length - 1];
    return latestBlock?.hash || '0'.repeat(64);
  }
}
