import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import {
  Transaction,
  TransactionInput,
  TransactionOutput,
  Block,
  ValidationResult,
} from '../../models/blockchain.model';
import { Buffer } from 'buffer';
import * as crypto from 'crypto-js';
import { BlockchainService } from '../../services/blockchain.service';
import { Subscription } from 'rxjs';

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
    SelectButtonModule,
    SelectModule,
  ],
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
})
export class BlockchainComponent implements OnInit, OnDestroy {
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

  // Mining visualization
  currentHash = '';
  currentNonce = 0;
  miningInterval: any;
  hashRate = 1000; // default: 1 hash por segundo
  hashRateOptions = [
    { label: '1 hash/s', value: 1000 },
    { label: '10 hash/s', value: 100 },
    { label: '50 hash/s', value: 20 },
    { label: 'Máximo', value: 0 },
  ];
  paused = false;
  hashesProcessed = 0;
  startTime: number = 0;
  foundValidHash = false;
  private blockToAdd: Block | null = null;
  winningNonce: number | null = null;
  private cachedHashRate: string = '0';
  private lastHashRateUpdate: number = 0;
  private blocksSubscription: Subscription | null = null;
  private pendingTransactionsSubscription: Subscription | null = null;
  public currentDateTime: string = '';
  public isContinuousMining = false;
  private continuousMiningInterval: any;

  constructor(
    private cdr: ChangeDetectorRef,
    private blockchainService: BlockchainService
  ) {
    this.initializeNewTransaction();
    this.updateCurrentDateTime();
  }

  ngOnInit() {
    // Subscribe to blockchain updates
    this.blocksSubscription = this.blockchainService.blocks$.subscribe(
      (blocks) => {
        this.blocks = blocks;
        this.cdr.detectChanges();
      }
    );

    this.pendingTransactionsSubscription =
      this.blockchainService.pendingTransactions$.subscribe((transactions) => {
        this.pendingTransactions = transactions;
        this.cdr.detectChanges();
      });

    setInterval(() => {
      this.updateCurrentDateTime();
      this.cdr.detectChanges();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.blocksSubscription) {
      this.blocksSubscription.unsubscribe();
    }
    if (this.pendingTransactionsSubscription) {
      this.pendingTransactionsSubscription.unsubscribe();
    }
    if (this.continuousMiningInterval) {
      clearInterval(this.continuousMiningInterval);
    }
  }

  createGenesisBlock(): void {
    const genesisBlock: Block = {
      height: 0,
      version: 1,
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      previousHash:
        '0000000000000000000000000000000000000000000000000000000000000000',
      merkleRoot: '',
      timestamp: Math.floor(Date.now() / 1000),
      bits: 0x1d00ffff,
      nonce: 0,
      transactions: [
        {
          id: 'coinbase',
          timestamp: Math.floor(Date.now() / 1000),
          inputs: [],
          outputs: [
            {
              address: this.generateMinerAddress(),
              amount: this.COINBASE_REWARD,
              scriptPubKey: '',
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
          txid: '',
          vout: 0,
          scriptSig: '',
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
          scriptPubKey: '',
        }));

      this.newTransaction = {
        id: '',
        timestamp: Math.floor(Date.now() / 1000),
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
        txid: utxo.txid,
        vout: utxo.vout,
        scriptSig: '',
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
          scriptPubKey: '',
        }));

      this.newTransaction = {
        id: '',
        timestamp: Math.floor(Date.now() / 1000),
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
        if (input.utxoReference) {
          this.usedUtxos.add(input.utxoReference.txid);
        }
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
      this.blockchainService.addPendingTransaction(transaction);
    }
  }

  onHashRateChange() {
    if (this.mining && this.miningInterval) {
      // Clear current interval
      clearInterval(this.miningInterval);

      // Start new interval with updated rate
      this.startMiningInterval(this.currentBlock!);
    }
  }

  private startMiningInterval(blockToMine: Block) {
    if (this.paused) return;

    // Only reset mining state, but keep hashesProcessed
    this.startTime = Date.now();
    this.foundValidHash = false;
    this.blockToAdd = null;
    this.winningNonce = null;
    this.cachedHashRate = '0';
    this.lastHashRateUpdate = Date.now();

    if (this.hashRate === 0) {
      // Efficient mining mode
      this.miningInterval = setInterval(() => {
        if (!this.mining || this.paused) {
          clearInterval(this.miningInterval);
          if (!this.mining) {
            this.currentBlock = null;
            this.foundValidHash = false;
            this.blockToAdd = null;
          }
          return;
        }

        // Process multiple hashes in each interval
        const batchSize = 10000;
        for (let i = 0; i < batchSize && this.mining && !this.paused; i++) {
          this.currentHash = this.generateBlockHash(blockToMine);

          if (this.isHashValid(this.currentHash)) {
            // Found valid hash
            clearInterval(this.miningInterval);
            blockToMine.hash = this.currentHash;
            this.foundValidHash = true;
            this.blockToAdd = blockToMine;
            this.winningNonce = this.currentNonce;
            this.cdr.detectChanges();
            return;
          }

          this.hashesProcessed++;
          this.currentNonce++;
          blockToMine.nonce = this.currentNonce;
        }

        // Update hash rate every 500ms
        if (Date.now() - this.lastHashRateUpdate >= 500) {
          this.updateHashRate();
          this.cdr.detectChanges();
        }
      }, 0); // Run as fast as possible
    } else {
      this.miningInterval = setInterval(() => {
        if (!this.mining || this.paused) {
          clearInterval(this.miningInterval);
          if (!this.mining) {
            this.currentBlock = null;
            this.foundValidHash = false;
            this.blockToAdd = null;
          }
          return;
        }

        this.currentHash = this.generateBlockHash(blockToMine);
        this.hashesProcessed++;

        if (this.isHashValid(this.currentHash)) {
          // Found valid hash
          clearInterval(this.miningInterval);
          blockToMine.hash = this.currentHash;
          this.foundValidHash = true;
          this.blockToAdd = blockToMine;
          this.winningNonce = this.currentNonce;
          this.cdr.detectChanges();
        }

        this.currentNonce++;
        blockToMine.nonce = this.currentNonce;

        // Update hash rate every 500ms
        if (Date.now() - this.lastHashRateUpdate >= 500) {
          this.updateHashRate();
          this.cdr.detectChanges();
        }
      }, this.hashRate);
    }
  }

  public updateHashRate(): void {
    if (!this.mining || this.paused || Date.now() === this.startTime) {
      this.cachedHashRate = '0';
      return;
    }
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const rate = this.hashesProcessed / elapsedSeconds;
    if (rate < 1000) {
      this.cachedHashRate = rate.toFixed(1);
    } else if (rate < 1000000) {
      this.cachedHashRate = (rate / 1000).toFixed(1) + 'K';
    } else {
      this.cachedHashRate = (rate / 1000000).toFixed(1) + 'M';
    }
    this.lastHashRateUpdate = Date.now();
  }

  getHashRate(): string {
    return this.cachedHashRate;
  }

  private generateMinerAddress(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const prefix = 'bc1';
    let address = prefix;
    for (let i = 0; i < 42; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
  }

  toggleContinuousMining() {
    this.isContinuousMining = !this.isContinuousMining;
    if (this.isContinuousMining) {
      this.startContinuousMining();
    } else {
      this.stopContinuousMining();
    }
  }

  private startContinuousMining() {
    if (this.blocks.length === 0) {
      this.mineBlock();
    } else {
      this.continuousMiningInterval = setInterval(() => {
        if (!this.mining && this.pendingTransactions.length > 0) {
          this.mineBlock();
        }
      }, 1000);
    }
  }

  private stopContinuousMining() {
    if (this.continuousMiningInterval) {
      clearInterval(this.continuousMiningInterval);
    }
    if (this.mining) {
      this.paused = true;
    }
  }

  async mineBlock(): Promise<void> {
    if (this.mining) {
      if (this.paused) {
        // Resume mining
        this.paused = false;
        this.startMiningInterval(this.currentBlock!);
        return;
      }

      // Pause or cancel mining
      if (this.miningInterval) {
        clearInterval(this.miningInterval);
        if (this.currentBlock) {
          // If we have a block, just pause
          this.paused = true;
        } else {
          // If no block, cancel mining completely
          this.mining = false;
        }
      }
      return;
    }

    this.mining = true;
    this.paused = false;
    let blockToMine: Block;

    try {
      if (this.blocks.length === 0) {
        // Create genesis block
        blockToMine = {
          height: 0,
          version: 1,
          hash: '',
          previousHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          merkleRoot: '',
          timestamp: Math.floor(Date.now() / 1000),
          bits: 0x1d00ffff,
          nonce: 0,
          transactions: [
            {
              id: 'coinbase',
              timestamp: Math.floor(Date.now() / 1000),
              inputs: [],
              outputs: [
                {
                  address: this.generateMinerAddress(),
                  amount: this.COINBASE_REWARD,
                  scriptPubKey: '',
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
        // Calculate Merkle root for genesis block
        blockToMine.merkleRoot = this.calculateMerkleRoot(
          blockToMine.transactions
        );
      } else {
        // Create regular block with pending transactions
        const transactions = [
          {
            id: 'coinbase',
            timestamp: Math.floor(Date.now() / 1000),
            inputs: [],
            outputs: [
              {
                address: this.generateMinerAddress(),
                amount: this.COINBASE_REWARD,
                scriptPubKey: '',
              },
            ],
            fees: 0,
            volume: this.COINBASE_REWARD,
            coinbaseMessage: 'Miner reward',
          },
          ...this.pendingTransactions,
        ];

        blockToMine = {
          height: this.blocks.length,
          version: 1,
          hash: '',
          previousHash: this.blocks[this.blocks.length - 1].hash,
          merkleRoot: this.calculateMerkleRoot(transactions),
          timestamp: Math.floor(Date.now() / 1000),
          bits: 0x1d00ffff,
          nonce: 0,
          transactions,
          reward: this.COINBASE_REWARD,
          validationResult: {
            isValid: true,
            errors: [],
          },
        };
      }

      // Start mining visualization
      this.currentBlock = blockToMine;
      this.currentNonce = 0;
      this.currentHash = '';

      this.startMiningInterval(blockToMine);
    } catch (error) {
      console.error('Mining error:', error);
      this.mining = false;
      this.currentBlock = null;
      if (this.miningInterval) {
        clearInterval(this.miningInterval);
      }
    }
  }

  isHashValid(hash: string): boolean {
    if (!hash || !this.targetHash) return false;
    return hash.localeCompare(this.targetHash) <= 0;
  }

  private calculateMerkleRoot(transactions: Transaction[]): string {
    if (transactions.length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Get transaction hashes
    let hashes = transactions.map((tx) => {
      if (tx.id === 'coinbase') {
        // For coinbase transaction, use a deterministic hash based on its data
        const coinbaseData = JSON.stringify({
          outputs: tx.outputs,
          timestamp: new Date().getTime(),
        });
        return this.sha256(Buffer.from(coinbaseData));
      }
      return tx.id;
    });

    // If odd number of transactions, duplicate the last one
    if (hashes.length % 2 === 1) {
      hashes.push(hashes[hashes.length - 1]);
    }

    // Keep hashing pairs until we get to the root
    while (hashes.length > 1) {
      const newHashes: string[] = [];

      // Process pairs
      for (let i = 0; i < hashes.length; i += 2) {
        const firstHash = Buffer.from(hashes[i], 'hex');
        const secondHash = Buffer.from(hashes[i + 1], 'hex');

        // Concatenate and double SHA256
        const concat = Buffer.concat([firstHash, secondHash]);
        const firstSHA = this.sha256(concat);
        const secondSHA = this.sha256(Buffer.from(firstSHA, 'hex'));

        newHashes.push(secondSHA);
      }

      hashes = newHashes;
    }

    return hashes[0];
  }

  private sha256(data: Buffer): string {
    // Use CryptoJS instead of Node's crypto
    const wordArray = crypto.lib.WordArray.create(data);
    return crypto.SHA256(wordArray).toString();
  }

  private reverseHex(hex: string): string {
    return hex.match(/.{2}/g)?.reverse().join('') || '';
  }

  private generateBlockHash(block: Block): string {
    // Convert block header fields to Buffer
    const version = Buffer.alloc(4);
    version.writeUInt32LE(block.version);

    // Previous hash is already in hex, convert to Buffer
    const previousHash = Buffer.from(block.previousHash, 'hex');

    // Merkle root is in hex, convert to Buffer
    const merkleRoot = Buffer.from(
      block.merkleRoot ||
        '0000000000000000000000000000000000000000000000000000000000000000',
      'hex'
    );

    // Convert timestamp to Unix timestamp (seconds) and to Buffer
    const timestamp = Buffer.alloc(4);
    timestamp.writeUInt32LE(Math.floor(block.timestamp / 1000));

    // Convert bits to Buffer
    const bits = Buffer.alloc(4);
    bits.writeUInt32LE(block.bits);

    // Convert nonce to Buffer
    const nonce = Buffer.alloc(4);
    nonce.writeUInt32LE(block.nonce);

    // Concatenate all fields
    const blockHeader = Buffer.concat([
      version,
      previousHash,
      merkleRoot,
      timestamp,
      bits,
      nonce,
    ]);

    // Perform double SHA256 using CryptoJS
    const firstHash = this.sha256(blockHeader);
    const secondHash = this.sha256(Buffer.from(firstHash, 'hex'));

    // Return final hash in little-endian
    return this.reverseHex(secondHash);
  }

  getCurrentDateTime(): string {
    return this.currentDateTime;
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
      txid: '',
      vout: 0,
      scriptSig: '',
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
      scriptPubKey: '',
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
      timestamp: Math.floor(Date.now() / 1000),
      inputs: [
        {
          txid: '',
          vout: 0,
          scriptSig: '',
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
          scriptPubKey: '',
        },
      ],
      fees: 0,
      volume: 0,
      coinbaseMessage: '',
    };
  }

  confirmBlock(): void {
    if (this.blockToAdd) {
      this.blockchainService.addBlock(this.blockToAdd);
      this.mining = false;
      this.paused = false;
      this.currentBlock = null;
      this.foundValidHash = false;
      this.blockToAdd = null;
    }
  }

  private updateCurrentDateTime() {
    this.currentDateTime = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }
}
