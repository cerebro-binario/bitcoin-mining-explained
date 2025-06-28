import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  Block,
  Transaction,
  TransactionInput,
  TransactionOutput,
} from '../../../models/block.model';
import { Location } from '@angular/common';
import { UtxoComponent } from '../../shared/utxo/utxo.component';
import { Node } from '../../../models/node';
import { BipType } from '../../../models/wallet.model';

@Component({
  selector: 'app-block-details',
  standalone: true,
  imports: [CommonModule, UtxoComponent],
  templateUrl: './block-details.component.html',
  styleUrls: ['./block-details.component.scss'],
})
export class BlockDetailsComponent {
  @Input() block!: Block;
  @Input() node!: Node;

  constructor(private location: Location) {}

  onClose() {
    this.location.back();
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
}
