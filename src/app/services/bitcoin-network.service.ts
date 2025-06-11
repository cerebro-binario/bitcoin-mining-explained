import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MinersStats } from '../components/network/miners-panel/miners-panel.component';
import { Node } from '../models/node';
import { User } from '../models/user.model';
import { KeyService } from './key.service';

@Injectable({ providedIn: 'root' })
export class BitcoinNetworkService {
  private readonly nodesSubject = new BehaviorSubject<Node[]>([]);
  private readonly usersSubject = new BehaviorSubject<User[]>([]);

  nodes$ = this.nodesSubject.asObservable();
  nodes: Node[] = this.nodesSubject.getValue();

  users$ = this.usersSubject.asObservable();
  users: User[] = this.usersSubject.getValue();

  private nextNodeId = 1;
  private nextUserId = 1;

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

  stats: MinersStats = {
    toCollapse: 0,
    toExpand: 0,
    allCollapsed: false,
    nTotal: 0,
    nMining: 0,
    nCanStart: 0,
    nCanPause: 0,
    defaultHashRate: 1000,
    totalHashRate: 0,
  };

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
    isMiner: boolean,
    name?: string,
    hashRate: number | null = null,
    isCollapsed: boolean = false
  ): Node {
    const node = new Node({
      id: this.nextNodeId++,
      isMiner,
      name,
      hashRate,
      peers: [],
      isCollapsed,
    });

    // Se for minerador, gera seed, keypair e endereços
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
    node.miningAddress = addresses[0].bip84.address;
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

    let currentHashRate = 0;

    this.nodes.forEach((node) => {
      if (!node) return;

      if (node.isMining) {
        node.processMiningTick(now, adaptiveBatchSize);
        currentHashRate += node.currentHashRate;
      }

      // Autobusca de peers (com cooldown)
      if (now - node.lastPeerSearch > node.peerSearchInterval) {
        node.lastPeerSearch = now;
        node.searchPeersToConnect(this.nodes);
      }
    });

    // Só atualiza o totalHashRate a cada HASH_RATE_UPDATE_INTERVAL ms
    if (now - this.lastHashRateUpdate >= this.HASH_RATE_UPDATE_INTERVAL) {
      this.stats.totalHashRate = currentHashRate;
      this.lastHashRateUpdate = now;
    }

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

  // User management methods
  addUser(name: string): User {
    const user: User = {
      id: this.nextUserId++,
      name,
    };
    this.users.push(user);
    this.usersSubject.next(this.users);
    return user;
  }

  removeUser(userId: number) {
    this.users = this.users.filter((u) => u.id !== userId);
    this.usersSubject.next(this.users);
  }

  updateUser(user: User) {
    const index = this.users.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      this.users[index] = user;
      this.usersSubject.next(this.users);
    }
  }
}
