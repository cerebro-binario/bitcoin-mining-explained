import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { TooltipModule } from 'primeng/tooltip';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [CommonModule, MiningBlockComponent, TooltipModule],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
  animations: [
    trigger('blockAnimation', [
      state(
        'void',
        style({
          opacity: 0,
          transform: 'scale(0.95)',
        })
      ),
      state(
        '*',
        style({
          opacity: 1,
          transform: 'scale(1)',
        })
      ),
      transition('void => *', [animate('0.6s ease-out')]),
    ]),
  ],
})
export class MinersPanelComponent implements OnInit, OnDestroy {
  hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '100 H/s', value: 100 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];

  private readonly SAVE_INTERVAL = 5000; // Salva a cada 5 segundos
  private saveInterval?: any;

  constructor(
    public network: BitcoinNetworkService,
    private blockchain: BlockchainService,
    private addressService: AddressService
  ) {}

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  ngOnInit() {
    // Reinicia a mineração para todos os mineradores que estavam minerando
    this.miners.forEach((miner) => {
      if (miner.isMining) {
        // Para garantir que não haja intervalos residuais
        this.stopMining(miner);
        // Reinicia a mineração
        this.startMining(miner);
      }
    });
  }

  addMiner() {
    const node = this.network.addNode(true, undefined, 1000);
    node.name = `Minerador ${node.id}`;
    node.miningAddress = this.addressService.generateRandomAddress();

    // Se for o primeiro miner, cria o bloco genesis imediatamente
    if (this.network.nodes.length === 1) {
      node.currentBlock = this.blockchain.createNewBlock(node);
      this.network.save();
      this.network.markInitialSyncComplete(node.id!);
      return;
    }

    // Marca o nó como sincronizando
    this.network.startNodeSync(node.id!);

    // Simula o download da blockchain através dos vizinhos
    // Ordena os vizinhos por latência (menor primeiro)
    const sortedNeighbors = [...node.neighbors].sort(
      (a, b) => a.latency - b.latency
    );

    // Função para verificar se algum vizinho completou o download
    const checkNeighborsForDownload = () => {
      // Tenta obter a blockchain do vizinho com menor latência que já completou o sync
      for (const neighbor of sortedNeighbors) {
        const neighborNode = this.network.nodes.find(
          (n) => n.id === neighbor.nodeId
        );

        // Se o vizinho não existe ou ainda não completou seu sync inicial, pula
        if (
          !neighborNode ||
          !this.network.isInitialSyncComplete(neighborNode.id!)
        ) {
          continue;
        }

        // Se o vizinho tem blocos, usa a blockchain dele
        if (neighborNode.blocks.length > 0) {
          // Simula o delay de propagação baseado na latência
          setTimeout(() => {
            // Copia a blockchain do vizinho
            node.blocks = [...neighborNode.blocks];
            // Usa o último bloco como referência para criar um novo bloco
            const lastBlock = neighborNode.getLatestBlock();
            node.currentBlock = this.blockchain.createNewBlock(node, lastBlock);
            this.network.save();
            // Remove o nó da lista de sincronização
            this.network.stopNodeSync(node.id!);
            // Marca a sincronização inicial como completa
            this.network.markInitialSyncComplete(node.id!);
          }, neighbor.latency);
          return true; // Download iniciado
        }
      }
      return false; // Nenhum vizinho pronto para download
    };

    // Tenta iniciar o download imediatamente
    if (checkNeighborsForDownload()) {
      return;
    }

    // Se não encontrou nenhum vizinho pronto, aguarda e tenta novamente
    const checkInterval = setInterval(() => {
      if (checkNeighborsForDownload()) {
        clearInterval(checkInterval);
      }
    }, 1000); // Verifica a cada segundo

    // Se após 30 segundos ainda não encontrou nenhum vizinho pronto, cria um bloco genesis
    setTimeout(() => {
      clearInterval(checkInterval);
      // Cria um bloco genesis
      node.currentBlock = this.blockchain.createNewBlock(node);
      this.network.save();
      // Remove o nó da lista de sincronização
      this.network.stopNodeSync(node.id!);
      // Marca a sincronização inicial como completa
      this.network.markInitialSyncComplete(node.id!);
    }, 30000);
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

  private saveMiningState() {
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

    // Cronômetro de mineração no bloco
    const block = miner.currentBlock;
    if (block) {
      // Se for um novo bloco, zera o cronômetro
      if (!block.miningStartTime && !block.miningElapsed) {
        block.miningElapsed = 0;
      }
      block.miningStartTime = Date.now();
      if (block.miningTimer) clearInterval(block.miningTimer);
      block.miningTimer = setInterval(() => {
        if (miner.isMining && block.miningStartTime) {
          block.miningElapsed += Date.now() - block.miningStartTime;
          block.miningStartTime = Date.now();
        }
      }, 100);
    }

    // Inicia o intervalo para salvar o estado periodicamente
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.saveInterval = setInterval(() => {
      this.saveMiningState();
    }, this.SAVE_INTERVAL);

    // Variáveis para controle do batch
    let lastBatchTime = Date.now();
    let accumulatedTime = 0;
    let batchStartTime = Date.now();
    let hashesInCurrentBatch = 0;

    miner.miningInterval = setInterval(() => {
      if (!miner.currentBlock) return;
      const block = miner.currentBlock;

      const now = Date.now();
      const timeSinceLastBatch = now - lastBatchTime;
      accumulatedTime += timeSinceLastBatch;

      if (hashRate === null) {
        // Modo máximo - processa o máximo possível
        const BATCH_SIZE = 1000;
        for (let i = 0; i < BATCH_SIZE; i++) {
          block.nonce++;
          block.hash = block.calculateHash();
          hashesInCurrentBatch++;

          if (this.blockchain.isValidBlock(block)) {
            console.log('Bloco minerado!', block);

            // Para o cronômetro
            if (block.miningTimer) clearInterval(block.miningTimer);
            block.miningStartTime = null;

            // Adiciona o bloco à blockchain do minerador
            block.minerId = miner.id;
            miner.addBlock(block);

            // Propaga o bloco para os vizinhos
            this.network.propagateBlock(miner.id!, block);

            // Cria um novo bloco para continuar minerando
            miner.currentBlock = this.blockchain.createNewBlock(miner, block);
            // Reinicia o cronômetro para o novo bloco
            const newBlock = miner.currentBlock;
            if (newBlock) {
              newBlock.miningElapsed = 0;
              newBlock.miningStartTime = Date.now();
              if (newBlock.miningTimer) clearInterval(newBlock.miningTimer);
              newBlock.miningTimer = setInterval(() => {
                if (miner.isMining && newBlock.miningStartTime) {
                  newBlock.miningElapsed +=
                    Date.now() - newBlock.miningStartTime;
                  newBlock.miningStartTime = Date.now();
                }
              }, 100);
            }

            // Salva o estado imediatamente após minerar um bloco
            this.saveMiningState();
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
            block.nonce++;
            block.hash = block.calculateHash();
            hashesInCurrentBatch++;

            if (this.blockchain.isValidBlock(block)) {
              console.log('Bloco minerado!', block);

              // Para o cronômetro
              if (block.miningTimer) clearInterval(block.miningTimer);
              block.miningStartTime = null;

              // Adiciona o bloco à blockchain do minerador
              block.minerId = miner.id;
              miner.addBlock(block);

              // Propaga o bloco para os vizinhos
              this.network.propagateBlock(miner.id!, block);

              // Cria um novo bloco para continuar minerando
              miner.currentBlock = this.blockchain.createNewBlock(miner, block);
              // Reinicia o cronômetro para o novo bloco
              const newBlock = miner.currentBlock;
              if (newBlock) {
                newBlock.miningElapsed = 0;
                newBlock.miningStartTime = Date.now();
                if (newBlock.miningTimer) clearInterval(newBlock.miningTimer);
                newBlock.miningTimer = setInterval(() => {
                  if (miner.isMining && newBlock.miningStartTime) {
                    newBlock.miningElapsed +=
                      Date.now() - newBlock.miningStartTime;
                    newBlock.miningStartTime = Date.now();
                  }
                }, 100);
              }

              // Salva o estado imediatamente após minerar um bloco
              this.saveMiningState();
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

    this.saveMiningState();
  }

  stopMining(miner: BitcoinNode) {
    if (!miner.isMining) return;

    miner.isMining = false;
    if (miner.miningInterval) {
      clearInterval(miner.miningInterval);
      miner.miningInterval = undefined;
    }
    // Ao pausar, atualiza o tempo decorrido até agora no bloco
    const block = miner.currentBlock;
    if (block && block.miningStartTime) {
      if (block.miningTimer) clearInterval(block.miningTimer);
      block.miningElapsed += Date.now() - block.miningStartTime;
      block.miningStartTime = null;
    }

    // Limpa o intervalo de salvamento
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    this.saveMiningState();
  }

  onMinerChange() {
    this.network.save();
  }

  isSyncing(node: BitcoinNode): boolean {
    return this.network.isNodeSyncing(node.id!);
  }

  ngOnDestroy() {
    // Limpa os intervalos quando o componente é destruído
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  }
}
