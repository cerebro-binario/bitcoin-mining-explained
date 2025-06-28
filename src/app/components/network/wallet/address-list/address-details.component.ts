import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BipType, BitcoinAddressData } from '../../../../models/wallet.model';
import { BitcoinNetworkService } from '../../../../services/bitcoin-network.service';
import { KeyService } from '../../../../services/key.service';
import { getAddressType } from '../../../../utils/tools';
import { UtxoComponent } from '../../../shared/utxo/utxo.component';
import { PaginationBarComponent } from '../pagination-bar.component';
import { TransactionListComponent } from '../transaction-list/transaction-list.component';

export interface TransactionDetail {
  type: 'input' | 'output' | 'change';
  value: number;
  address: string;
  addressType?: BipType;
  isWallet: boolean;
  txId?: string;
  vout?: number;
  scriptSig?: string;
  blockHeight?: number;
  signatureValid?: boolean;
}

export interface TransactionView {
  id: string;
  type: 'Recebida' | 'Enviada' | 'Coinbase' | 'Interna';
  value: number; // valor principal consolidado
  address: string; // endereço principal (destino ou recebido)
  bipType?: BipType;
  timestamp: number;
  status: string;
  details: TransactionDetail[];
  transactionIndex: number; // Índice da transação no bloco (0 = coinbase, 1+ = transações normais)
  blockHeight: number; // Altura do bloco para ordenação
}

@Component({
  selector: 'app-address-details',
  standalone: true,
  imports: [
    CommonModule,
    UtxoComponent,
    RouterLink,
    TransactionListComponent,
    PaginationBarComponent,
  ],
  templateUrl: './address-details.component.html',
  styleUrls: ['./address-details.component.scss'],
})
export class AddressDetailsComponent implements OnInit, OnDestroy {
  addressData?: BitcoinAddressData;
  addressId?: string;
  nodeId?: number;
  spentUtxos: any[] = [];
  transactionViews: TransactionView[] = [];

  // Paginação de transações
  transactionPagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  pagedTransactionViews: TransactionView[] = [];

  // Paginação de UTXOs
  utxoPagination = {
    pageSize: 6,
    currentPage: 0n,
    totalPages: 0n,
  };
  pagedUtxos: any[] = [];
  pagedSpentUtxos: any[] = [];

  private subscription = new Subscription();
  private privateKeyParam?: string;

  constructor(
    private route: ActivatedRoute,
    private bitcoinNetworkService: BitcoinNetworkService,
    private keyService: KeyService
  ) {}

  ngOnInit() {
    // Subscribe to route params
    this.subscription.add(
      this.route.paramMap.subscribe((paramMap) => {
        this.nodeId = +paramMap.get('id')!;
        this.addressId = paramMap.get('address')!;
        this.setupBalancesSubscription();
        this.loadAddressData();
      })
    );

    // Subscribe to query params
    this.subscription.add(
      this.route.queryParamMap.subscribe((queryParamMap) => {
        const pk = queryParamMap.get('pk');
        if (pk) {
          this.privateKeyParam = pk;
          this.loadAddressData();
        }
      })
    );
  }

  private setupBalancesSubscription() {
    // Find the node directly
    const minerNode = this.bitcoinNetworkService.nodes.find(
      (node: any) => node.id === this.nodeId
    );
    if (minerNode && minerNode.balances$) {
      this.subscription.add(
        minerNode.balances$.subscribe(() => {
          this.loadAddressData();
        })
      );
    }
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
      this.updateAddressTransactions();
      return;
    }

    // 2. Buscar o endereço no balanço global da chain
    foundAddressData = this.findAddressInGlobalBalance(minerNode);

    if (foundAddressData) {
      this.addressData = foundAddressData;
      this.calculateSpentUtxos();
      this.updateAddressTransactions();
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
          this.updateAddressTransactions();
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
          this.updateAddressTransactions();
          return;
        }

        // Se não encontrou em nenhum lugar, usa os dados reconstruídos
        this.addressData = reconstructedData;
        this.calculateSpentUtxos();
        this.updateAddressTransactions();
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

    this.updateUtxoTotalPages();
    this.updateUtxoViews();
  }

  private updateAddressTransactions() {
    if (!this.addressData || !this.addressData.transactions) {
      this.transactionViews = [];
      this.pagedTransactionViews = [];
      return;
    }

    const transactionViews: TransactionView[] = [];

    for (const history of this.addressData.transactions) {
      const timestamp = history.timestamp;
      const status = history.status || 'Confirmada';
      const details: TransactionDetail[] = [];

      // Processa inputs
      history.tx.inputs.forEach((input) => {
        details.push({
          type: 'input',
          value: input.value,
          address: input.scriptPubKey.address,
          addressType: this.detectBipType(input.scriptPubKey.address),
          isWallet: input.scriptPubKey.address === this.addressData!.address,
          txId: input.txid,
          vout: input.vout,
          scriptSig: input.scriptSig,
          blockHeight: input.blockHeight,
          signatureValid: input.signatureValid,
        });
      });

      // Processa outputs
      history.tx.outputs.forEach((output, idx) => {
        const isWallet =
          output.scriptPubKey.address === this.addressData!.address;
        let detailType: TransactionDetail['type'] = 'output';

        if (
          isWallet &&
          history.tx.inputs.some(
            (i) => i.scriptPubKey.address === this.addressData!.address
          )
        ) {
          // Identifica o change: output da wallet com maior vout (último output)
          const walletOutputs = history.tx.outputs
            .map((o, i) => ({ output: o, index: i }))
            .filter(
              ({ output }) =>
                output.scriptPubKey.address === this.addressData!.address
            )
            .sort((a, b) => b.index - a.index); // Ordena por vout decrescente

          // O output com maior vout é o change (troco)
          if (walletOutputs.length > 0 && walletOutputs[0].index === idx) {
            detailType = 'change';
          }
        }

        details.push({
          type: detailType,
          value: output.value,
          address: output.scriptPubKey.address,
          addressType: this.detectBipType(output.scriptPubKey.address),
          isWallet,
          txId: history.tx.id,
          vout: idx,
          scriptSig: undefined,
          blockHeight: history.blockHeight,
        });
      });

      const hasInputFromAddress = history.tx.inputs.some(
        (i) => i.scriptPubKey.address === this.addressData!.address
      );

      if (hasInputFromAddress) {
        // Se houver outputs para fora do endereço, soma esses valores
        const externalOutputs = history.tx.outputs.filter(
          (o) => o.scriptPubKey.address !== this.addressData!.address
        );
        let valueSent = 0;
        let address = '—';
        let txType: TransactionView['type'] = 'Enviada';

        if (externalOutputs.length > 0) {
          valueSent = externalOutputs.reduce((sum, o) => sum + o.value, 0);
          address = externalOutputs[0].scriptPubKey.address;
        } else {
          // Se todos os outputs são para o próprio endereço, exibe como 'Interna'
          const addressOutputs = history.tx.outputs.filter(
            (o) => o.scriptPubKey.address === this.addressData!.address
          );
          if (addressOutputs.length === 1) {
            valueSent = addressOutputs[0].value;
            address = addressOutputs[0].scriptPubKey.address;
          } else if (addressOutputs.length > 1) {
            const minOutput = addressOutputs.reduce(
              (min, o) => (o.value < min.value ? o : min),
              addressOutputs[0]
            );
            valueSent = minOutput.value;
            address = minOutput.scriptPubKey.address;
          }
          txType = 'Interna';
        }

        transactionViews.push({
          id: history.tx.id,
          type: txType,
          value: valueSent,
          address,
          bipType: this.detectBipType(address),
          timestamp,
          status,
          details,
          transactionIndex: history.transactionIndex || 0,
          blockHeight: history.blockHeight,
        });
      }

      if (!hasInputFromAddress) {
        const outputsToAddress = history.tx.outputs.filter(
          (o) => o.scriptPubKey.address === this.addressData!.address
        );
        outputsToAddress.forEach((o) => {
          transactionViews.push({
            id: history.tx.id,
            type: history.tx.inputs.length === 0 ? 'Coinbase' : 'Recebida',
            value: o.value,
            address: o.scriptPubKey.address,
            bipType: this.detectBipType(o.scriptPubKey.address),
            timestamp,
            status,
            details,
            transactionIndex: history.transactionIndex || 0,
            blockHeight: history.blockHeight,
          });
        });
      }
    }

    // Ordena as transações
    this.transactionViews = transactionViews.sort((a, b) => {
      // Primeiro ordena por altura do bloco (decrescente - blocos mais recentes primeiro)
      if (a.blockHeight !== b.blockHeight) {
        return b.blockHeight - a.blockHeight;
      }
      // No mesmo bloco, coinbase primeiro (transactionIndex = 0)
      if (a.transactionIndex !== b.transactionIndex) {
        return b.transactionIndex - a.transactionIndex;
      }
      // Se ainda empatar, ordena por timestamp (decrescente)
      return b.timestamp - a.timestamp;
    });

    this.updateTransactionTotalPages();
    this.updateTransactionViews();
  }

  private detectBipType(address: string): BipType | undefined {
    if (address.startsWith('1')) return 'bip44';
    if (address.startsWith('3')) return 'bip49';
    if (address.startsWith('bc1')) return 'bip84';
    return undefined;
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

  // Métodos de paginação
  get transactionCurrentPageDisplay(): number {
    return Number(this.transactionPagination.currentPage) + 1;
  }

  get transactionTotalPagesDisplay(): number {
    return Number(this.transactionPagination.totalPages);
  }

  get transactionPagePercent(): number {
    if (this.transactionPagination.totalPages === 0n) return 0;
    return (
      ((Number(this.transactionPagination.currentPage) + 1) /
        Number(this.transactionPagination.totalPages)) *
      100
    );
  }

  get transactionPrevDisabled(): boolean {
    return this.transactionPagination.currentPage === 0n;
  }

  get transactionNextDisabled(): boolean {
    return (
      this.transactionPagination.currentPage >=
        this.transactionPagination.totalPages - 1n ||
      this.transactionPagination.totalPages === 0n
    );
  }

  transactionGoToFirstPage() {
    this.transactionPagination.currentPage = 0n;
    this.updateTransactionViews();
  }

  transactionGoToPreviousPage() {
    if (this.transactionPagination.currentPage > 0n) {
      this.transactionPagination.currentPage--;
      this.updateTransactionViews();
    }
  }

  transactionGoToNextPage() {
    if (
      this.transactionPagination.currentPage <
      this.transactionPagination.totalPages - 1n
    ) {
      this.transactionPagination.currentPage++;
      this.updateTransactionViews();
    }
  }

  transactionGoToLastPage() {
    this.transactionPagination.currentPage =
      this.transactionPagination.totalPages - 1n;
    this.updateTransactionViews();
  }

  transactionGoToRandomPage() {
    const rand = BigInt(
      Math.floor(Math.random() * Number(this.transactionPagination.totalPages))
    );
    this.transactionPagination.currentPage = rand;
    this.updateTransactionViews();
  }

  transactionJumpToPage(pageInt: bigint) {
    try {
      let page = pageInt;
      if (page < 1n) page = 1n;
      if (page > this.transactionPagination.totalPages)
        page = this.transactionPagination.totalPages;
      this.transactionPagination.currentPage = page - 1n;
      this.updateTransactionViews();
    } catch {
      // ignore invalid input
    }
  }

  private updateTransactionViews() {
    const start =
      Number(this.transactionPagination.currentPage) *
      Number(this.transactionPagination.pageSize);
    const end = start + Number(this.transactionPagination.pageSize);
    this.pagedTransactionViews = this.transactionViews.slice(start, end);
  }

  private updateTransactionTotalPages() {
    const totalRecords = BigInt(this.transactionViews.length);
    this.transactionPagination = {
      ...this.transactionPagination,
      totalPages: this.ceilBigInt(
        totalRecords,
        BigInt(this.transactionPagination.pageSize)
      ),
    };
  }

  private updateUtxoViews() {
    // Paginar UTXOs disponíveis
    const start =
      Number(this.utxoPagination.currentPage) *
      Number(this.utxoPagination.pageSize);
    const end = start + Number(this.utxoPagination.pageSize);
    this.pagedUtxos = this.addressData?.utxos?.slice(start, end) || [];

    // Paginar UTXOs gastos (se houver)
    const totalUtxos =
      (this.addressData?.utxos?.length || 0) + this.spentUtxos.length;
    const utxosPerPage = Number(this.utxoPagination.pageSize);

    if (this.addressData?.utxos && this.addressData.utxos.length > 0) {
      // Se estamos na página dos UTXOs disponíveis
      if (start < (this.addressData.utxos.length || 0)) {
        this.pagedUtxos = this.addressData.utxos.slice(start, end);
        this.pagedSpentUtxos = [];
      } else {
        // Se estamos na página dos UTXOs gastos
        const spentStart = start - (this.addressData.utxos.length || 0);
        const spentEnd = spentStart + utxosPerPage;
        this.pagedUtxos = [];
        this.pagedSpentUtxos = this.spentUtxos.slice(spentStart, spentEnd);
      }
    } else {
      // Se não há UTXOs disponíveis, paginar apenas os gastos
      this.pagedUtxos = [];
      this.pagedSpentUtxos = this.spentUtxos.slice(start, end);
    }
  }

  private updateUtxoTotalPages() {
    const totalUtxos =
      (this.addressData?.utxos?.length || 0) + this.spentUtxos.length;
    const totalRecords = BigInt(totalUtxos);
    this.utxoPagination = {
      ...this.utxoPagination,
      totalPages: this.ceilBigInt(
        totalRecords,
        BigInt(this.utxoPagination.pageSize)
      ),
    };
  }

  private ceilBigInt(a: bigint, b: bigint): bigint {
    return (a + b - 1n) / b;
  }

  // Métodos de paginação de UTXOs
  get utxoCurrentPageDisplay(): number {
    return Number(this.utxoPagination.currentPage) + 1;
  }

  get utxoTotalPagesDisplay(): number {
    return Number(this.utxoPagination.totalPages);
  }

  get utxoPagePercent(): number {
    if (this.utxoPagination.totalPages === 0n) return 0;
    return (
      ((Number(this.utxoPagination.currentPage) + 1) /
        Number(this.utxoPagination.totalPages)) *
      100
    );
  }

  get utxoPrevDisabled(): boolean {
    return this.utxoPagination.currentPage === 0n;
  }

  get utxoNextDisabled(): boolean {
    return (
      this.utxoPagination.currentPage >= this.utxoPagination.totalPages - 1n ||
      this.utxoPagination.totalPages === 0n
    );
  }

  utxoGoToFirstPage() {
    this.utxoPagination.currentPage = 0n;
    this.updateUtxoViews();
  }

  utxoGoToPreviousPage() {
    if (this.utxoPagination.currentPage > 0n) {
      this.utxoPagination.currentPage--;
      this.updateUtxoViews();
    }
  }

  utxoGoToNextPage() {
    if (this.utxoPagination.currentPage < this.utxoPagination.totalPages - 1n) {
      this.utxoPagination.currentPage++;
      this.updateUtxoViews();
    }
  }

  utxoGoToLastPage() {
    this.utxoPagination.currentPage = this.utxoPagination.totalPages - 1n;
    this.updateUtxoViews();
  }

  utxoJumpToPage(pageInt: bigint) {
    try {
      let page = pageInt;
      if (page < 1n) page = 1n;
      if (page > this.utxoPagination.totalPages)
        page = this.utxoPagination.totalPages;
      this.utxoPagination.currentPage = page - 1n;
      this.updateUtxoViews();
    } catch {
      // ignore invalid input
    }
  }
}
