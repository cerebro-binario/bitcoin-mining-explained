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

        // Log de recebimento do bloco
        targetNode.eventLog.unshift({
          type: 'block-received',
          from: sourceNodeId,
          blockHash: block.hash,
          timestamp: Date.now(),
        });
        if (targetNode.eventLog.length > 10) targetNode.eventLog.pop();

        if (targetNode.initialSyncComplete) {
          // Tenta adicionar o bloco (validação)
          const added = targetNode.addBlock(block);
          if (added) {
            targetNode.eventLog.unshift({
              type: 'block-validated',
              blockHash: block.hash,
              timestamp: Date.now(),
            });
          } else {
            targetNode.eventLog.unshift({
              type: 'block-rejected',
              blockHash: block.hash,
              timestamp: Date.now(),
            });
          }
          if (targetNode.eventLog.length > 10) targetNode.eventLog.pop();

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
  initializeNode(node: Node) {
    // Se for o primeiro nó, não precisa sincronizar
    if (this.nodes.length === 1) {
      node.initialSyncComplete = true;
      return;
    }

    // Marca o nó como sincronizando
    node.isSyncing = true;

    // Inicializa o rastreamento de peers
    node.syncPeers = node.neighbors.map((neighbor) => ({
      nodeId: neighbor.nodeId,
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
        .map((neighbor) => this.nodes.find((n) => n.id === neighbor.nodeId))
        .filter(
          (neighborNode) =>
            neighborNode &&
            neighborNode.initialSyncComplete &&
            neighborNode.genesis
        );

      if (validNeighbors.length === 0) {
        return false;
      }

      // Obtém as blockchains de todos os vizinhos válidos
      const blockchains = validNeighbors.map((neighborNode) => {
        // Atualiza o status do peer para validando
        const peer = node.syncPeers.find((p) => p.nodeId === neighborNode?.id);
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

      // Valida cada blockchain
      const validBlockchains = blockchains
        .map(({ node: neighborNode, blockchain }) => {
          const work = this.calculateChainWork(blockchain);
          const isValid = this.validateBlockchain(blockchain);

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
        node.initialSyncComplete = true;
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
  }

  // Calcula o trabalho acumulado de uma blockchain
  private calculateChainWork(blockchain: BlockNode): number {
    let work = 0;
    let current: BlockNode | undefined = blockchain;

    while (current) {
      // O trabalho é inversamente proporcional ao target
      work += 1 / Number(current.block.target);
      current = current.children[0];
    }

    return work;
  }

  // Método para validar um bloco individual
  private validateBlock(
    block: Block,
    height: number,
    previousBlock?: Block
  ): boolean {
    // 1. Verifica se o hash do bloco é válido
    if (block.hash !== block.calculateHash()) {
      console.warn(`Bloco ${height} tem hash inválido`);
      return false;
    }

    // 2. Verifica se o hash atinge o target
    if (!block.isValid()) {
      console.warn(`Bloco ${height} não atinge o target de dificuldade`);
      return false;
    }

    // 3. Verifica se o bloco anterior existe e tem o hash correto
    if (height > 0) {
      if (!previousBlock || previousBlock.hash !== block.previousHash) {
        console.warn(`Bloco ${height} tem hash anterior inválido`);
        return false;
      }
    }

    // 4. Verifica se o timestamp é razoável
    const now = Date.now();
    if (block.timestamp > now + 7200000) {
      // 2 horas no futuro
      console.warn(`Bloco ${height} tem timestamp no futuro`);
      return false;
    }

    // 5. Verifica se o timestamp é posterior ao bloco anterior
    if (previousBlock && block.timestamp <= previousBlock.timestamp) {
      console.warn(`Bloco ${height} tem timestamp anterior ao bloco anterior`);
      return false;
    }

    // 6. Verifica se a dificuldade (nBits) está correta
    if (height > 0) {
      const expectedNBits = this.calculateExpectedNBits(
        previousBlock!,
        block.timestamp
      );
      if (block.nBits !== expectedNBits) {
        console.warn(
          `Bloco ${height} tem nBits incorreto. Esperado: ${expectedNBits}, Recebido: ${block.nBits}`
        );
        return false;
      }
    }

    // 7. Verifica se o subsídio está correto
    const expectedSubsidy = this.calculateBlockSubsidy(height);
    const actualSubsidy = block.transactions[0].outputs[0].value; // Coinbase é sempre a primeira transação
    if (actualSubsidy !== expectedSubsidy) {
      console.warn(
        `Bloco ${height} tem subsídio incorreto. Esperado: ${expectedSubsidy}, Recebido: ${actualSubsidy}`
      );
      return false;
    }

    return true;
  }

  // Método para validar uma blockchain inteira
  private validateBlockchain(blockchain: BlockNode): boolean {
    let current: BlockNode | undefined = blockchain;
    let previousBlock: Block | undefined;
    let height = 0;

    while (current) {
      const block = current.block;

      if (!this.validateBlock(block, height, previousBlock)) {
        return false;
      }

      previousBlock = block;
      current = current.children[0]; // Pega o primeiro filho (main chain)
      height++;
    }

    return true;
  }

  // Calcula o nBits esperado para o próximo bloco
  private calculateExpectedNBits(
    previousBlock: Block,
    currentTimestamp: number
  ): number {
    // Ajuste de dificuldade a cada 2016 blocos
    const DIFFICULTY_ADJUSTMENT_INTERVAL = 2016;
    const TARGET_TIMESPAN = 14 * 24 * 60 * 60 * 1000; // 2 semanas em milissegundos

    // Se não é um bloco de ajuste de dificuldade, mantém o mesmo nBits
    if (previousBlock.height % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0) {
      return previousBlock.nBits;
    }

    // Encontra o bloco do último ajuste
    let lastAdjustmentBlock = previousBlock;
    for (let i = 0; i < DIFFICULTY_ADJUSTMENT_INTERVAL - 1; i++) {
      const parent = this.findBlockByHash(lastAdjustmentBlock.previousHash);
      if (!parent) return previousBlock.nBits; // Se não encontrou, mantém o mesmo
      lastAdjustmentBlock = parent;
    }

    // Calcula o tempo real que levou para minerar os últimos 2016 blocos
    const actualTimespan = currentTimestamp - lastAdjustmentBlock.timestamp;

    // Limita o ajuste a um fator de 4
    let adjustment = actualTimespan / TARGET_TIMESPAN;
    adjustment = Math.max(0.25, Math.min(4, adjustment));

    // Ajusta o nBits
    const newTarget = Number(previousBlock.target) * adjustment;
    return this.targetToNBits(newTarget);
  }

  // Converte um target para nBits
  private targetToNBits(target: number): number {
    // Implementação simplificada - na prática é mais complexo
    return Math.floor(target);
  }

  // Calcula o subsídio do bloco baseado na altura
  private calculateBlockSubsidy(height: number): number {
    const INITIAL_SUBSIDY = 50 * 100000000; // 50 BTC em satoshis
    const HALVING_INTERVAL = 210000; // Blocos até próximo halving

    const halvings = Math.floor(height / HALVING_INTERVAL);
    return Math.floor(INITIAL_SUBSIDY / Math.pow(2, halvings));
  }

  // Encontra um bloco pelo hash
  private findBlockByHash(hash: string): Block | undefined {
    // Implementação simplificada - na prática precisaria percorrer a blockchain
    return undefined;
  }
}
