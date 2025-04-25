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

interface TransactionInput {
  address: string;
  amount: number; // in BTC
  utxoReference?: {
    txid: string;
    vout: number;
  };
}

interface TransactionOutput {
  address: string;
  amount: number; // in BTC
}

interface Transaction {
  id: string;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  fee: number; // in BTC
}

interface UTXO {
  txid: string;
  vout: number;
  amount: number;
  address: string;
  blockHeight: number;
  spent: boolean;
  spentInMempool: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface Block {
  height: number;
  hash: string;
  previousHash: string;
  transactions: Transaction[];
  timestamp: Date;
  nonce: number;
  difficulty: number;
  validationResult?: ValidationResult;
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
  blockchain: Block[] = [];
  pendingTransactions: Transaction[] = [];
  utxoSet: Map<string, UTXO> = new Map(); // key: txid:vout
  showNewTransactionDialog = false;
  isEditing = false;
  newTransaction: Transaction = {
    id: '',
    inputs: [{ address: '', amount: 0 }],
    outputs: [{ address: '', amount: 0 }],
    fee: 0,
  };
  mining = false;
  currentDifficulty = 1;
  targetHash =
    '0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  private readonly VBYTES_PER_INPUT = 68;
  private readonly VBYTES_PER_OUTPUT = 31;
  private readonly VBYTES_OVERHEAD = 11;
  private readonly COINBASE_REWARD = 50; // Initial mining reward in BTC

  ngOnInit() {
    this.createGenesisBlock();
  }

  createGenesisBlock() {
    const genesisBlock: Block = {
      height: 0,
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      previousHash:
        '0000000000000000000000000000000000000000000000000000000000000000',
      transactions: [],
      timestamp: new Date(),
      nonce: 0,
      difficulty: 1,
      validationResult: { isValid: true, errors: [] },
    };
    this.blockchain.push(genesisBlock);
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
            txid: this.generateTransactionId(),
            vout: 0,
          },
        }));

      const outputs = Array(getRandomCount())
        .fill(null)
        .map(() => ({
          address: `bc${randomAddress()}`,
          amount: 0,
        }));

      this.newTransaction = { id: '', inputs, outputs, fee: 0 };
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

      this.newTransaction = { id: '', inputs, outputs, fee: 0 };
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
    let remainingAmount = inputTotal - feeInBtc;

    // Distribuir valores aleatórios para cada output, exceto o último
    for (let i = 0; i < this.newTransaction.outputs.length - 1; i++) {
      const percentage = 0.01 + Math.random() * 0.59;
      const amount = Number((remainingAmount * percentage).toFixed(8));
      this.newTransaction.outputs[i].amount = amount;
      remainingAmount -= amount;
    }

    // O último output recebe o valor restante
    this.newTransaction.outputs[this.newTransaction.outputs.length - 1].amount =
      Number(remainingAmount.toFixed(8));
    this.newTransaction.fee = feeInBtc;

    // Marcar UTXOs como usados na mempool
    if (availableUtxos.length > 0) {
      this.newTransaction.inputs.forEach((input) => {
        if (input.utxoReference) {
          const utxoKey = this.getUtxoKey(
            input.utxoReference.txid,
            input.utxoReference.vout
          );
          const utxo = this.utxoSet.get(utxoKey);
          if (utxo) {
            utxo.spentInMempool = true;
          }
        }
      });
    }

    this.showNewTransactionDialog = true;
    this.isEditing = false;
  }

  private validateTransactionInternal(
    transaction: Transaction
  ): ValidationResult {
    const errors: string[] = [];
    let inputTotal = 0;
    let outputTotal = 0;

    // Validar inputs
    for (const input of transaction.inputs) {
      if (!input.utxoReference) {
        errors.push(
          `Input sem referência UTXO para o endereço ${input.address}`
        );
        continue;
      }

      const utxoKey = this.getUtxoKey(
        input.utxoReference.txid,
        input.utxoReference.vout
      );
      const utxo = this.utxoSet.get(utxoKey);

      if (!utxo) {
        errors.push(`UTXO não encontrado: ${utxoKey}`);
        continue;
      }

      if (utxo.spent) {
        errors.push(`UTXO já foi gasto: ${utxoKey}`);
        continue;
      }

      if (utxo.spentInMempool) {
        errors.push(
          `UTXO já está sendo usado em outra transação pendente: ${utxoKey}`
        );
        continue;
      }

      if (utxo.address !== input.address) {
        errors.push(`Endereço não autorizado para gastar UTXO: ${utxoKey}`);
        continue;
      }

      inputTotal += utxo.amount;
    }

    // Validar outputs
    outputTotal = transaction.outputs.reduce(
      (sum, output) => sum + output.amount,
      0
    );
    outputTotal += transaction.fee;

    if (outputTotal > inputTotal) {
      errors.push(
        `Valor total de saída (${outputTotal} BTC) maior que entrada (${inputTotal} BTC)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateTransaction(): boolean {
    const result = this.validateTransactionInternal(this.newTransaction);
    return result.isValid;
  }

  getTransactionError(): string | null {
    const result = this.validateTransactionInternal(this.newTransaction);
    return result.errors.length > 0 ? result.errors[0] : null;
  }

  generateTransactionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  submitNewTransaction() {
    if (!this.validateTransaction()) {
      return;
    }
    this.newTransaction.id = this.generateTransactionId();
    this.pendingTransactions.push({ ...this.newTransaction });
    this.resetNewTransaction();
    this.showNewTransactionDialog = false;
    this.isEditing = false;
  }

  resetNewTransaction() {
    this.newTransaction = {
      id: '',
      inputs: [{ address: '', amount: 0 }],
      outputs: [{ address: '', amount: 0 }],
      fee: 0,
    };
  }

  generateBlockHash(block: Block): string {
    const content = `${block.height}${block.previousHash}${JSON.stringify(
      block.transactions
    )}${block.timestamp}${block.nonce}`;
    return this.hashSHA256(content);
  }

  hashSHA256(content: string): string {
    // Placeholder for actual SHA-256 implementation
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }

  async mineBlock() {
    if (this.mining || this.pendingTransactions.length === 0) {
      return;
    }

    this.mining = true;
    const previousBlock = this.blockchain[this.blockchain.length - 1];

    // Criar a coinbase transaction
    const minerAddress = `1Miner${Math.random().toString(36).substring(2, 10)}`;
    const coinbaseTransaction: Transaction = {
      id: this.generateTransactionId(),
      inputs: [], // Coinbase não tem inputs
      outputs: [
        {
          address: minerAddress,
          amount: this.COINBASE_REWARD,
        },
      ],
      fee: 0,
    };

    const newBlock: Block = {
      height: previousBlock.height + 1,
      previousHash: previousBlock.hash,
      transactions: [coinbaseTransaction, ...this.pendingTransactions],
      timestamp: new Date(),
      nonce: 0,
      difficulty: this.currentDifficulty,
      hash: '',
      validationResult: { isValid: true, errors: [] },
    };

    while (this.mining) {
      newBlock.nonce++;
      newBlock.hash = this.generateBlockHash(newBlock);

      if (newBlock.hash < this.targetHash) {
        // Adicionar UTXOs da coinbase transaction
        this.addUtxo(coinbaseTransaction, newBlock.height);

        // Processar UTXOs das transações normais
        for (const tx of this.pendingTransactions) {
          // Marcar UTXOs gastos
          tx.inputs.forEach((input) => {
            if (input.utxoReference) {
              const utxoKey = this.getUtxoKey(
                input.utxoReference.txid,
                input.utxoReference.vout
              );
              const utxo = this.utxoSet.get(utxoKey);
              if (utxo) {
                utxo.spent = true;
                utxo.spentInMempool = false;
              }
            }
          });

          // Adicionar novos UTXOs
          this.addUtxo(tx, newBlock.height);
        }

        this.blockchain.push(newBlock);
        this.pendingTransactions = [];
        this.mining = false;
        break;
      }

      // Prevent blocking the UI
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  stopMining() {
    this.mining = false;
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
    return Math.floor((this.newTransaction.fee * 100000000) / vBytes);
  }

  addInput() {
    const randomAddress = () => Math.random().toString(36).substring(2, 15);
    this.newTransaction.inputs.push({
      address: `14${randomAddress()}`,
      amount: 0,
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
    this.newTransaction.fee = Number((inputsTotal - outputsTotal).toFixed(8));
  }
}
