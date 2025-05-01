import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { BlockNode } from '../../models/bitcoin-node.model';
import { Block } from '../../models/block.model';
import { AddressService } from '../../services/address.service';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { MinerComponent } from './miner/miner.component';

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [CommonModule, TooltipModule, MinerComponent],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent implements OnDestroy {
  private saveInterval?: any;

  constructor(
    public network: BitcoinNetworkService,
    private addressService: AddressService
  ) {}

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  addMiner() {
    const node = this.network.addNode(true, undefined, 1000);
    node.name = `Minerador ${node.id}`;
    node.miningAddress = this.addressService.generateRandomAddress();

    // Se for o primeiro miner, cria o template para o bloco genesis imediatamente
    if (this.network.nodes.length === 1) {
      node.initBlockTemplate();
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
            // Usa o último bloco da main chain como referência para criar um novo bloco
            node.initBlockTemplate(neighborNode.getLatestBlock());
            node.isSyncing = false;
            node.initialSyncComplete = true;
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
      node.initBlockTemplate();

      node.isSyncing = false;
      node.initialSyncComplete = true;
    }, 30000);
  }

  onBlockBroadcasted(event: { minerId: number; block: Block }) {
    this.network.propagateBlock(event.minerId, event.block);
  }

  onMinerRemoved(event: { minerId: number }) {
    this.network.removeNode(event.minerId);
  }

  ngOnDestroy() {
    // Limpa os intervalos quando o componente é destruído
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  }
}
