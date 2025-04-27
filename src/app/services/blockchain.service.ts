import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Block, Transaction } from '../models/block.model';
import { BitcoinNode } from '../models/bitcoin-node.model';
import { MempoolService } from './mempool.service';

@Injectable({
  providedIn: 'root',
})
export class BlockchainService {
  private blocksSubject = new BehaviorSubject<Block[]>([]);
  private pendingTransactionsSubject = new BehaviorSubject<Transaction[]>([]);
  private utxoSetSubject = new BehaviorSubject<Map<string, any>>(new Map());
  private readonly INITIAL_NBITS = 0x1d00ffff; // Initial nBits value (similar to Bitcoin's genesis block)
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

    // Convert nBits to target
    const target = this.nBitsToTarget(block.nBits);
    console.log('target', target);

    // Convert hash to BigInt for comparison
    const hashValue = BigInt('0x' + block.hash);

    // Block is valid if hash is below target
    return hashValue < target;
  }

  private nBitsToTarget(nBits: number): bigint {
    // Extract exponent and coefficient from nBits
    const exponent = nBits >>> 24;
    const coefficient = nBits & 0x007fffff;

    // Calculate target: coefficient * 2^(8*(exponent-3))
    return BigInt(coefficient) * BigInt(2) ** BigInt(8 * (exponent - 3));
  }

  calculateBlockHash(block: Block): string {
    const { id, timestamp, previousHash, transactions, nonce, nBits } = block;

    // Cria uma string com todos os dados do bloco
    const blockData = `${id}${timestamp}${previousHash}${JSON.stringify(
      transactions
    )}${nonce}${nBits}`;

    // TODO: Implementar hash real usando SHA-256
    // Por enquanto, apenas um hash simples para demonstração
    return this.simpleHash(blockData);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Converte para 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}
