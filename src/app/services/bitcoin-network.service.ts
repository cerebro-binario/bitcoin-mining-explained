import { Injectable } from '@angular/core';
import { Node } from '../models/node';
import { Block } from '../models/block.model';
import { BlockNode } from '../models/block.model';

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

  // Método para inicializar um nó (minerador ou não)
  initializeNode(node: Node) {
    // Se for o primeiro nó, não precisa sincronizar
    if (this.nodes.length === 1) {
      node.initialSyncComplete = true;
      return;
    }

    // Marca o nó como sincronizando
    node.isSyncing = true;

    // Simula o download da blockchain através dos vizinhos
    // Ordena os vizinhos por latência (menor primeiro)
    const sortedNeighbors = [...node.neighbors].sort(
      (a, b) => a.latency - b.latency
    );

    // Função para verificar se algum vizinho completou o download
    const checkNeighborsForDownload = () => {
      // Tenta obter a blockchain do vizinho com menor latência que já completou o sync
      for (const neighbor of sortedNeighbors) {
        const neighborNode = this.nodes.find((n) => n.id === neighbor.nodeId);

        // Se o vizinho não existe ou ainda não completou seu sync inicial, pula
        if (!neighborNode || !neighborNode.initialSyncComplete) {
          continue;
        }

        // Se o vizinho tem blocos, usa a blockchain dele
        if (neighborNode.genesis) {
          setTimeout(() => {
            // Copia a árvore de blocos do vizinho
            node.genesis = BlockNode.deserializeBlockNode(
              BlockNode.serializeBlockNode(neighborNode.genesis as BlockNode)
            );
            node.heights = neighborNode.heights.slice();

            // Se for um minerador, inicializa o template para o próximo bloco
            if (node.isMiner) {
              node.initBlockTemplate(neighborNode.getLatestBlock());
            }

            node.isSyncing = false;
            node.initialSyncComplete = true;
          }, neighbor.latency);
          return true; // Download iniciado
        }
      }
      return false; // Nenhum vizinho pronto para download
    };

    // Tenta iniciar o download imediatamente
    if (!checkNeighborsForDownload()) {
      // Se não conseguiu iniciar o download, tenta novamente a cada segundo
      const interval = setInterval(() => {
        if (checkNeighborsForDownload()) {
          clearInterval(interval);
        }
      }, 1000);
    }
  }
}
