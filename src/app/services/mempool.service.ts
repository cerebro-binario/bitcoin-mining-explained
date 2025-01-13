import { Injectable } from '@angular/core';
import { COINBASE_ADDRESS } from '../models/address.model';
import { Block } from '../models/block.model';
import { Transaction } from '../models/transaction.model';
import {
  dupHashSHA256,
  getRandomAmount,
  getRandomInt,
  getWeightedRandomInput,
  hashSHA256,
} from '../utils/tools';
import { AddressService } from './address.service';
import { MinerService } from './miner.service';

@Injectable({
  providedIn: 'root',
})
export class MempoolService {
  candidateBlock: Block | null = null;
  transactions: Transaction[] = [];

  constructor(
    private addressService: AddressService,
    private minerService: MinerService
  ) {}

  createCandidateBlock(previousHash: string, height: number): void {
    const subsidy = 50000000 >> (height / 210000);

    this.candidateBlock = {
      previousHash,
      height,
      transactions: [],
      timestamp: new Date().toISOString(),
      hash: '',
      merkleRoot: '',
      nonce: 0,
    };

    // Adiciona a transação de coinbase
    const coinbaseTx: Transaction = {
      txid: '',
      transfers: [
        {
          from: COINBASE_ADDRESS,
          to: this.minerService.getRandomMiner(),
          amount: subsidy,
        },
      ],
      fee: 0,
    };

    coinbaseTx.txid = this.generateTxId(coinbaseTx);

    this.candidateBlock.transactions.push(coinbaseTx);
    this.candidateBlock.merkleRoot = this.generateMerkleRoot();

    // nonce e hash serão calculados na mineração
  }

  generateRandomTransaction() {
    const numInputs = getWeightedRandomInput();

    const numOutputs = getRandomInt(1, 3);

    const inputs = Array.from({ length: numInputs }, () => ({
      address: this.addressService.generateRandomAddress(),
      amount: getRandomAmount(),
    }));

    let totalAmount = inputs.reduce((sum, input) => sum + input.amount, 0);
    const btcVolume = parseFloat(totalAmount.toFixed(8));

    const outputs = Array.from({ length: numOutputs }, (_, i): any => {
      const output = {
        address: this.addressService.generateRandomAddress(),
        amount:
          i === numOutputs - 1
            ? parseFloat(totalAmount.toFixed(8))
            : getRandomAmount(totalAmount),
      };

      totalAmount -= output.amount;

      return output;
    });

    const timestamp = new Date();

    const feePercentage = getRandomInt(1, 10) / 100;
    const fees = parseFloat((btcVolume * feePercentage).toFixed(8));

    return { inputs, outputs, btcVolume, timestamp, fees };
  }

  addTransaction(transaction: any) {
    this.transactions.push(transaction);
  }

  // Gera um TXID utilizando HASH256 (double-SHA256)
  generateTxId(data: Transaction): string {
    // Stringify os dados da transação
    const transactionData = JSON.stringify(data);

    const txid = dupHashSHA256(transactionData);

    return txid; // Retorna o TXID em formato hexadecimal
  }

  generateMerkleRoot(): string {
    if (!this.candidateBlock || this.candidateBlock.transactions.length === 0) {
      throw new Error('There is no candidate block or transactions'); // Não há transações no bloco candidato
    }

    // Calcula os hashes das transações
    let transactionHashes = this.candidateBlock.transactions.map((tx) =>
      hashSHA256(tx.txid)
    );

    // Gera o Merkle Root a partir dos hashes
    while (transactionHashes.length > 1) {
      const newLevel: string[] = [];

      for (let i = 0; i < transactionHashes.length; i += 2) {
        // Se houver um número ímpar de hashes, repita o último
        const hash1 = transactionHashes[i];
        const hash2 = transactionHashes[i + 1] || hash1; // Usa o mesmo hash para completar o par

        // Concatena os dois hashes, calcula o SHA256, e adiciona ao próximo nível
        newLevel.push(hashSHA256(hash1 + hash2));
      }

      transactionHashes = newLevel; // Atualiza o nível atual
    }

    return transactionHashes[0]; // O último hash é o Merkle Root
  }
}
