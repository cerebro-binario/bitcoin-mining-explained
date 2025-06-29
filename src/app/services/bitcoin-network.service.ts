import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MinersStats } from '../components/network/miners-panel/miners-panel.component';
import { Node } from '../models/node';
import { KeyService } from './key.service';

@Injectable({ providedIn: 'root' })
export class BitcoinNetworkService {
  private readonly nodesSubject = new BehaviorSubject<Node[]>([]);

  nodes$ = this.nodesSubject.asObservable();
  nodes: Node[] = this.nodesSubject.getValue();

  private nextNodeId = 1;

  private miningTimeout: any;

  private readonly MINING_INTERVAL = 1; // ms
  private readonly HASH_RATE_UPDATE_INTERVAL = 1000; // ms
  private readonly FRAME_TIME_HISTORY_SIZE = 10;
  private readonly ADJUSTMENT_INTERVAL = 1000; // ms
  private readonly TARGET_FRAME_TIME = 16; // ms (60 FPS)
  private readonly MIN_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 10000;

  private frameTimes: number[] = [];
  private lastHashRateUpdate = 0;
  private lastAdjustmentTime = 0;
  private currentBatchSize = 1000;

  // Hash rate padrão para novos miners
  private _defaultHashRate: number | null = 1000;

  // Getter dinâmico para stats que calcula os valores em tempo real
  get stats(): MinersStats {
    const miners = this.nodes.filter((n) => n.nodeType === 'miner');
    const nMining = miners.filter((n) => n.isMining).length;
    const nCanStart = miners.filter((n) => !n.isMining).length;
    const nCanPause = nMining;

    // Calcula totalHashRate em tempo real
    const totalHashRate = miners
      .filter((n) => n.isMining)
      .reduce((sum, n) => sum + n.currentHashRate, 0);

    // Calcula estatísticas de collapse/expand
    const collapsedMiners = miners.filter((n) => n.isCollapsed).length;
    const toCollapse = miners.length - collapsedMiners;
    const toExpand = collapsedMiners;
    const allCollapsed = collapsedMiners === miners.length && miners.length > 0;

    // Calcula o defaultHashRate dinamicamente
    let defaultHashRate = this._defaultHashRate;
    if (miners.length > 0) {
      const rates = miners.map((m) => m.hashRate);
      const allEqual = rates.every((r) => r === rates[0]);
      defaultHashRate = allEqual ? rates[0] : this._defaultHashRate;
    }

    return {
      toCollapse,
      toExpand,
      allCollapsed,
      nTotal: miners.length,
      nMining,
      nCanStart,
      nCanPause,
      defaultHashRate,
      totalHashRate,
    };
  }

  // Getter e setter para defaultHashRate
  get defaultHashRate(): number | null {
    return this._defaultHashRate;
  }

  set defaultHashRate(value: number | null) {
    this._defaultHashRate = value;
    // Atualiza todos os miners existentes
    this.nodes.forEach((node) => {
      if (node.nodeType === 'miner') {
        node.hashRate = value;
      }
    });
  }

  constructor(private keyService: KeyService) {
    this.startMiningLoop();
  }

  // Método para iniciar o loop de mineração
  startMiningLoop() {
    if (this.miningTimeout) {
      clearTimeout(this.miningTimeout);
    }
    this.runMiningLoop();
  }

  // Método para parar o loop de mineração
  stopMiningLoop() {
    if (this.miningTimeout) {
      clearTimeout(this.miningTimeout);
      this.miningTimeout = null;
    }
  }

  addNode(
    nodeType: 'miner' | 'peer' | 'user',
    name?: string,
    hashRate: number | null = null,
    isCollapsed: boolean = false
  ): Node {
    // Define nome padrão conforme o tipo, se não for passado
    let finalName = name;
    if (!finalName) {
      if (nodeType === 'miner') finalName = `Minerador #${this.nextNodeId}`;
      else if (nodeType === 'user') finalName = `Usuário #${this.nextNodeId}`;
      else finalName = `Nó #${this.nextNodeId}`;
    }

    // Para miners, usa o defaultHashRate se não for especificado
    let finalHashRate = hashRate;
    if (nodeType === 'miner' && finalHashRate === null) {
      finalHashRate = this._defaultHashRate;
    }

    const node = new Node({
      id: this.nextNodeId++,
      nodeType,
      name: finalName,
      hashRate: finalHashRate,
      peers: [],
      isCollapsed,
    });

    // Se for minerador, gera seed, keypair e endereços
    if (nodeType === 'miner' || nodeType === 'peer') {
      const seed = this.keyService.generateSeed();
      const mnemonic = seed.join(' ');
      const addresses = this.keyService.deriveBitcoinAddresses(mnemonic, 1, 0);
      addresses.forEach((address) => {
        address.bip44.nodeId = node.id;
        address.bip49.nodeId = node.id;
        address.bip84.nodeId = node.id;
      });
      node.wallet.seed = seed;
      node.wallet.addresses = addresses;
      node.miningAddress = addresses[0].bip84;
    } else {
      node.wallet = {
        step: 'choose',
        seed: [],
        seedPassphrase: '',
        passphrase: '',
        addresses: [],
      };
    }

    this.nodes.push(node);
    this.nodesSubject.next(this.nodes);
    return node;
  }

  removeNode(nodeId: number) {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.nodes.forEach((n) => {
      n.peers = n.peers.filter((nb) => nb.node.id !== nodeId);
    });
    this.nodesSubject.next(this.nodes);
  }

  private runMiningLoop = () => {
    const startTime = performance.now();
    const now = Date.now();

    // Calcula o batch size adaptativo
    const adaptiveBatchSize = this.calculateAdaptiveBatchSize();

    this.nodes.forEach((node) => {
      if (!node) return;

      if (node.isMining) {
        node.processMiningTick(now, adaptiveBatchSize);
      }

      // Autobusca de peers (com cooldown)
      if (now - node.lastPeerSearch > node.peerSearchInterval) {
        node.lastPeerSearch = now;
        node.searchPeersToConnect(this.nodes);
      }
    });

    // Mede o tempo de execução do frame
    const frameTime = performance.now() - startTime;
    this.updateFrameTime(frameTime);

    // Agenda o próximo ciclo
    this.miningTimeout = setTimeout(this.runMiningLoop, this.MINING_INTERVAL);
  };

  private calculateAdaptiveBatchSize(): number {
    const now = Date.now();

    // Ajusta o batch size periodicamente
    if (now - this.lastAdjustmentTime >= this.ADJUSTMENT_INTERVAL) {
      this.lastAdjustmentTime = now;

      // Calcula a média dos últimos tempos de frame
      const avgFrameTime =
        this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

      // Ajusta o batch size baseado no tempo médio de frame
      if (avgFrameTime > this.TARGET_FRAME_TIME) {
        // Reduz o batch size se estiver muito lento
        this.currentBatchSize = Math.max(
          this.MIN_BATCH_SIZE,
          Math.floor(this.currentBatchSize * 0.8)
        );
      } else if (avgFrameTime < this.TARGET_FRAME_TIME * 0.8) {
        // Aumenta o batch size se estiver muito rápido
        this.currentBatchSize = Math.min(
          this.MAX_BATCH_SIZE,
          Math.floor(this.currentBatchSize * 1.2)
        );
      }

      // Limpa o histórico de tempos
      this.frameTimes = [];
    }

    // Ajusta o batch size baseado no número de miners
    const activeMiners = this.nodes.filter((n) => n.isMining).length;
    const minerAdjustedBatchSize = Math.floor(
      this.currentBatchSize / Math.max(1, activeMiners)
    );

    return Math.max(this.MIN_BATCH_SIZE, minerAdjustedBatchSize);
  }

  private updateFrameTime(frameTime: number) {
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.FRAME_TIME_HISTORY_SIZE) {
      this.frameTimes.shift();
    }
  }

  startAllMiners() {
    this.nodes.forEach((node) => {
      if (node.nodeType !== 'miner') return;

      if (!node || node.isMining) return;

      // Cria um novo bloco se não houver um atual
      if (!node.currentBlock) {
        node.currentBlock = node.initBlockTemplate();
      }

      node.isMining = true;
      node.miningLastTickTime = Date.now();
    });
  }

  pauseAllMiners() {
    this.nodes.forEach((node) => {
      if (node.nodeType !== 'miner') return;
      node.isMining = false;
      node.miningLastTickTime = null;
    });
  }

  setDefaultHashRate(value: number | null) {
    this.defaultHashRate = value;
  }
}
