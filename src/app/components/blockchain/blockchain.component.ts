import { Component, OnInit } from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import {
  Transaction,
  TransactionInput,
  TransactionOutput,
  Block,
  ValidationResult,
} from '../../models/blockchain.model';

interface UTXO {
  txid: string;
  vout: number;
  amount: number;
  address: string;
  blockHeight: number;
  spent: boolean;
  spentInMempool: boolean;
}

@Component({
  selector: 'app-blockchain',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    InputNumberModule,
    ButtonModule,
    TableModule,
    DialogModule,
    FormsModule,
    InputTextModule,
    TooltipModule,
  ],
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
})
export class BlockchainComponent implements OnInit {
  blocks: Block[] = [];
  pendingTransactions: Transaction[] = [];
  currentBlock: Block | null = null;
  utxoSet: Map<string, UTXO> = new Map(); // key: txid:vout
  showNewTransactionDialog = false;
  isEditing = false;
  newTransaction!: Transaction;
  transactions: Transaction[] = [];
  usedUtxos: Set<string> = new Set();
  mining = false;
  currentDifficulty = 1;
  targetHash =
    '0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  private readonly VBYTES_PER_INPUT = 68;
  private readonly VBYTES_PER_OUTPUT = 31;
  private readonly VBYTES_OVERHEAD = 11;
  private readonly COINBASE_REWARD = 50; // Initial mining reward in BTC

  constructor() {
    this.initializeNewTransaction();
  }

  ngOnInit() {}

  createGenesisBlock(): void {
    const genesisBlock: Block = {
      height: 0,
      version: 1,
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      previousHash:
        '0000000000000000000000000000000000000000000000000000000000000000',
      merkleRoot: '',
      timestamp: new Date(),
      bits: 0x1d00ffff,
      nonce: 0,
      transactions: [],
      reward: 50,
      validationResult: {
        isValid: true,
        errors: [],
      },
    };
    this.blocks.push(genesisBlock);
  }

  private getUtxoKey(txid: string, vout: number): string {
    return `${txid}:${vout}`;
  }

  private addUtxo(tx: Transaction, blockHeight: number) {
    tx.outputs.forEach((output, index) => {
      const utxoKey = this.getUtxoKey(tx.id, index);
      this.utxoSet.set(utxoKey, {
        txid: tx.id,
        vout: index,
        amount: output.amount,
        address: output.address,
        blockHeight: blockHeight,
        spent: false,
        spentInMempool: false,
      });
    });
  }

  private getAddressBalance(address: string): number {
    let balance = 0;
    for (const utxo of this.utxoSet.values()) {
      if (utxo.address === address && !utxo.spent && !utxo.spentInMempool) {
        balance += utxo.amount;
      }
    }
    return Number(balance.toFixed(8));
  }

  calculateTransactionVSize(): number {
    const inputVBytes =
      this.newTransaction.inputs.length * this.VBYTES_PER_INPUT;
    const outputVBytes =
      this.newTransaction.outputs.length * this.VBYTES_PER_OUTPUT;
    return inputVBytes + outputVBytes + this.VBYTES_OVERHEAD;
  }

  generateNewTransaction() {
    const randomAddress = () => Math.random().toString(36).substring(2, 15);
    const randomAmount = () => Number((Math.random() * 5).toFixed(8));
    const getRandomCount = () => 1 + Math.floor(Math.random() * 3); // 1 a 3

    // Coletar todos UTXOs disponíveis
    const availableUtxos = Array.from(this.utxoSet.values()).filter(
      (utxo) => !utxo.spent && !utxo.spentInMempool
    );

    if (availableUtxos.length === 0) {
      console.warn('Não há UTXOs disponíveis para criar uma transação');
      // Criar uma transação que será inválida para demonstração
      const inputs = Array(getRandomCount())
        .fill(null)
        .map(() => ({
          address: `14${randomAddress()}`,
          amount: randomAmount(),
          utxoReference: {
            txid: this.generateTransactionId(this.newTransaction),
            vout: 0,
          },
        }));

      const outputs = Array(getRandomCount())
        .fill(null)
        .map(() => ({
          address: `bc${randomAddress()}`,
          amount: 0,
        }));

      this.newTransaction = {
        id: '',
        inputs,
        outputs,
        fees: 0,
        volume: 0,
        coinbaseMessage: '',
      };
    } else {
      // Selecionar UTXOs aleatórios para usar como inputs
      const selectedUtxos = availableUtxos
        .sort(() => Math.random() - 0.5)
        .slice(0, getRandomCount());

      const inputs = selectedUtxos.map((utxo) => ({
        address: utxo.address,
        amount: utxo.amount,
        utxoReference: {
          txid: utxo.txid,
          vout: utxo.vout,
        },
      }));

      const outputs = Array(getRandomCount())
        .fill(null)
        .map(() => ({
          address: `bc${randomAddress()}`,
          amount: 0,
        }));

      this.newTransaction = {
        id: '',
        inputs,
        outputs,
        fees: 0,
        volume: 0,
        coinbaseMessage: '',
      };
    }

    // Calcular taxa baseada em sats/vByte
    const inputTotal = this.getInputsTotal(this.newTransaction);
    const vBytes = this.calculateTransactionVSize();
    // Gerar valor aleatório entre 1 e 500 sats/vByte
    const satsPerVByte = 1 + Math.floor(Math.random() * 500);
    // Calcular taxa total em satoshis
    const feeInSats = vBytes * satsPerVByte;
    // Converter para BTC (1 sat = 0.00000001 BTC)
    const feeInBtc = Number((feeInSats * 0.00000001).toFixed(8));
    const remainingAmount =
      this.getInputsTotal(this.newTransaction) -
      this.getOutputsTotal(this.newTransaction) -
      feeInBtc;
    if (remainingAmount > 0) {
      this.newTransaction.outputs[
        this.newTransaction.outputs.length - 1
      ].amount = Number(remainingAmount.toFixed(8));
      this.newTransaction.fees = feeInBtc;
      this.newTransaction.volume = this.getOutputsTotal(this.newTransaction);

      // Marcar UTXOs como usados na mempool
      this.newTransaction.inputs.forEach((input) => {
        this.usedUtxos.add(input.utxoReference.txid);
      });

      this.transactions.push({ ...this.newTransaction });
      this.initializeNewTransaction();
    }

    this.showNewTransactionDialog = true;
    this.isEditing = false;
  }

  validateTransaction(transaction: Transaction): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
    };

    // Validate inputs and outputs
    if (!transaction.inputs || transaction.inputs.length === 0) {
      result.errors.push('Transaction must have at least one input');
    }
    if (!transaction.outputs || transaction.outputs.length === 0) {
      result.errors.push('Transaction must have at least one output');
    }

    // Calculate total input and output amounts
    const totalInputs = transaction.inputs.reduce(
      (sum, input) => sum + input.amount,
      0
    );
    const totalOutputs = transaction.outputs.reduce(
      (sum, output) => sum + output.amount,
      0
    );

    // Validate amounts
    if (totalOutputs > totalInputs) {
      result.errors.push(
        'Total output amount cannot exceed total input amount'
      );
    }

    // Set validation result
    result.isValid = result.errors.length === 0;
    return result;
  }

  private generateTransactionId(transaction: Transaction): string {
    return Math.random().toString(36).substring(2, 15);
  }

  submitTransaction(transaction: Transaction): void {
    const validation = this.validateTransaction(transaction);
    if (validation.isValid) {
      transaction.id = this.generateTransactionId(transaction);
      transaction.fees =
        transaction.inputs.reduce((sum, input) => sum + input.amount, 0) -
        transaction.outputs.reduce((sum, output) => sum + output.amount, 0);
      transaction.volume = transaction.outputs.reduce(
        (sum, output) => sum + output.amount,
        0
      );
      this.pendingTransactions.push(transaction);
    }
  }

  mineBlock(): void {
    this.mining = true;

    try {
      if (this.blocks.length === 0) {
        // Create genesis block
        const genesisBlock: Block = {
          height: 0,
          version: 1,
          hash: '',
          previousHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          merkleRoot: '',
          timestamp: new Date(),
          bits: 0x1d00ffff,
          nonce: 0,
          transactions: [
            {
              id: 'coinbase',
              inputs: [],
              outputs: [
                {
                  address: 'miner',
                  amount: this.COINBASE_REWARD,
                },
              ],
              fees: 0,
              volume: this.COINBASE_REWARD,
              coinbaseMessage:
                'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks',
            },
          ],
          reward: this.COINBASE_REWARD,
          validationResult: {
            isValid: true,
            errors: [],
          },
        };

        // Simple mining simulation
        genesisBlock.hash = this.generateBlockHash(genesisBlock);
        this.blocks.push(genesisBlock);
      } else if (this.pendingTransactions.length > 0) {
        // Create regular block with pending transactions
        const newBlock: Block = {
          height: this.blocks.length,
          version: 1,
          hash: '',
          previousHash: this.blocks[this.blocks.length - 1].hash,
          merkleRoot: this.calculateMerkleRoot(this.pendingTransactions),
          timestamp: new Date(),
          bits: 0x1d00ffff,
          nonce: 0,
          transactions: [...this.pendingTransactions],
          reward: this.COINBASE_REWARD,
          validationResult: {
            isValid: true,
            errors: [],
          },
        };

        // Simple mining simulation
        newBlock.hash = this.generateBlockHash(newBlock);
        this.blocks.push(newBlock);
        this.pendingTransactions = [];
      }
    } finally {
      this.mining = false;
    }
  }

  private calculateMerkleRoot(transactions: Transaction[]): string {
    // Simple implementation - in reality this would use proper Merkle tree
    return transactions.map((t) => t.id).join('');
  }

  private generateBlockHash(block: Block): string {
    // Simple implementation - in reality this would use proper SHA-256
    return Math.random().toString(36).substring(2);
  }

  getCurrentDateTime(): string {
    const now = new Date();
    return now.toLocaleString();
  }

  editTransaction() {
    this.isEditing = true;
  }

  getInputsTotal(transaction: Transaction): number {
    return transaction.inputs.reduce((sum, input) => sum + input.amount, 0);
  }

  getOutputsTotal(transaction: Transaction): number {
    return transaction.outputs.reduce((sum, output) => sum + output.amount, 0);
  }

  getTransactionFeeRate(): number {
    const vBytes = this.calculateTransactionVSize();
    // Converter taxa de BTC para sats e dividir pelo tamanho
    return Math.floor((this.newTransaction.fees * 100000000) / vBytes);
  }

  addInput() {
    this.newTransaction.inputs.push({
      address: '',
      amount: 0,
      utxoReference: {
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
      },
    });
  }

  removeInput(index: number) {
    if (this.newTransaction.inputs.length > 1) {
      this.newTransaction.inputs.splice(index, 1);
    }
  }

  addOutput() {
    const randomAddress = () => Math.random().toString(36).substring(2, 15);
    this.newTransaction.outputs.push({
      address: `bc${randomAddress()}`,
      amount: 0,
    });
  }

  removeOutput(index: number) {
    if (this.newTransaction.outputs.length > 1) {
      this.newTransaction.outputs.splice(index, 1);
    }
  }

  calculateFee() {
    const inputsTotal = this.getInputsTotal(this.newTransaction);
    const outputsTotal = this.getOutputsTotal(this.newTransaction);
    this.newTransaction.fees = Number((inputsTotal - outputsTotal).toFixed(8));
  }

  getTransactionError(): string | null {
    const validation = this.validateTransaction(this.newTransaction);
    if (!validation.isValid) {
      return validation.errors[0];
    }
    if (this.newTransaction.fees < 0) {
      return 'O valor total das saídas excede o valor total das entradas';
    }
    return null;
  }

  private initializeNewTransaction(): void {
    this.newTransaction = {
      id: this.generateTransactionId(this.newTransaction),
      inputs: [
        {
          address: '',
          amount: 0,
          utxoReference: {
            txid: '',
            vout: 0,
          },
        },
      ],
      outputs: [
        {
          address: '',
          amount: 0,
        },
      ],
      fees: 0,
      volume: 0,
      coinbaseMessage: '',
    };
  }
}
