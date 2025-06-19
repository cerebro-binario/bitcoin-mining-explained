import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BipType, BitcoinAddressData } from '../../../../models/wallet.model';
import { BitcoinNetworkService } from '../../../../services/bitcoin-network.service';
import { KeyService } from '../../../../services/key.service';
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
  private privateKeyParam?: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bitcoinNetworkService: BitcoinNetworkService,
    private keyService: KeyService
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
      this.route.queryParamMap.subscribe((queryParamMap) => {
        const pk = queryParamMap.get('pk');
        if (pk) {
          this.privateKeyParam = pk;
          this.loadAddressData();
        }
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

    if (!minerNode) return;

    // 1. Buscar o endereço na wallet do miner
    let foundAddressData = this.findAddressInMinerWallet(minerNode);

    if (foundAddressData) {
      this.addressData = foundAddressData;
      this.calculateSpentUtxos();
      return;
    }

    // 2. Buscar o endereço no balanço global da chain
    foundAddressData = this.findAddressInGlobalBalance(minerNode);

    if (foundAddressData) {
      this.addressData = foundAddressData;
      this.calculateSpentUtxos();
      return;
    }

    // 3. Se temos o parâmetro pk, reconstruir a partir da chave privada
    if (this.privateKeyParam) {
      const reconstructedData = this.reconstructAddressDataFromPrivateKey(
        this.privateKeyParam
      );

      if (reconstructedData) {
        // 3.1. Buscar novamente na wallet do miner (agora com as chaves)
        foundAddressData = this.findAddressInMinerWallet(minerNode);
        if (foundAddressData) {
          // Mescla os dados da wallet com as chaves reconstruídas
          this.addressData = {
            ...foundAddressData,
            keys: reconstructedData.keys,
          };
          this.calculateSpentUtxos();
          return;
        }

        // 3.2. Buscar novamente no balanço global (agora com as chaves)
        foundAddressData = this.findAddressInGlobalBalance(minerNode);
        if (foundAddressData) {
          // Mescla os dados do balanço global com as chaves reconstruídas
          this.addressData = {
            ...foundAddressData,
            keys: reconstructedData.keys,
          };
          this.calculateSpentUtxos();
          return;
        }

        // Se não encontrou em nenhum lugar, usa os dados reconstruídos
        this.addressData = reconstructedData;
        this.calculateSpentUtxos();
        return;
      }
    }

    console.error('Endereço não encontrado em nenhuma fonte');
  }

  private findAddressInMinerWallet(
    minerNode: any
  ): BitcoinAddressData | undefined {
    if (!minerNode.wallet || !minerNode.wallet.addresses) return undefined;

    for (const addressObj of minerNode.wallet.addresses) {
      for (const bipType of Object.keys(addressObj) as BipType[]) {
        const addressData = addressObj[bipType];
        if (addressData && addressData.address === this.addressId) {
          return addressData;
        }
      }
    }
    return undefined;
  }

  private findAddressInGlobalBalance(
    minerNode: any
  ): BitcoinAddressData | undefined {
    return minerNode.balances[this.addressId!];
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

  private reconstructAddressDataFromPrivateKey(
    privateKeyDecimal: string
  ): BitcoinAddressData | undefined {
    if (!this.addressId) return undefined;

    const addressType = getAddressType(this.addressId);
    if (!addressType) return undefined;

    try {
      // Converte a chave privada decimal para bigint (índice sequencial)
      const privateKeyIndex = BigInt(privateKeyDecimal);

      // Usa o método público para derivar os endereços a partir do índice sequencial
      const bitcoinAddresses =
        this.keyService.deriveBitcoinAddressesFromSequentialPrivateKey(
          1,
          privateKeyIndex
        );

      if (bitcoinAddresses.length === 0) {
        console.error('Nenhum endereço derivado');
        return undefined;
      }

      // Pega o primeiro (e único) endereço derivado
      const derivedAddress = bitcoinAddresses[0];

      // Pega o endereço do tipo BIP correto
      const addressData = derivedAddress[addressType];

      // Verifica se o endereço derivado corresponde ao da URL
      if (addressData.address !== this.addressId) {
        console.warn(
          `Endereço derivado (${addressData.address}) não corresponde ao da URL (${this.addressId})`
        );
        return undefined;
      }

      // Retorna apenas os dados das chaves para mesclar com outros dados
      return {
        ...addressData,
        nodeId: undefined, // Não pertence a nenhum node
        balance: 0,
        utxos: [],
        transactions: [],
      };
    } catch (error) {
      console.error('Erro ao derivar dados do endereço:', error);
      return undefined;
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  goBack() {
    this.router.navigate(['/miner', this.nodeId]);
  }
}
