import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { StepperModule } from 'primeng/stepper';
import { BlockchainService } from '../../services/blockchain.service';

@Component({
  selector: 'app-mine-new-block',
  imports: [StepperModule, ButtonModule],
  templateUrl: './mine-new-block.component.html',
  styleUrl: './mine-new-block.component.scss',
})
export class MineNewBlockComponent {
  mempoolTransactions: string[] = [];
  blockHeader = {
    previousHash: '',
    merkleRoot: '',
    nonce: 0,
  };
  difficulty = 4;
  isMining = false;
  hashFound = '';

  constructor(private blockchainService: BlockchainService) {}

  ngOnInit() {
    // Recupera as transações da mempool do app
    // this.mempoolTransactions = this.blockchainService.getMempool();
    // this.blockHeader.previousHash = this.blockchainService.getLatestBlockHash();
  }

  calculateMerkleRoot() {
    // Exemplo simples de cálculo da Merkle Root
    const hashTransactions = this.mempoolTransactions.map((tx) => btoa(tx)); // Base64 como exemplo
    this.blockHeader.merkleRoot = hashTransactions.join('');
  }

  mineBlock() {
    this.isMining = true;
    const interval = setInterval(() => {
      const hash = this.calculateHash();
      if (hash.startsWith('0'.repeat(this.difficulty))) {
        this.isMining = false;
        this.hashFound = hash;
        clearInterval(interval);
      } else {
        this.blockHeader.nonce++;
      }
    }, 100); // Simula o processo de mineração
  }

  calculateHash(): string {
    return btoa(
      this.blockHeader.previousHash +
        this.blockHeader.merkleRoot +
        this.blockHeader.nonce
    );
  }

  finishMining() {
    // Adiciona o bloco minerado ao blockchain e volta para a página Blockchain
    // this.blockchainService.addBlock({
    //   ...this.blockHeader,
    //   transactions: this.mempoolTransactions,
    // });
    window.location.href = '/blockchain';
  }
}
