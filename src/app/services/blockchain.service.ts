import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Block, Transaction } from '../models/block.model';
import { BitcoinNode } from '../models/bitcoin-node.model';
import { MempoolService } from './mempool.service';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root',
})
export class BlockchainService {
  private blocksSubject = new BehaviorSubject<Block[]>([]);
  private pendingTransactionsSubject = new BehaviorSubject<Transaction[]>([]);
  private utxoSetSubject = new BehaviorSubject<Map<string, any>>(new Map());
  private readonly INITIAL_NBITS = 0x1e9fffff;
  private readonly MAX_TRANSACTIONS_PER_BLOCK = 10;

  blocks$ = this.blocksSubject.asObservable();
  pendingTransactions$ = this.pendingTransactionsSubject.asObservable();
  utxoSet$ = this.utxoSetSubject.asObservable();

  constructor(private mempool: MempoolService) {}

  createNewBlock(miner: BitcoinNode, lastBlock?: Block): Block {
    const transactions = this.getTransactionsForBlock();
    const timestamp = Date.now();
    const previousHash =
      lastBlock?.hash ||
      '0000000000000000000000000000000000000000000000000000000000000000';
    const nBits = this.calculateNBits(lastBlock);

    return new Block({
      id: (lastBlock?.id || 0) + 1,
      timestamp,
      previousHash,
      transactions,
      nBits,
      nonce: 0,
      hash: '',
    });
  }

  private getTransactionsForBlock(): Transaction[] {
    const transactions: Transaction[] = [];
    const mempoolTransactions = this.mempool.getTransactions();

    // Adiciona transações até atingir o limite ou esgotar a mempool
    for (
      let i = 0;
      i < Math.min(this.MAX_TRANSACTIONS_PER_BLOCK, mempoolTransactions.length);
      i++
    ) {
      transactions.push(mempoolTransactions[i]);
    }

    return transactions;
  }

  private calculateNBits(lastBlock?: Block): number {
    if (!lastBlock) return this.INITIAL_NBITS;

    // TODO: Implementar ajuste de nBits baseado no tempo de mineração do último bloco
    return this.INITIAL_NBITS;
  }

  isValidBlock(block: Block): boolean {
    if (!block.hash) return false;

    // Convert hash to BigInt for comparison
    const hashValue = BigInt('0x' + block.hash);

    // Block is valid if hash is below target
    return hashValue < block.target;
  }

  calculateBlockHash(block: Block): string {
    const { id, timestamp, previousHash, transactions, nonce, nBits } = block;

    // Create a string with all block data
    const blockData = `${id}${timestamp}${previousHash}${JSON.stringify(
      transactions
    )}${nonce}${nBits}`;

    // Calculate SHA-256 hash
    const hash = CryptoJS.SHA256(blockData).toString();

    // Ensure the hash is 64 characters long (32 bytes in hex)
    return hash.padStart(64, '0');
  }
}
