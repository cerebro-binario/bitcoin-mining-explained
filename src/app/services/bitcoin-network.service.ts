import { Injectable } from '@angular/core';
import { BitcoinNode } from '../models/bitcoin-node.model';
import { Block } from '../models/block.model';

@Injectable({ providedIn: 'root' })
export class BitcoinNetworkService {
  private readonly STORAGE_KEY = 'bitcoin-v2-network';
  nodes: BitcoinNode[] = [];
  private nextId = 1;
  syncingNodes = new Set<number>(); // IDs dos nós que estão sincronizando

  constructor() {
    this.load();
  }

  addNode(isMiner: boolean, name?: string, hashRate?: number): BitcoinNode {
    const node = new BitcoinNode({
      id: this.nextId++,
      isMiner,
      name,
      hashRate,
      neighbors: [],
    });
    // Conexão automática a até 3 vizinhos aleatórios
    const N = Math.min(3, this.nodes.length);
    const candidates = [...this.nodes];
    for (let i = 0; i < N; i++) {
      if (candidates.length === 0) break;
      const idx = Math.floor(Math.random() * candidates.length);
      const neighbor = candidates.splice(idx, 1)[0];
      const latency = 3000 + Math.floor(Math.random() * 7001); // 3000-10000ms (3-10 segundos)
      node.neighbors.push({ nodeId: neighbor.id!, latency });
      neighbor.neighbors.push({ nodeId: node.id!, latency }); // bidirecional
    }
    this.nodes.push(node);
    this.save();
    return node;
  }

  removeNode(nodeId: number) {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.nodes.forEach((n) => {
      n.neighbors = n.neighbors.filter((nb) => nb.nodeId !== nodeId);
    });
    this.save();
  }

  addConnection(nodeId: number, neighborId: number, latency: number = 50) {
    const node = this.nodes.find((n) => n.id === nodeId);
    const neighbor = this.nodes.find((n) => n.id === neighborId);
    if (
      node &&
      neighbor &&
      !node.neighbors.some((n) => n.nodeId === neighborId)
    ) {
      node.neighbors.push({ nodeId: neighborId, latency });
      neighbor.neighbors.push({ nodeId: nodeId, latency });
      this.save();
    }
  }

  removeConnection(nodeId: number, neighborId: number) {
    const node = this.nodes.find((n) => n.id === nodeId);
    const neighbor = this.nodes.find((n) => n.id === neighborId);
    if (node && neighbor) {
      node.neighbors = node.neighbors.filter((n) => n.nodeId !== neighborId);
      neighbor.neighbors = neighbor.neighbors.filter(
        (n) => n.nodeId !== nodeId
      );
      this.save();
    }
  }

  updateLatency(nodeId: number, neighborId: number, latency: number) {
    const node = this.nodes.find((n) => n.id === nodeId);
    const neighbor = this.nodes.find((n) => n.id === neighborId);
    if (node && neighbor) {
      const n1 = node.neighbors.find((n) => n.nodeId === neighborId);
      const n2 = neighbor.neighbors.find((n) => n.nodeId === nodeId);
      if (n1) n1.latency = latency;
      if (n2) n2.latency = latency;
      this.save();
    }
  }

  save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.nodes));
  }

  load() {
    const savedNodes = localStorage.getItem(this.STORAGE_KEY);
    if (savedNodes) {
      try {
        const parsedNodes = JSON.parse(savedNodes);
        // Reinstancia cada nó e seus blocos para garantir que os métodos estejam disponíveis
        this.nodes = parsedNodes.map((nodeData: any) => {
          const node = new BitcoinNode(nodeData);
          if (node.blocks) {
            node.blocks = node.blocks.map(
              (blockData: any) => new Block(blockData)
            );
          }
          if (node.currentBlock) {
            node.currentBlock = new Block(node.currentBlock);
          }
          return node;
        });
      } catch (error) {
        console.error('Erro ao carregar nós:', error);
        this.nodes = [];
      }
    }
  }

  isNodeSyncing(nodeId: number): boolean {
    return this.syncingNodes.has(nodeId);
  }

  startNodeSync(nodeId: number) {
    this.syncingNodes.add(nodeId);
  }

  stopNodeSync(nodeId: number) {
    this.syncingNodes.delete(nodeId);
  }
}
