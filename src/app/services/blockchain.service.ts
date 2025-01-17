import { Injectable } from '@angular/core';
import { Block, GENESIS_BLOCK } from '../models/block.model';
import { Transaction } from '../models/transaction.model';
import { hashSHA256 } from '../utils/tools';
import { MempoolService } from './mempool.service';

@Injectable({
  providedIn: 'root',
})
export class BlockchainService {
  private blockchain: Block[] = []; // Lista de blocos minerados
  private target =
    '0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // Target inicial

  constructor(private mempoolService: MempoolService) {
    let prevHash = this.getLatestBlockHash();
    let height = this.getBlockchainHeight();

    if (height === 0) {
      this.initializeGenesisBlock();
      prevHash = this.getLatestBlockHash();
      height = this.getBlockchainHeight();
    }

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
    return (
      latestBlock?.hash ||
      '0000000000000000000000000000000000000000000000000000000000000000'
    );
  }

  /**
   * Inicializa o bloco gênesis
   */
  initializeGenesisBlock(): void {
    const genesisBlock = GENESIS_BLOCK;

    // Calcula o txid para cada transação
    genesisBlock.transactions.forEach(
      (tx) => (tx.txid = this.mempoolService.generateTxId(tx))
    );

    // Calcula o Merkle Root e ajusta o nonce para encontrar um hash válido
    genesisBlock.merkleRoot = this.calculateMerkleRoot(
      genesisBlock.transactions
    );
    this.mineBlock(genesisBlock);

    this.blockchain.push(genesisBlock);
  }

  /**
   * Calcula o Merkle Root do bloco
   */
  calculateMerkleRoot(transactions: Transaction[]): string {
    if (transactions.length === 0) return '0'.repeat(64);

    // Extrai os hashes (txid) das transações
    let hashes = transactions.map((tx) => tx.txid);

    // Combina hashes até chegar à raiz
    while (hashes.length > 1) {
      if (hashes.length % 2 !== 0) {
        hashes.push(hashes[hashes.length - 1]); // Duplicar o último hash se ímpar
      }

      const newHashes: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const concatenated = hashes[i] + hashes[i + 1];
        const newHash = hashSHA256(concatenated);
        newHashes.push(newHash);
      }
      hashes = newHashes;
    }

    return hashes[0]; // Retorna o Merkle Root
  }

  /**
   * Ajusta o nonce até encontrar um hash válido
   */
  mineBlock(block: Block): void {
    let nonce = block.nonce || 0;
    let hash = '';

    do {
      block.nonce = nonce;
      const blockData = `${block.previousHash}${block.merkleRoot}${block.timestamp}${block.nonce}`;
      hash = hashSHA256(blockData);
      block.hash = hash;
      nonce++;
    } while (hash >= this.target);
  }
}
