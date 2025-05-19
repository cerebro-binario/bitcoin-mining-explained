import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Block, BlockNode } from '../models/block.model';
import { Node } from '../models/node';

@Injectable({ providedIn: 'root' })
export class BitcoinNetworkService {
  private readonly nodesSubject = new BehaviorSubject<Node[]>([]);

  nodes$ = this.nodesSubject.asObservable();
  nodes: Node[] = this.nodesSubject.getValue();

  private nextId = 1;

  addNode(
    isMiner: boolean,
    name?: string,
    hashRate: number | null = null,
    isCollapsed: boolean = false
  ): Node {
    const node = new Node({
      id: this.nextId++,
      isMiner,
      name,
      hashRate,
      neighbors: [],
      isCollapsed,
    });
    this.nodes.push(node);
    this.nodesSubject.next(this.nodes);
    return node;
  }

  removeNode(nodeId: number) {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.nodes.forEach((n) => {
      n.neighbors = n.neighbors.filter((nb) => nb.node.id !== nodeId);
    });
    this.nodesSubject.next(this.nodes);
  }

  propagateBlock(sourceNodeId: number, block: Block) {
    const sourceNode = this.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;
    sourceNode.blockBroadcast$.next(block);
  }

  // Método para contar o número total de blocos em uma blockchain
  private countBlocks(blockchain: BlockNode): number {
    let count = 0;
    let current: BlockNode | undefined = blockchain;

    while (current) {
      count++;
      current = current.children[0]; // Pega o primeiro filho (main chain)
    }

    return count;
  }

  // Método para inicializar um nó (minerador ou não)
  initializeNode(node: Node): Promise<Node> {
    return new Promise((resolve) => {
      // Se for o primeiro nó, não precisa sincronizar
      if (this.nodes.length === 1) {
        node.isSyncing = false;
        resolve(node);
        return;
      }

      // Marca o nó como sincronizando
      node.isSyncing = true;

      // Inicializa o rastreamento de peers
      node.syncPeers = node.neighbors.map((neighbor) => ({
        nodeId: neighbor.node.id!,
        latency: neighbor.latency,
        status: 'pending',
      }));

      // Simula o download da blockchain através dos vizinhos
      // Ordena os vizinhos por latência (menor primeiro)
      const sortedNeighbors = [...node.neighbors].sort(
        (a, b) => a.latency - b.latency
      );

      // Função para verificar se algum vizinho completou o download
      const checkNeighborsForDownload = () => {
        // Coleta as blockchains de todos os vizinhos válidos
        const validNeighbors = sortedNeighbors
          .map((neighbor) => this.nodes.find((n) => n.id === neighbor.node.id))
          .filter((neighborNode) => neighborNode && neighborNode.genesis);

        // Se não há vizinhos com blockchain válida, verifica se há peers com chain mais longa
        if (validNeighbors.length === 0) {
          // Procura por peers que tenham uma chain mais longa
          const peersWithLongerChain = sortedNeighbors
            .map((neighbor) =>
              this.nodes.find((n) => n.id === neighbor.node.id)
            )
            .filter(
              (neighborNode) =>
                neighborNode &&
                neighborNode.heights.length > (node.heights.length || 0)
            );

          // Se não há peers com chain mais longa, libera para minerar genesis
          if (peersWithLongerChain.length === 0) {
            node.isSyncing = false;
            resolve(node);
            return true;
          }
        }

        // Obtém as blockchains de todos os vizinhos válidos
        const blockchains = validNeighbors.map((neighborNode) => {
          // Atualiza o status do peer para validando
          const peer = node.syncPeers.find(
            (p) => p.nodeId === neighborNode?.id
          );
          if (peer) {
            peer.status = 'validating';
          }

          return {
            node: neighborNode,
            blockchain: BlockNode.deserializeBlockNode(
              BlockNode.serializeBlockNode(neighborNode?.genesis as BlockNode)
            ),
          };
        });

        // Valida cada blockchain usando os parâmetros de consenso do nó que está inicializando
        const validBlockchains = blockchains
          .map(({ node: neighborNode, blockchain }) => {
            const work = node.calculateChainWork(blockchain);
            const isValid = node.validateBlockchain(blockchain);

            // Atualiza o status do peer
            const peer = node.syncPeers.find(
              (p) => p.nodeId === neighborNode?.id
            );
            if (peer) {
              peer.status = isValid ? 'valid' : 'invalid';
              peer.blockchainLength = this.countBlocks(blockchain);
              peer.work = work;
            }

            return {
              neighborNode,
              blockchain,
              isValid,
              work,
            };
          })
          .filter((result) => result.isValid)
          .sort((a, b) => b.work - a.work); // Ordena por maior trabalho acumulado

        if (validBlockchains.length === 0) {
          console.warn(`Nó ${node.id} não encontrou nenhuma blockchain válida`);
          return false;
        }

        // Usa a blockchain com maior trabalho acumulado
        const bestBlockchain = validBlockchains[0];

        if (!bestBlockchain?.neighborNode) {
          console.warn(`Nó ${node.id} não encontrou um vizinho válido`);
          return false;
        }

        const validNeighborNode = bestBlockchain.neighborNode;

        setTimeout(() => {
          node.genesis = bestBlockchain.blockchain;
          node.rebuildHeightsFromGenesis();

          // Se for um minerador, inicializa o template para o próximo bloco
          if (node.isMiner) {
            node.initBlockTemplate(validNeighborNode.getLatestBlock());
          }

          node.isSyncing = false;
          resolve(node);
        }, sortedNeighbors[0].latency);

        return true;
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
    });
  }
}
