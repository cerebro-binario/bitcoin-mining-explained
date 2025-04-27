import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  Block,
  Transaction,
  TransactionInput,
  TransactionOutput,
} from '../models/block.model';
import { BitcoinNode } from '../models/bitcoin-node.model';
import { MempoolService } from './mempool.service';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root',
})
export class BlockchainService {
  private blocksSubject = new BehaviorSubject<Block[]>([]);
  private pendingTransactionsSubject = new BehaviorSubject<Transaction[]>([]);
  private utxoSetSubject = new BehaviorSubject<
    Map<string, TransactionOutput[]>
  >(new Map());
  private readonly INITIAL_NBITS = 0x1e9fffff;
  private readonly MAX_TRANSACTIONS_PER_BLOCK = 10;
  private readonly SUBSIDY = 50 * 100000000; // 50 BTC em satoshis
  private readonly HALVING_INTERVAL = 210000; // Blocos até próximo halving

  blocks$ = this.blocksSubject.asObservable();
  pendingTransactions$ = this.pendingTransactionsSubject.asObservable();
  utxoSet$ = this.utxoSetSubject.asObservable();

  constructor(private mempool: MempoolService) {
    this.loadBlockchain();
  }

  private loadBlockchain() {
    // TODO: Carregar blockchain do localStorage
  }

  private saveBlockchain() {
    // TODO: Salvar blockchain no localStorage
  }

  private calculateBlockSubsidy(blockHeight: number): number {
    const halvings = Math.floor(blockHeight / this.HALVING_INTERVAL);
    return Math.floor(this.SUBSIDY / Math.pow(2, halvings));
  }

  createNewBlock(miner: BitcoinNode, lastBlock?: Block): Block {
    const transactions = this.getTransactionsForBlock();
    const timestamp = Date.now();
    const previousHash =
      lastBlock?.hash ||
      '0000000000000000000000000000000000000000000000000000000000000000';
    const nBits = this.calculateNBits(lastBlock);
    const blockHeight = (lastBlock?.id || 0) + 1;
    const subsidy = this.calculateBlockSubsidy(blockHeight);

    // Cria a transação coinbase
    const coinbaseTx: Transaction = {
      id: CryptoJS.SHA256(timestamp.toString()).toString(),
      inputs: [], // Coinbase não tem inputs
      outputs: [
        {
          value: subsidy,
          scriptPubKey: miner.miningAddress,
        },
      ],
      signature: '', // Coinbase não precisa de assinatura
    };

    // Adiciona a coinbase como primeira transação
    transactions.unshift(coinbaseTx);

    return new Block({
      id: blockHeight,
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
    const mempoolTransactions = this.pendingTransactionsSubject.value;

    // Adiciona transações até atingir o limite ou esgotar a mempool
    for (
      let i = 0;
      i < Math.min(this.MAX_TRANSACTIONS_PER_BLOCK, mempoolTransactions.length);
      i++
    ) {
      transactions.push(mempoolTransactions[i]);
    }

    // Remove as transações selecionadas da mempool
    if (transactions.length > 0) {
      const remainingTransactions = mempoolTransactions.slice(
        transactions.length
      );
      this.pendingTransactionsSubject.next(remainingTransactions);
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

  // Métodos para gerenciar UTXOs
  private updateUTXOSet(block: Block) {
    const utxoSet = new Map(this.utxoSetSubject.value);

    // Processa cada transação do bloco
    block.transactions.forEach((tx) => {
      // Adiciona novos UTXOs
      tx.outputs.forEach((output, index) => {
        const utxos = utxoSet.get(tx.id) || [];
        utxos[index] = output;
        utxoSet.set(tx.id, utxos);
      });

      // Remove UTXOs gastos
      tx.inputs.forEach((input) => {
        utxoSet.delete(input.txid);
      });
    });

    this.utxoSetSubject.next(utxoSet);
  }

  getUTXO(txid: string, vout: number): TransactionOutput | undefined {
    const utxos = this.utxoSetSubject.value.get(txid);
    return utxos?.[vout];
  }

  getBalance(address: string): number {
    let balance = 0;
    this.utxoSetSubject.value.forEach((utxos, txid) => {
      utxos.forEach((output) => {
        if (output.scriptPubKey === address) {
          balance += output.value;
        }
      });
    });
    return balance;
  }

  addTransactionToMempool(tx: Transaction): void {
    // Verifica se a transação já existe na mempool
    const existingTx = this.pendingTransactionsSubject.value.find(
      (t) => t.id === tx.id
    );
    if (existingTx) return;

    // Adiciona a transação à mempool
    const currentTransactions = this.pendingTransactionsSubject.value;
    this.pendingTransactionsSubject.next([...currentTransactions, tx]);

    // Notifica o mempool service
    this.mempool.addTransaction(tx);
  }
}
