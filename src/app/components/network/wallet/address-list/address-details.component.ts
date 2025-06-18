import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BitcoinAddressData, BipType } from '../../../../models/wallet.model';
import { BitcoinNetworkService } from '../../../../services/bitcoin-network.service';
import { getAddressType } from '../../../../utils/tools';

@Component({
  selector: 'app-address-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './address-details.component.html',
  styleUrls: ['./address-details.component.scss'],
})
export class AddressDetailsComponent implements OnInit, OnDestroy {
  addressData?: BitcoinAddressData;
  addressId?: string;
  nodeId?: number;
  spentUtxos: any[] = [];
  private subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bitcoinNetworkService: BitcoinNetworkService
  ) {}

  ngOnInit() {
    this.subscription.add(
      this.route.parent?.paramMap.subscribe((parentParamMap) => {
        this.nodeId = +parentParamMap.get('id')!;
      })
    );

    this.subscription.add(
      this.route.paramMap.subscribe((paramMap) => {
        this.addressId = paramMap.get('address')!;
        this.loadAddressData();
      })
    );

    this.subscription.add(
      this.bitcoinNetworkService.nodes$.subscribe((nodes) => {
        this.loadAddressData();
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private loadAddressData() {
    if (!this.addressId || !this.nodeId) return;

    const nodes = this.bitcoinNetworkService.nodes;
    const minerNode = nodes.find((node: any) => node.id === this.nodeId);

    if (minerNode && minerNode.wallet && minerNode.wallet.addresses) {
      // Primeiro, descobre o tipo BIP do endereço
      const addressType = getAddressType(this.addressId);

      // Depois, busca diretamente no tipo BIP correto
      for (const addressObj of minerNode.wallet.addresses) {
        const addressData = addressObj[addressType];
        if (addressData && addressData.address === this.addressId) {
          this.addressData = addressData;
          this.nodeId = minerNode.id;
          this.calculateSpentUtxos();
          return;
        }
      }
    }
  }

  private calculateSpentUtxos() {
    if (!this.addressData || !this.addressData.transactions) return;

    this.spentUtxos = [];
    const unspentSet = new Set(
      this.addressData.utxos.map((u) => `${u.txId}:${u.outputIndex}`)
    );

    for (const addrTx of this.addressData.transactions) {
      const tx = addrTx.tx;
      if (!tx.outputs) continue;

      tx.outputs.forEach((output: any, idx: number) => {
        if (output.scriptPubKey === this.addressData!.address) {
          const key = `${tx.id}:${idx}`;
          if (!unspentSet.has(key)) {
            let spentInTxId = null;
            for (const t of this.addressData!.transactions!) {
              if (
                t.tx.inputs &&
                t.tx.inputs.some(
                  (input: any) =>
                    input.txid === tx.id &&
                    input.vout === idx &&
                    input.scriptPubKey === this.addressData!.address
                )
              ) {
                spentInTxId = t.tx.id;
                break;
              }
            }
            this.spentUtxos.push({
              output,
              blockHeight: addrTx.blockHeight,
              txId: tx.id,
              outputIndex: idx,
              spentInTxId,
            });
          }
        }
      });
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  goBack() {
    this.router.navigate(['/miner', this.nodeId]);
  }
}
