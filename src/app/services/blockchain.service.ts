import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  Block,
  Transaction,
  TransactionOutput,
} from '../models/blockchain.model';

@Injectable({
  providedIn: 'root',
})
export class BlockchainService {
  private blocksSubject = new BehaviorSubject<Block[]>([]);
  private pendingTransactionsSubject = new BehaviorSubject<Transaction[]>([]);
  private utxoSetSubject = new BehaviorSubject<Map<string, any>>(new Map());

  blocks$ = this.blocksSubject.asObservable();
  pendingTransactions$ = this.pendingTransactionsSubject.asObservable();
  utxoSet$ = this.utxoSetSubject.asObservable();

  constructor() {
    this.loadState();
  }

  private loadState() {
    const savedState = localStorage.getItem('blockchainState');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.blocksSubject.next(state.blocks);
      this.pendingTransactionsSubject.next(state.pendingTransactions);
      this.utxoSetSubject.next(new Map(Object.entries(state.utxoSet)));
    }
  }

  private saveState() {
    const state = {
      blocks: this.blocksSubject.value,
      pendingTransactions: this.pendingTransactionsSubject.value,
      utxoSet: Object.fromEntries(this.utxoSetSubject.value),
    };
    localStorage.setItem('blockchainState', JSON.stringify(state));
  }

  addBlock(block: Block) {
    const currentBlocks = this.blocksSubject.value;
    const newBlocks = [...currentBlocks, block];
    this.blocksSubject.next(newBlocks);

    // Clear pending transactions if this is not the genesis block
    if (newBlocks.length > 1) {
      this.pendingTransactionsSubject.next([]);
    }

    this.updateUtxoSet(block);
    this.saveState();
  }

  addPendingTransaction(transaction: Transaction) {
    const currentTransactions = this.pendingTransactionsSubject.value;
    this.pendingTransactionsSubject.next([...currentTransactions, transaction]);
    this.saveState();
  }

  private updateUtxoSet(block: Block) {
    const currentUtxoSet = this.utxoSetSubject.value;
    const newUtxoSet = new Map(currentUtxoSet);

    // Process transactions in the block
    block.transactions.forEach((tx) => {
      // Add new UTXOs
      tx.outputs.forEach((output, index) => {
        const utxoKey = `${tx.id}:${index}`;
        newUtxoSet.set(utxoKey, {
          txid: tx.id,
          vout: index,
          amount: output.amount,
          address: output.address,
          blockHeight: block.height,
          spent: false,
          spentInMempool: false,
        });
      });

      // Mark inputs as spent
      tx.inputs.forEach((input) => {
        const utxoKey = `${input.txid}:${input.vout}`;
        if (newUtxoSet.has(utxoKey)) {
          newUtxoSet.delete(utxoKey);
        }
      });
    });

    this.utxoSetSubject.next(newUtxoSet);
  }

  getBlocks(): Block[] {
    return this.blocksSubject.value;
  }

  getPendingTransactions(): Transaction[] {
    return this.pendingTransactionsSubject.value;
  }

  getUtxoSet(): Map<string, any> {
    return this.utxoSetSubject.value;
  }

  getAddressUtxos(address: string): TransactionOutput[] {
    const utxos: TransactionOutput[] = [];
    this.utxoSetSubject.value.forEach((utxo) => {
      if (utxo.address === address) {
        utxos.push(utxo);
      }
    });
    return utxos;
  }

  resetBlockchain(): void {
    this.blocksSubject.next([]);
    this.pendingTransactionsSubject.next([]);
    this.utxoSetSubject.next(new Map());
    this.saveState();
  }
}
