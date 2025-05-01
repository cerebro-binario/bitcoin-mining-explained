import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { BlockNode } from '../../../models/block.model';

@Component({
  selector: 'app-nodes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nodes-panel.component.html',
  styleUrls: ['./nodes-panel.component.scss'],
})
export class NodesPanelComponent {
  constructor(public network: BitcoinNetworkService) {}

  get nodes() {
    return this.network.nodes.filter((n) => !n.isMiner);
  }

  addNode() {
    const node = this.network.addNode(false);

    // Se for o primeiro nó, não precisa sincronizar
    if (this.network.nodes.length === 1) {
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
        const neighborNode = this.network.nodes.find(
          (n) => n.id === neighbor.nodeId
        );

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

  removeNode(index: number) {
    const node = this.nodes[index];
    if (node) {
      this.network.removeNode(node.id!);
    }
  }
}
