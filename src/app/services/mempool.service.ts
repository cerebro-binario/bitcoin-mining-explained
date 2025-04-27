import { Injectable } from '@angular/core';
import {
  Block,
  INITIAL_SUBSIDY,
  N_BLOCKS_PER_HALVING,
} from '../models/block.model';
import { Transaction } from '../models/block.model';
import {
  dupHashSHA256,
  getRandomAmount,
  getRandomInt,
  getWeightedRandomInput,
  hashSHA256,
} from '../utils/tools';
import { AddressService } from './address.service';

@Injectable({
  providedIn: 'root',
})
export class MempoolService {
  private transactions: Transaction[] = [];

  constructor(private addressService: AddressService) {
    this.load();
  }

  //   createCandidateBlock(previousHash: string, height: number): void {
  //     const subsidy = INITIAL_SUBSIDY >> (height / N_BLOCKS_PER_HALVING);

  //     this.candidateBlock = {
  //       previousHash,
  //       height,
  //       transactions: [],
  //       timestamp: new Date().getTime() / 1000,
  //       hash: '',
  //       merkleRoot: '',
  //       nonce: 0,
  //     };

  //     // Pega um minerador aleatoriamente
  //     const randomMiner = this.minerService.getRandomMiner();

  //     // Sorteia aleatoriamente um dos endereços desse minerador para receber a recompensa
  //     const randomCoinbaseAddressIdx = Math.floor(
  //       Math.random() * BITCOIN_ADDRESS_TYPE_CODES.length
  //     );
  //     const randomCoinbaseAddressType =
  //       BITCOIN_ADDRESS_TYPE_CODES[randomCoinbaseAddressIdx];
  //     const randomCoinbaseAddress =
  //       randomMiner.addresses[randomCoinbaseAddressType];

  //     // Adiciona a transação de coinbase
  //     const coinbaseTx: Transaction = {
  //       txid: '',
  //       transfers: [
  //         {
  //           from: COINBASE_ADDRESS,
  //           to: randomCoinbaseAddress.address,
  //           amount: subsidy,
  //         },
  //       ],
  //       fee: 0,
  //     };

  //     this.candidateBlock.transactions.push(coinbaseTx);

  //     // txid's, merkle root, nonce e hash serão calculados na mineração
  //   }

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

  addTransaction(transaction: Transaction) {
    this.transactions.push(transaction);
    this.save();
  }

  getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  removeTransactions(transactions: Transaction[]) {
    this.transactions = this.transactions.filter(
      (tx) => !transactions.some((t) => t.id === tx.id)
    );
    this.save();
  }

  private save() {
    localStorage.setItem('mempool', JSON.stringify(this.transactions));
  }

  private load() {
    const saved = localStorage.getItem('mempool');
    if (saved) {
      this.transactions = JSON.parse(saved);
    }
  }

  // Gera um TXID utilizando HASH256 (double-SHA256)
  generateTxId(data: Transaction): string {
    // Stringify os dados da transação
    const transactionData = JSON.stringify(data);

    const txid = dupHashSHA256(transactionData);

    return txid; // Retorna o TXID em formato hexadecimal
  }

  //   generateMerkleRoot(): string {
  //     if (!this.candidateBlock || this.candidateBlock.transactions.length === 0) {
  //       throw new Error('There is no candidate block or transactions'); // Não há transações no bloco candidato
  //     }

  //     // Calcula os hashes das transações
  //     let transactionHashes = this.candidateBlock.transactions.map((tx) =>
  //       hashSHA256(tx.txid)
  //     );

  //     // Gera o Merkle Root a partir dos hashes
  //     while (transactionHashes.length > 1) {
  //       const newLevel: string[] = [];

  //       for (let i = 0; i < transactionHashes.length; i += 2) {
  //         // Se houver um número ímpar de hashes, repita o último
  //         const hash1 = transactionHashes[i];
  //         const hash2 = transactionHashes[i + 1] || hash1; // Usa o mesmo hash para completar o par

  //         // Concatena os dois hashes, calcula o SHA256, e adiciona ao próximo nível
  //         newLevel.push(hashSHA256(hash1 + hash2));
  //       }

  //       transactionHashes = newLevel; // Atualiza o nível atual
  //     }

  //     return transactionHashes[0]; // O último hash é o Merkle Root
  //   }
}
