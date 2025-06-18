import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import {
  BitcoinAddressData,
  BitcoinUTXO,
} from '../../../../models/wallet.model';
import {
  TransactionInput,
  TransactionOutput,
} from '../../../../models/block.model';

@Component({
  selector: 'app-address-details-dialog',
  templateUrl: './address-details-dialog.component.html',
  styleUrls: ['./address-details-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
})
export class AddressDetailsDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() addressData!: BitcoinAddressData;
  @Output() close = new EventEmitter<void>();

  spentUtxos: BitcoinUTXO[] = [];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['addressData'] && this.addressData) {
      this.spentUtxos = this.calculateSpentUtxos(this.addressData);
    }
  }

  onClose() {
    this.close.emit();
  }

  copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }

  calculateSpentUtxos(addressData: BitcoinAddressData) {
    if (!addressData.transactions) return [];
    if (!addressData.utxos) return [];
    const unspentSet = new Set(
      (addressData.utxos || []).map(
        (u: BitcoinUTXO) => `${u.txId}:${u.outputIndex}`
      )
    );
    const spentUtxos: BitcoinUTXO[] = [];
    for (const history of addressData.transactions) {
      if (!history.tx.outputs) continue;
      history.tx.outputs.forEach((output: TransactionOutput, idx: number) => {
        if (output.scriptPubKey === addressData.address) {
          const key = `${history.tx.id}:${idx}`;
          if (!unspentSet.has(key)) {
            for (const t of addressData.transactions) {
              if (
                t.tx.inputs &&
                t.tx.inputs.some(
                  (input: TransactionInput) =>
                    input.txid === history.tx.id &&
                    input.vout === idx &&
                    input.scriptPubKey === addressData.address
                )
              ) {
                break;
              }
            }
            spentUtxos.push({
              output,
              blockHeight: history.blockHeight || 0,
              txId: history.tx.id,
              outputIndex: idx,
            });
          }
        }
      });
    }
    return spentUtxos;
  }
}
