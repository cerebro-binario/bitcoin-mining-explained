import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import {
  Transaction,
  TransactionInput,
  TransactionOutput,
  generateTransactionId,
} from '../../../models/block.model';
import { Node } from '../../../models/node';
import {
  BipType,
  BitcoinAddressData,
  BitcoinUTXO,
  TransactionHistory,
  Wallet,
} from '../../../models/wallet.model';
import { KeyService } from '../../../services/key.service';
import { ceilBigInt } from '../../../utils/tools';
import { AddressListComponent } from './address-list/address-list.component';
import { PaginationBarComponent } from './pagination-bar.component';
import { TransactionListComponent } from './transaction-list/transaction-list.component';

export interface TransactionDetail {
  type: 'input' | 'output' | 'change';
  value: number;
  address: string;
  addressType?: BipType;
  isWallet: boolean;
  txId?: string;
  vout?: number;
}

export interface TransactionView {
  id: string;
  type: 'Recebida' | 'Enviada' | 'Coinbase';
  value: number; // valor principal consolidado
  address: string; // endereço principal (destino ou recebido)
  bipType?: BipType;
  timestamp: number;
  status: string;
  details: TransactionDetail[];
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    FormsModule,
    AddressListComponent,
    TabsModule,
    TransactionListComponent,
    PaginationBarComponent,
    SelectModule,
  ],
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  private _wallet: Wallet | null = null;
  private _bipFormat: BipType | 'all-bip-types' = 'bip84';
  private goToLastPageAfterWalletUpdate = false;

  activeTab: 'enderecos' | 'transacoes' | 'enviar' = 'enderecos';

  @Input() set wallet(wallet: Wallet | null) {
    if (this._wallet === wallet) return;
    this._wallet = wallet;
    this.updateView();
    if (this.goToLastPageAfterWalletUpdate) {
      this.goToLastPage();
      this.goToLastPageAfterWalletUpdate = false;
    }
  }
  @Input() node!: Node;
  @Input() set bipFormat(bipFormat: BipType | 'all-bip-types') {
    this._bipFormat = bipFormat;
    this.updateView();
  }
  @Output() deriveNextAddress = new EventEmitter<void>();
  @Output() bipFormatChange = new EventEmitter<BipType | 'all-bip-types'>();

  addresses: BitcoinAddressData[] = [];
  addressesDisplay: BitcoinAddressData[] = [];
  pagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  jumpPageInput: string = '';
  transactions: Transaction[] = [];
  availableBalance = 0;

  // Campos do formulário de envio
  sendToAddress: string = '';
  sendAmount: number | null = null;
  sendError: string = '';
  sendSuccess: string = '';

  // Controle de erro e foco do campo de valor
  sendAmountTouched = false;
  sendAmountFocused = false;
  sendAddressTouched = false;
  sendAddressFocused = false;
  sendToAddressValid: boolean | null = null;
  sendToAddressErrorMsg: string = '';
  sendAmountValid: boolean | null = null;
  sendAmountErrorMsg: string = '';

  // Seleção de UTXO
  utxoSelectionMode: 'auto' | 'manual' = 'auto';
  allAvailableUtxos: (BitcoinUTXO & {
    address: string;
    bipType: BipType;
    selected: boolean;
  })[] = [];
  manuallySelectedUtxos: (BitcoinUTXO & {
    address: string;
    bipType: BipType;
  })[] = [];
  manualSelectionTotal = 0;

  // Preview da transação
  showTransactionPreview = false;
  previewInputs: {
    address: string;
    value: number;
    bipType?: BipType;
    height: number;
    txId: string;
    vout: number;
  }[] = [];
  previewOutputs: {
    address: string;
    value: number;
    type: 'destination' | 'change';
    bipType?: BipType;
  }[] = [];
  previewFee = 0;
  previewTotalInput = 0;
  previewTotalOutput = 0;

  selectedUtxos: BitcoinUTXO[] = [];
  changeAddress: string = '';
  changeAmount: number = 0;
  showTxConfirmation = false;
  txOutputs: { address: string; value: number }[] = [];

  transactionViews: TransactionView[] = [];

  // Paginação de transações
  transactionPagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  pagedTransactionViews: TransactionView[] = [];

  // Modo de assinatura
  signatureMode: 'auto' | 'manual' = 'auto';
  signedInputs: boolean[] = [];

  // Estado para assinatura manual detalhada
  inputSignatureScripts: (string | null)[] = [];
  inputSignatureErrors: (string | null)[] = [];

  selectedPrivateKey: (string | null)[] = [];

  get sendButtonDisabled(): boolean {
    return (
      !this.sendToAddressValid ||
      !this.sendAmountValid ||
      !this.sendAmount ||
      this.sendAmount <= 0
    );
  }

  get bipFormat(): BipType | 'all-bip-types' {
    return this._bipFormat;
  }

  constructor(
    private keyService: KeyService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Lê a aba ativa dos query params
    this.route.queryParams.subscribe((params) => {
      if (params['walletTab']) {
        this.activeTab = params['walletTab'] as
          | 'enderecos'
          | 'transacoes'
          | 'enviar';
      }
    });
  }

  private updateView() {
    this.updateAddresses();
    this.updateTotalPages();
    this.displayAddresses();
    this.updateAvailableBalance();
    this.updateWalletTransactions();
    this.prepareAllUtxosForManualSelection();
  }

  private updateAddresses() {
    if (!this._wallet) return;
    this.addresses = [];

    if (this.bipFormat === 'all-bip-types') {
      this.addresses = this._wallet.addresses.reduce((acc, address) => {
        return [...acc, ...Object.values(address)];
      }, [] as BitcoinAddressData[]);
    } else {
      this.addresses = this._wallet.addresses.map(
        (address) => address[this.bipFormat as BipType]
      );
    }
  }

  private displayAddresses() {
    const start =
      Number(this.pagination.currentPage) * Number(this.pagination.pageSize);
    const end = start + Number(this.pagination.pageSize);

    this.addressesDisplay = this.addresses.slice(start, end);
  }

  onDeriveNextAddress() {
    this.deriveNextAddress.emit();
    this.goToLastPageAfterWalletUpdate = true;
  }

  onChangeBipFormat(bipFormat: BipType | 'all-bip-types') {
    this.bipFormat = bipFormat;
    this.bipFormatChange.emit(bipFormat);
    this.updateView();
  }

  get currentPageDisplay(): number {
    return Number(this.pagination.currentPage) + 1;
  }
  get totalPagesDisplay(): number {
    return Number(this.pagination.totalPages);
  }
  get pagePercent(): number {
    if (this.pagination.totalPages === 0n) return 0;
    return (
      ((Number(this.pagination.currentPage) + 1) /
        Number(this.pagination.totalPages)) *
      100
    );
  }
  get prevDisabled(): boolean {
    return this.pagination.currentPage === 0n;
  }
  get nextDisabled(): boolean {
    return this.pagination.currentPage >= this.pagination.totalPages - 1n;
  }

  updateTotalPages() {
    if (!this._wallet) return;
    const totalRecords = BigInt(this._wallet.addresses.length);
    this.pagination = {
      ...this.pagination,
      totalPages: ceilBigInt(totalRecords, BigInt(this.pagination.pageSize)),
    };
  }

  goToFirstPage() {
    this.pagination.currentPage = 0n;
    this.updateView();
  }
  goToPreviousPage() {
    if (this.pagination.currentPage > 0n) {
      this.pagination.currentPage--;
      this.updateView();
    }
  }
  goToNextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages - 1n) {
      this.pagination.currentPage++;
      this.updateView();
    }
  }
  goToLastPage() {
    this.pagination.currentPage = this.pagination.totalPages - 1n;
    this.updateView();
  }
  goToRandomPage() {
    const rand = BigInt(
      Math.floor(Math.random() * Number(this.pagination.totalPages))
    );
    this.pagination.currentPage = rand;
    this.updateView();
  }
  jumpToPage(pageInt: bigint) {
    try {
      let page = pageInt;
      if (page < 1n) page = 1n;
      if (page > this.pagination.totalPages) page = this.pagination.totalPages;
      this.pagination.currentPage = page - 1n;
      this.updateView();
    } catch {
      // ignore invalid input
    }
  }

  private updateAvailableBalance() {
    if (!this._wallet) {
      this.availableBalance = 0;
      return;
    }
    // Soma o saldo de todos os endereços (todas as BIP types)
    this.availableBalance = this._wallet.addresses
      .flatMap((addrObj) => Object.values(addrObj))
      .reduce((sum, addr) => sum + (addr.balance || 0), 0);
    // Revalida o valor se o campo já foi tocado
    if (this.sendAmountTouched) {
      this.onSendAmountBlur();
    }
  }

  onSendAddressBlur() {
    this.sendAddressFocused = false;
    this.sendAddressTouched = true;
    this.validateSendAddress();
  }

  onSendAddressChange() {
    this.validateSendAddress();
    this.updateTransactionPreview();
  }

  private validateSendAddress() {
    const addr = this.sendToAddress.trim();
    if (
      !(addr.startsWith('1') || addr.startsWith('3') || addr.startsWith('bc1'))
    ) {
      this.sendToAddressValid = false;
      this.sendToAddressErrorMsg = 'O endereço deve começar com 1, 3 ou bc1.';
      return;
    }
    if (!this.keyService.validateBitcoinAddress(addr)) {
      this.sendToAddressValid = false;
      this.sendToAddressErrorMsg =
        'O endereço está incompleto, mal formatado ou com checksum inválido.';
      return;
    }
    this.sendToAddressValid = true;
    this.sendToAddressErrorMsg = '';
  }

  onSendAddressFocus() {
    this.sendAddressFocused = true;
    this.sendToAddressErrorMsg = '';
  }

  onSendAmountBlur() {
    this.sendAmountFocused = false;
    this.sendAmountTouched = true;
    this.validateSendAmount();
  }

  onSendAmountChange() {
    this.validateSendAmount();
    this.updateTransactionPreview();
  }

  private validateSendAmount() {
    if (typeof this.sendAmount !== 'number' || this.sendAmount <= 0) {
      this.sendAmountValid = false;
      this.sendAmountErrorMsg = 'Informe um valor válido para enviar.';
      return;
    }

    if (this.utxoSelectionMode === 'auto') {
      if (this.sendAmount * 1e8 > this.availableBalance) {
        this.sendAmountValid = false;
        this.sendAmountErrorMsg = 'Saldo insuficiente para esta transação.';
        return;
      }
    } else {
      // Manual
      if (this.manuallySelectedUtxos.length === 0) {
        this.sendAmountValid = false;
        this.sendAmountErrorMsg = 'Selecione pelo menos um UTXO para gastar.';
        return;
      }
      if (this.sendAmount * 1e8 > this.manualSelectionTotal) {
        this.sendAmountValid = false;
        this.sendAmountErrorMsg =
          'O valor a ser enviado não pode exceder o total dos UTXOs selecionados.';
        return;
      }
    }

    this.sendAmountValid = true;
    this.sendAmountErrorMsg = '';
  }

  onSendAmountFocus() {
    this.sendAmountFocused = true;
    this.sendAmountErrorMsg = '';
  }

  onSendTransaction(event: Event) {
    event.preventDefault();
    this.sendError = '';
    this.sendSuccess = '';

    const amountSats = Math.round((this.sendAmount ?? 0) * 1e8);
    const fee = 0; // taxa fixa para exemplo

    let utxosToSpend: BitcoinUTXO[];
    let totalInput: number;

    if (this.utxoSelectionMode === 'auto') {
      const selection = this.selectUtxosFIFO(amountSats + fee);
      if (selection.total < amountSats + fee) {
        this.sendAmountValid = false;
        this.sendAmountErrorMsg =
          'Saldo insuficiente para cobrir valor + taxa.';
        return;
      }
      utxosToSpend = selection.utxos;
      totalInput = selection.total;
    } else {
      utxosToSpend = this.manuallySelectedUtxos;
      totalInput = this.manualSelectionTotal;
      if (totalInput < amountSats + fee) {
        this.sendAmountValid = false;
        this.sendAmountErrorMsg =
          'UTXOs selecionados insuficientes para cobrir valor + taxa.';
        return;
      }
    }

    this.selectedUtxos = utxosToSpend;
    this.changeAmount = totalInput - amountSats - fee;
    this.changeAddress = this.getNextChangeAddress();
    this.txOutputs = [{ address: this.sendToAddress, value: amountSats }];
    if (this.changeAmount > 0) {
      this.txOutputs.push({
        address: this.changeAddress,
        value: this.changeAmount,
      });
    }

    // Agora sim, cria a transação
    const tx = this.createTransaction();
    if (tx) {
      this.node.addTransaction(tx);
      this.sendSuccess = 'Transação enviada!';
      // Limpar campos, etc...
      this.sendToAddress = '';
      this.sendAmount = null;
      this.sendAmountTouched = false;
      this.sendAmountFocused = false;
      this.sendAddressTouched = false;
      this.sendAddressFocused = false;
      this.sendToAddressValid = null;
      this.sendToAddressErrorMsg = '';
      this.sendAmountValid = null;
      this.sendAmountErrorMsg = '';
      this.utxoSelectionMode = 'auto'; // Volta para o modo auto
      this.manuallySelectedUtxos = [];
      this.manualSelectionTotal = 0;
      this.updateView();
    }
  }

  // Cria uma transação realista, sem alterar saldos/utxos locais
  createTransaction(): Transaction | null {
    if (!this.sendAmountValid || !this.sendToAddressValid || !this.sendAmount)
      return null;
    if (!this.selectedUtxos.length) return null;
    // Monta inputs a partir dos UTXOs selecionados
    const inputs: TransactionInput[] = this.selectedUtxos.map((utxo) => ({
      txid: utxo.txId,
      vout: utxo.outputIndex,
      scriptSig: '', // será preenchido na assinatura real
      scriptPubKey: utxo.output?.scriptPubKey ?? '',
      value: utxo.output?.value ?? 0,
    }));
    // Monta outputs (destino + change)
    const outputs: TransactionOutput[] = this.txOutputs.map((o) => ({
      value: o.value,
      scriptPubKey: o.address, // ou gere o script a partir do endereço
    }));
    const timestamp = Date.now();
    // Cria a transação
    const tx: Transaction = {
      id: generateTransactionId(inputs, outputs, timestamp),
      inputs,
      outputs,
      signature: 'simulated', // ou assine de verdade depois
    };
    return tx;
  }

  // Seleção automática de UTXOs (FIFO), usando BitcoinUTXO
  selectUtxosFIFO(amount: number): {
    utxos: (BitcoinUTXO & { address: string; bipType: BipType })[];
    total: number;
  } {
    const utxos: (BitcoinUTXO & { address: string; bipType: BipType })[] =
      this.addresses.flatMap((addr) =>
        (addr.utxos || []).map((utxo: BitcoinUTXO) => ({
          ...utxo,
          address: addr.address, // extra para UI
          bipType: addr.bipFormat, // extra para UI
        }))
      );
    utxos.sort(
      (a, b) =>
        a.blockHeight - b.blockHeight ||
        a.txId.localeCompare(b.txId) ||
        a.outputIndex - b.outputIndex
    );
    let total = 0;
    const selected: (BitcoinUTXO & { address: string; bipType: BipType })[] =
      [];
    for (const utxo of utxos) {
      selected.push(utxo);
      total += utxo.output.value;
      if (total >= amount) break;
    }
    return { utxos: selected, total };
  }

  // Gera endereço de change automaticamente (próximo endereço não usado)
  getNextChangeAddress(): string {
    // Procura o primeiro endereço da carteira com saldo zero e sem UTXOs
    const unused = this.addresses.find(
      (addr) =>
        (addr.balance || 0) === 0 && (!addr.utxos || addr.utxos.length === 0)
    );
    return unused ? unused.address : this.addresses[0]?.address || '';
  }

  // Chamada ao enviar (modo simples): seleciona UTXOs, calcula troco, mostra confirmação
  prepareTransaction() {
    if (!this.sendAmountValid || !this.sendToAddressValid || !this.sendAmount)
      return;
    const amountSats = Math.round(this.sendAmount * 1e8);
    // Taxa fixa para exemplo (ex: 500 satoshis)
    const fee = 0;
    const { utxos, total } = this.selectUtxosFIFO(amountSats + fee);
    if (total < amountSats + fee) {
      this.sendAmountValid = false;
      this.sendAmountErrorMsg = 'Saldo insuficiente para cobrir valor + taxa.';
      return;
    }
    this.selectedUtxos = utxos;
    this.changeAmount = total - amountSats - fee;
    this.changeAddress = this.getNextChangeAddress();
    this.txOutputs = [{ address: this.sendToAddress, value: amountSats }];
    if (this.changeAmount > 0) {
      this.txOutputs.push({
        address: this.changeAddress,
        value: this.changeAmount,
      });
    }
    this.showTxConfirmation = true;
  }

  /**
   * Atualiza a lista de transações da carteira, buscando na main chain do node
   */
  private updateWalletTransactions() {
    if (!this._wallet) {
      this.transactions = [];
      this.transactionViews = [];
      return;
    }

    // Junta todas as transações dos endereços da wallet
    const txMap = new Map<string, TransactionHistory>();
    this._wallet.addresses
      .flatMap((addrObj) => Object.values(addrObj))
      .forEach((addr) => {
        addr.transactions?.forEach((tx) => {
          txMap.set(tx.tx.id, tx);
        });
      });

    const transactionsHistory = Array.from(txMap.values());

    // Monta os transactionViews como antes, mas usando apenas as transações relevantes
    const walletAddresses = new Set(
      this._wallet.addresses
        .flatMap((addrObj) => Object.values(addrObj))
        .map((addr) => addr.address)
    );
    const transactionViews: TransactionView[] = [];

    for (const history of transactionsHistory) {
      // Se quiser timestamp real, armazene junto ao processar blocos
      const timestamp = history.timestamp;
      const status = history.status || 'Confirmada';
      const details: TransactionDetail[] = [];

      history.tx.inputs.forEach((input) => {
        details.push({
          type: 'input',
          value: input.value,
          address: input.scriptPubKey,
          addressType: detectBipType(input.scriptPubKey),
          isWallet: walletAddresses.has(input.scriptPubKey),
          txId: input.txid,
          vout: input.vout,
        });
      });
      history.tx.outputs.forEach((output, idx) => {
        const isWallet = walletAddresses.has(output.scriptPubKey);
        let detailType: TransactionDetail['type'] = 'output';
        if (
          isWallet &&
          history.tx.inputs.some((i) => walletAddresses.has(i.scriptPubKey))
        ) {
          detailType = 'change';
        }
        details.push({
          type: detailType,
          value: output.value,
          address: output.scriptPubKey,
          addressType: detectBipType(output.scriptPubKey),
          isWallet,
          txId: history.tx.id,
          vout: idx,
        });
      });

      const hasInputFromWallet = history.tx.inputs.some((i) =>
        walletAddresses.has(i.scriptPubKey)
      );
      if (hasInputFromWallet) {
        const valueSent = history.tx.outputs
          .filter((o) => !walletAddresses.has(o.scriptPubKey))
          .reduce((sum, o) => sum + o.value, 0);
        const externalOutputs = history.tx.outputs.filter(
          (o) => !walletAddresses.has(o.scriptPubKey)
        );
        const address =
          externalOutputs.length > 0 ? externalOutputs[0].scriptPubKey : '—';
        transactionViews.push({
          id: history.tx.id,
          type: 'Enviada',
          value: valueSent,
          address,
          bipType: detectBipType(address),
          timestamp,
          status,
          details,
        });
      }
      if (!hasInputFromWallet) {
        const outputsToWallet = history.tx.outputs.filter((o) =>
          walletAddresses.has(o.scriptPubKey)
        );
        outputsToWallet.forEach((o) => {
          transactionViews.push({
            id: history.tx.id,
            type: history.tx.inputs.length === 0 ? 'Coinbase' : 'Recebida',
            value: o.value,
            address: o.scriptPubKey,
            bipType: detectBipType(o.scriptPubKey),
            timestamp,
            status,
            details,
          });
        });
      }
    }

    this.transactions = transactionsHistory.map((h) => h.tx);
    this.transactionViews = transactionViews.sort(
      (a, b) => b.timestamp - a.timestamp
    );
    this.updateTransactionTotalPages();
    this.updateTransactionViews();
  }

  get walletAddressesList(): string[] {
    return this.addresses ? this.addresses.map((a) => a.address) : [];
  }

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
      totalPages: ceilBigInt(
        totalRecords,
        BigInt(this.transactionPagination.pageSize)
      ),
    };
  }

  setActiveTab(tab: 'enderecos' | 'transacoes' | 'enviar') {
    this.activeTab = tab;
    // Salva a aba ativa nos query params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { walletTab: tab },
      queryParamsHandling: 'merge',
    });
  }

  trackByAddress(index: number, item: { address: string }): string {
    return item.address;
  }

  private updateTransactionPreview() {
    if (
      !this.sendToAddressValid ||
      !this.sendAmountValid ||
      !this.sendAmount ||
      !this.sendToAddress
    ) {
      this.showTransactionPreview = false;
      return;
    }

    const amountSats = Math.round(this.sendAmount * 1e8);
    const fee = 0; // taxa fixa para exemplo

    let utxos: (BitcoinUTXO & { address: string; bipType: BipType })[];
    let total: number;

    if (this.utxoSelectionMode === 'auto') {
      const selection = this.selectUtxosFIFO(amountSats + fee);
      if (selection.total < amountSats + fee) {
        this.showTransactionPreview = false;
        return;
      }
      utxos = selection.utxos;
      total = selection.total;
    } else {
      // Manual
      if (this.manuallySelectedUtxos.length === 0) {
        this.showTransactionPreview = false;
        return;
      }
      utxos = this.manuallySelectedUtxos;
      total = this.manualSelectionTotal;
      if (total < amountSats + fee) {
        this.showTransactionPreview = false;
        return;
      }
    }

    // Configura inputs do preview
    this.previewInputs = utxos.map((utxo) => ({
      address: utxo.address,
      value: utxo.output.value,
      bipType: utxo.bipType,
      height: utxo.blockHeight,
      txId: utxo.txId,
      vout: utxo.outputIndex,
    }));

    // Configura outputs do preview
    this.previewOutputs = [
      {
        address: this.sendToAddress,
        value: amountSats,
        type: 'destination',
        bipType: detectBipType(this.sendToAddress),
      },
    ];

    // Adiciona output de change se necessário
    const changeAmount = total - amountSats - fee;
    if (changeAmount > 0) {
      const changeAddress = this.getNextChangeAddress();
      this.previewOutputs.push({
        address: changeAddress,
        value: changeAmount,
        type: 'change',
        bipType: detectBipType(changeAddress),
      });
    }

    this.previewFee = fee;
    this.previewTotalInput = total;
    this.previewTotalOutput =
      amountSats + (changeAmount > 0 ? changeAmount : 0);
    this.showTransactionPreview = true;
    this.updateSignatureState();
  }

  private prepareAllUtxosForManualSelection() {
    if (!this._wallet) {
      this.allAvailableUtxos = [];
      return;
    }

    // Preserva a seleção manual existente
    const currentSelection = new Map<string, boolean>();
    this.allAvailableUtxos.forEach((utxo) => {
      const key = `${utxo.txId}-${utxo.outputIndex}`;
      currentSelection.set(key, utxo.selected);
    });

    this.allAvailableUtxos = this.addresses
      .flatMap((addr) =>
        (addr.utxos || []).map((utxo) => {
          const key = `${utxo.txId}-${utxo.outputIndex}`;
          return {
            ...utxo,
            address: addr.address,
            bipType: addr.bipFormat,
            selected: currentSelection.get(key) || false, // Preserva seleção anterior
          };
        })
      )
      .sort((a, b) => b.output.value - a.output.value); // Ordena por valor
  }

  setUtxoSelectionMode(mode: 'auto' | 'manual') {
    if (this.utxoSelectionMode === mode) return;

    this.utxoSelectionMode = mode;
    // Reseta a seleção manual ao trocar de modo
    this.allAvailableUtxos.forEach((u) => (u.selected = false));
    this.manuallySelectedUtxos = [];
    this.manualSelectionTotal = 0;

    // Revalida e atualiza o preview
    this.validateSendAmount();
    this.updateTransactionPreview();
  }

  onManualUtxoSelectionChange() {
    this.manuallySelectedUtxos = this.allAvailableUtxos.filter(
      (u) => u.selected
    );
    this.manualSelectionTotal = this.manuallySelectedUtxos.reduce(
      (sum, u) => sum + u.output.value,
      0
    );

    // Revalida e atualiza o preview com base na nova seleção
    this.validateSendAmount();
    this.updateTransactionPreview();
  }

  trackByUtxo(
    index: number,
    item: BitcoinUTXO & { selected: boolean }
  ): string {
    return item.txId + item.outputIndex;
  }

  setSignatureMode(mode: 'auto' | 'manual') {
    if (this.signatureMode === mode) return;
    this.signatureMode = mode;
    this.updateSignatureState();
  }

  updateSignatureState() {
    if (this.signatureMode === 'auto') {
      this.signedInputs = this.previewInputs.map(() => true);
      this.inputSignatureScripts = this.previewInputs.map(
        (input) => `SIG(${input.address})`
      );
      this.inputSignatureErrors = this.previewInputs.map(() => null);
    } else {
      this.signedInputs = this.previewInputs.map(() => false);
      this.inputSignatureScripts = this.previewInputs.map(() => null);
      this.inputSignatureErrors = this.previewInputs.map(() => null);
    }
  }

  signInputManually(index: number) {
    if (this.signatureMode === 'manual') {
      this.signedInputs[index] = true;
    }
  }

  get allInputsSigned(): boolean {
    return this.signedInputs.every((s) => s);
  }

  // Retorna todas as chaves privadas disponíveis na carteira
  get availablePrivateKeys(): { address: string; privateKey: string }[] {
    if (!this._wallet) return [];
    return this._wallet.addresses
      .flatMap((addrObj) => Object.values(addrObj))
      .map((addr) => ({
        address: addr.address,
        privateKey: addr.keys.priv.hex,
      }));
  }

  // Tenta assinar um input manualmente com uma chave privada
  trySignInputWithKey(inputIndex: number, privateKey: string) {
    const input = this.previewInputs[inputIndex];
    // Procura o endereço correspondente à chave
    const keyEntry = this.availablePrivateKeys.find(
      (k) => k.privateKey === privateKey
    );
    if (!keyEntry) {
      this.inputSignatureErrors[inputIndex] =
        'Chave não encontrada na carteira.';
      return;
    }
    if (keyEntry.address !== input.address) {
      this.inputSignatureErrors[inputIndex] =
        'Chave não corresponde ao endereço deste input!';
      return;
    }
    // Simula um script de assinatura didático
    this.inputSignatureScripts[inputIndex] = `SIG(${keyEntry.address})`;
    this.inputSignatureErrors[inputIndex] = null;
    this.signedInputs[inputIndex] = true;
  }
}

function detectBipType(address: string): BipType | undefined {
  if (address.startsWith('1')) return 'bip44';
  if (address.startsWith('3')) return 'bip49';
  if (address.startsWith('bc1')) return 'bip84';
  return undefined;
}
