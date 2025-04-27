import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { AddressService } from '../../services/address.service';
import { BlockchainService } from '../../services/blockchain.service';
import { BitcoinNode } from '../../models/bitcoin-node.model';
import { MiningBlockComponent } from './mining-block/mining-block.component';
import {
  Block,
  Transaction,
  TransactionInput,
  TransactionOutput,
} from '../../models/block.model';
import * as CryptoJS from 'crypto-js';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [CommonModule, MiningBlockComponent],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent {
  hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '100 H/s', value: 100 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];

  constructor(
    public network: BitcoinNetworkService,
    private blockchain: BlockchainService,
    private addressService: AddressService
  ) {}

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  addMiner() {
    const node = this.network.addNode(true, undefined, 1000);
    node.name = `Minerador ${node.id}`;
    node.miningAddress = this.addressService.generateRandomAddress();

    // Cria um template inicial do bloco
    let lastBlock: Block | undefined;
    this.blockchain.blocks$
      .subscribe((blocks) => {
        lastBlock = blocks[blocks.length - 1];
      })
      .unsubscribe();

    node.currentBlock = this.blockchain.createNewBlock(node, lastBlock);

    this.network.save();
  }

  createTransaction(miner: BitcoinNode) {
    // Gera um endereço aleatório para o destinatário
    const recipientAddress = this.addressService.generateRandomAddress();

    // Cria uma nova transação
    const tx: Transaction = {
      id: CryptoJS.SHA256(Date.now().toString()).toString(),
      inputs: [],
      outputs: [
        {
          value: 1000000, // 0.01 BTC em satoshis
          scriptPubKey: recipientAddress,
        },
      ],
      signature: miner.name, // Usando o nome do miner como assinatura temporária
    };

    // Adiciona a transação à mempool do miner
    this.blockchain.addTransactionToMempool(tx);

    // Inicia a propagação da transação
    this.propagateTransaction(tx, miner);
  }

  private propagateTransaction(tx: Transaction, sourceNode: BitcoinNode) {
    // Ordena os vizinhos por latência
    const sortedNeighbors = [...sourceNode.neighbors].sort(
      (a, b) => a.latency - b.latency
    );

    // Propaga para cada vizinho com um delay baseado na latência
    sortedNeighbors.forEach((neighbor) => {
      const targetNode = this.network.nodes.find(
        (n) => n.id === neighbor.nodeId
      );
      if (!targetNode) return;

      // Simula o delay de propagação baseado na latência
      setTimeout(() => {
        // Adiciona a transação à mempool do nó vizinho
        this.blockchain.addTransactionToMempool(tx);

        // Se o nó vizinho não é a fonte, continua propagando
        if (targetNode.id !== sourceNode.id) {
          this.propagateTransaction(tx, targetNode);
        }
      }, neighbor.latency);
    });
  }

  removeMiner(index: number) {
    const miner = this.miners[index];
    if (miner) {
      this.stopMining(miner);
      this.network.removeNode(miner.id!);
    }
  }

  setHashRate(miner: BitcoinNode, rate: number | null) {
    miner.hashRate = rate;
    if (miner.isMining) {
      this.stopMining(miner);
      this.startMining(miner);
    }
    this.network.save();
  }

  startMining(miner: BitcoinNode) {
    if (miner.isMining) return;

    // Cria um novo bloco se não houver um atual
    if (!miner.currentBlock) {
      miner.currentBlock = this.blockchain.createNewBlock(miner);
    }

    miner.isMining = true;
    const hashRate = miner.hashRate;

    // Variáveis para controle do batch
    let lastBatchTime = Date.now();
    let accumulatedTime = 0;
    let batchStartTime = Date.now();
    let hashesInCurrentBatch = 0;

    miner.miningInterval = setInterval(() => {
      if (!miner.currentBlock) return;

      const now = Date.now();
      const timeSinceLastBatch = now - lastBatchTime;
      accumulatedTime += timeSinceLastBatch;

      if (hashRate === null) {
        // Modo máximo - processa o máximo possível
        const BATCH_SIZE = 1000;
        for (let i = 0; i < BATCH_SIZE; i++) {
          miner.currentBlock.nonce++;
          miner.currentBlock.hash = this.blockchain.calculateBlockHash(
            miner.currentBlock
          );
          hashesInCurrentBatch++;

          if (this.blockchain.isValidBlock(miner.currentBlock)) {
            console.log('Bloco minerado!', miner.currentBlock);

            // Adiciona o bloco à blockchain local do minerador
            miner.addBlock(miner.currentBlock);

            // Cria um novo bloco para continuar minerando
            miner.currentBlock = this.blockchain.createNewBlock(
              miner,
              miner.currentBlock
            );
            break;
          }
        }
      } else {
        // Modo com hash rate controlado
        const timeNeededForOneHash = 1000 / hashRate; // tempo em ms para 1 hash
        if (accumulatedTime >= timeNeededForOneHash) {
          const hashesToProcess = Math.floor(
            accumulatedTime / timeNeededForOneHash
          );

          for (let i = 0; i < hashesToProcess; i++) {
            miner.currentBlock.nonce++;
            miner.currentBlock.hash = this.blockchain.calculateBlockHash(
              miner.currentBlock
            );
            hashesInCurrentBatch++;

            if (this.blockchain.isValidBlock(miner.currentBlock)) {
              console.log('Bloco minerado!', miner.currentBlock);

              // Adiciona o bloco à blockchain local do minerador
              miner.addBlock(miner.currentBlock);

              // Cria um novo bloco para continuar minerando
              miner.currentBlock = this.blockchain.createNewBlock(
                miner,
                miner.currentBlock
              );
              break;
            }
          }

          accumulatedTime = accumulatedTime % timeNeededForOneHash;
        }
      }

      // Atualiza o tempo do último batch
      lastBatchTime = now;

      // Atualiza o hash rate real a cada segundo
      if (now - batchStartTime >= 1000) {
        miner.currentHashRate = hashesInCurrentBatch;
        batchStartTime = now;
        hashesInCurrentBatch = 0;
      }
    }, 1); // Intervalo mínimo de 1ms

    this.network.save();
  }

  stopMining(miner: BitcoinNode) {
    if (!miner.isMining) return;

    miner.isMining = false;
    if (miner.miningInterval) {
      clearInterval(miner.miningInterval);
      miner.miningInterval = undefined;
    }

    this.network.save();
  }

  onMinerChange() {
    this.network.save();
  }
}
