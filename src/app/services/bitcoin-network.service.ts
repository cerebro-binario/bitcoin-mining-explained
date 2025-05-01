import { Injectable } from '@angular/core';
import { Node } from '../models/node';
import { Block } from '../models/block.model';

@Injectable({ providedIn: 'root' })
export class BitcoinNetworkService {
  nodes: Node[] = [];
  private nextId = 1;
  private propagatedBlocks = new Map<string, Set<number>>(); // blockHash -> nodeIds que já receberam

  addNode(isMiner: boolean, name?: string, hashRate?: number): Node {
    const node = new Node({
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
    return node;
  }

  removeNode(nodeId: number) {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.nodes.forEach((n) => {
      n.neighbors = n.neighbors.filter((nb) => nb.nodeId !== nodeId);
    });
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
    }
  }

  private hasNodeReceivedBlock(nodeId: number, blockHash: string): boolean {
    return this.propagatedBlocks.get(blockHash)?.has(nodeId) || false;
  }

  private markBlockAsReceived(nodeId: number, blockHash: string) {
    if (!this.propagatedBlocks.has(blockHash)) {
      this.propagatedBlocks.set(blockHash, new Set());
    }
    this.propagatedBlocks.get(blockHash)!.add(nodeId);
  }

  propagateBlock(sourceNodeId: number, block: Block) {
    const sourceNode = this.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Marca o nó fonte como tendo recebido o bloco
    this.markBlockAsReceived(sourceNodeId, block.hash);

    // Para cada vizinho do nó fonte
    sourceNode.neighbors.forEach((neighbor) => {
      const targetNode = this.nodes.find((n) => n.id === neighbor.nodeId);
      if (!targetNode) return;

      if (this.hasNodeReceivedBlock(targetNode.id!, block.hash)) {
        return;
      }

      // Marca o nó como sincronizando
      targetNode.isSyncing = true;

      // Simula o delay de propagação baseado na latência
      setTimeout(() => {
        // Marca o nó como tendo recebido o bloco
        this.markBlockAsReceived(targetNode.id!, block.hash);

        if (targetNode.initialSyncComplete) {
          // Adiciona o bloco primeiro (isso já reordena os forks)
          targetNode.addBlock(block);

          // Verifica se o bloco mais recente agora é o que acabamos de adicionar
          const latestBlock = targetNode.getLatestBlock();
          if (latestBlock && latestBlock.hash === block.hash) {
            targetNode.initBlockTemplate(block);
          }

          this.propagateBlock(targetNode.id!, block);
        } else {
          // Se ainda não completou o sync inicial, adiciona à fila de pendentes
          targetNode.pendingBlocks.push(block);
        }

        targetNode.isSyncing = false;
      }, neighbor.latency);
    });
  }
}
