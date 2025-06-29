import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Block,
  Transaction,
  TransactionInput,
  TransactionOutput,
} from '../../../models/block.model';
import { Node } from '../../../models/node';
import { BipType } from '../../../models/wallet.model';
import { UtxoComponent } from '../../shared/utxo/utxo.component';
import { PaginationBarComponent } from '../wallet/pagination-bar.component';

@Component({
  selector: 'app-block-details',
  standalone: true,
  imports: [CommonModule, UtxoComponent, PaginationBarComponent],
  templateUrl: './block-details.component.html',
  styleUrls: ['./block-details.component.scss'],
})
export class BlockDetailsComponent {
  @Input() block!: Block;
  @Input() node!: Node;
  @Input() hasPrevBlock: boolean = false;
  @Input() hasNextBlock: boolean = false;
  @Output() goPrevBlock = new EventEmitter<void>();
  @Output() goNextBlock = new EventEmitter<void>();

  @ViewChild('transactionsTop') transactionsTop!: ElementRef;

  // Paginação de transações
  pageSize = 5;
  currentPage: bigint = 1n;

  get totalPages(): bigint {
    if (!this.block) return 1n;
    return BigInt(Math.ceil(this.block.transactions.length / this.pageSize));
  }

  get pagedTransactions() {
    if (!this.block) return [];
    const start = Number((this.currentPage - 1n) * BigInt(this.pageSize));
    return this.block.transactions.slice(start, start + this.pageSize);
  }

  get pagePercent(): number {
    if (this.totalPages === 0n) return 0;
    return (Number(this.currentPage) / Number(this.totalPages)) * 100;
  }

  get prevDisabled(): boolean {
    return this.currentPage <= 1n;
  }
  get nextDisabled(): boolean {
    return this.currentPage >= this.totalPages;
  }

  goToFirstPage() {
    this.currentPage = 1n;
    this.scrollToTransactionsTop();
  }
  goToPreviousPage() {
    if (this.currentPage > 1n) {
      this.currentPage--;
      this.scrollToTransactionsTop();
    }
  }
  goToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.scrollToTransactionsTop();
    }
  }
  goToLastPage() {
    this.currentPage = this.totalPages;
    this.scrollToTransactionsTop();
  }
  jumpToPage(page: bigint) {
    if (page >= 1n && page <= this.totalPages) {
      this.currentPage = page;
      this.scrollToTransactionsTop();
    }
  }

  scrollToTransactionsTop() {
    setTimeout(() => {
      if (this.transactionsTop?.nativeElement) {
        this.transactionsTop.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 0);
  }

  constructor(private router: Router) {}

  onClose() {
    if (this.node?.id) {
      this.router.navigate(['/miners', this.node.id]);
    } else {
      this.router.navigate(['/']);
    }
  }

  // Verifica se um endereço pertence à carteira do nó
  isWalletAddress(address: string): boolean {
    if (!this.node?.wallet?.addresses) return false;

    for (const addressObj of this.node.wallet.addresses) {
      for (const bipType of Object.keys(addressObj) as BipType[]) {
        const addressData = addressObj[bipType];
        if (addressData?.address === address) {
          return true;
        }
      }
    }
    return false;
  }

  // Verifica se um output é de troco (change)
  isChangeOutput(tx: Transaction, outputIndex: number): boolean {
    if (!this.node?.wallet?.addresses) return false;

    // Se não há inputs da wallet, não é change
    const hasWalletInput = tx.inputs.some((input: TransactionInput) =>
      this.isWalletAddress(input.scriptPubKey.address)
    );
    if (!hasWalletInput) return false;

    // Se o output não é da wallet, não é change
    if (!this.isWalletAddress(tx.outputs[outputIndex].scriptPubKey.address)) {
      return false;
    }

    // Identifica o change: output da wallet com maior vout (último output)
    const walletOutputs = tx.outputs
      .map((output: TransactionOutput, idx: number) => ({ output, index: idx }))
      .filter(({ output }) => this.isWalletAddress(output.scriptPubKey.address))
      .sort((a, b) => b.index - a.index); // Ordena por vout decrescente

    // O output com maior vout é o change (troco)
    return walletOutputs.length > 0 && walletOutputs[0].index === outputIndex;
  }

  // Obtém lista de endereços da carteira do nó
  getWalletAddresses(): string[] {
    if (!this.node?.wallet?.addresses) return [];

    const addresses: string[] = [];
    for (const addressObj of this.node.wallet.addresses) {
      for (const bipType of Object.keys(addressObj) as BipType[]) {
        const addressData = addressObj[bipType];
        if (addressData?.address) {
          addresses.push(addressData.address);
        }
      }
    }
    return addresses;
  }

  getGlobalTxIndex(i: number): number {
    return Number((this.currentPage - 1n) * BigInt(this.pageSize)) + i;
  }

  toNumber(val: bigint): number {
    return Number(val);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  isActiveBlock(): boolean {
    if (!this.node || !this.block) return false;
    for (const h of this.node.heights) {
      for (const bn of h.blocks) {
        if (bn.block.hash === this.block.hash) {
          return bn.isActive;
        }
      }
    }
    return false;
  }

  getBlockEvents() {
    if (!this.node || !this.block) return [];
    const heightObj = this.node.heights.find((h) => h.n === this.block.height);
    if (!heightObj) return [];
    // Filtrar apenas eventos relevantes
    return (heightObj.events || []).filter(
      (e) =>
        e.type === 'halving' ||
        e.type === 'difficulty-adjustment' ||
        e.type === 'consensus-change'
    );
  }

  toHexTarget(target: any, nBits?: any): string {
    if (target !== undefined && target !== null) {
      try {
        let n: bigint;
        if (typeof target === 'bigint') n = target;
        else if (typeof target === 'number') n = BigInt(target);
        else if (typeof target === 'string')
          n = BigInt(target.startsWith('0x') ? target : '0x' + target);
        else return 'indisponível';
        return '0x' + n.toString(16).padStart(64, '0');
      } catch {
        return 'indisponível';
      }
    }
    // Se não há target, mas há nBits, calcula o target
    if (nBits !== undefined && nBits !== null) {
      try {
        const n = this.nBitsToTarget(Number(nBits));
        return '0x' + n.toString(16).padStart(64, '0');
      } catch {
        return 'indisponível';
      }
    }
    return 'indisponível';
  }

  nBitsToTarget(nBits: number): bigint {
    const exponent = nBits >> 24;
    const mantissa = nBits & 0x00ffffff;
    return BigInt(mantissa) * (1n << (8n * (BigInt(exponent) - 3n)));
  }
}
