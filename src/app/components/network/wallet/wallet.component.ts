import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import {
  Transaction,
  TransactionInput,
  TransactionOutput,
  generateTransactionId,
} from '../../../models/block.model';
import {
  BipType,
  BitcoinAddressData,
  Wallet,
  BitcoinUTXO,
} from '../../../models/wallet.model';
import { KeyService } from '../../../services/key.service';
import { AddressListComponent } from './address-list/address-list.component';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { Node } from '../../../models/node';

export interface TransactionView {
  id: string;
  type: 'Recebida' | 'Enviada' | 'Coinbase';
  value: number; // em satoshis
  address: string;
  addressType?: BipType;
  timestamp: number;
  status: string;
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
  ],
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  private _wallet: Wallet | null = null;
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
  @Output() deriveNextAddress = new EventEmitter<void>();

  addresses: BitcoinAddressData[] = [];
  addressesDisplay: BitcoinAddressData[] = [];
  addressType: BipType | 'all-bip-types' = 'bip84';
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

  selectedUtxos: BitcoinUTXO[] = [];
  changeAddress: string = '';
  changeAmount: number = 0;
  showTxConfirmation = false;
  txOutputs: { address: string; value: number }[] = [];

  transactionViews: TransactionView[] = [];

  get sendButtonDisabled(): boolean {
    return (
      !this.sendToAddressValid ||
      !this.sendAmountValid ||
      !this.sendAmount ||
      this.sendAmount <= 0
    );
  }

  constructor(private keyService: KeyService) {}

  private updateView() {
    this.updateAddresses();
    this.updateTotalPages();
    this.displayAddresses();
    this.updateAvailableBalance();
    this.updateWalletTransactions();
  }

  private updateAddresses() {
    if (!this._wallet) return;
    this.addresses = [];

    if (this.addressType === 'all-bip-types') {
      this.addresses = this._wallet.addresses.reduce((acc, address) => {
        return [...acc, ...Object.values(address)];
      }, [] as BitcoinAddressData[]);
    } else {
      this.addresses = this._wallet.addresses.map(
        (address) => address[this.addressType as BipType]
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

  onChangeAddressType(type: BipType | 'all-bip-types') {
    this.addressType = type;
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
    this.pagination.totalPages = BigInt(
      Math.ceil(this._wallet.addresses.length / this.pagination.pageSize)
    );
    this.pagination.currentPage = 0n;
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
  jumpToPage() {
    try {
      let page = BigInt(this.jumpPageInput);
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
  }

  private validateSendAmount() {
    if (typeof this.sendAmount !== 'number' || this.sendAmount <= 0) {
      this.sendAmountValid = false;
      this.sendAmountErrorMsg = 'Informe um valor válido.';
      return;
    }
    if (this.sendAmount * 1e8 > this.availableBalance) {
      this.sendAmountValid = false;
      this.sendAmountErrorMsg = 'Saldo insuficiente para esta transação.';
      return;
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

    // Seleção automática de UTXOs (modo simples)
    const amountSats = Math.round((this.sendAmount ?? 0) * 1e8);
    const fee = 0; // taxa fixa para exemplo
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
  selectUtxosFIFO(amount: number): { utxos: BitcoinUTXO[]; total: number } {
    const utxos: BitcoinUTXO[] = this.addresses.flatMap((addr) =>
      (addr.utxos || []).map((utxo: BitcoinUTXO) => ({
        ...utxo,
        address: addr.address, // extra para UI
        bipType: addr.addressType, // extra para UI
      }))
    );
    utxos.sort(
      (a, b) =>
        a.blockHeight - b.blockHeight ||
        a.txId.localeCompare(b.txId) ||
        a.outputIndex - b.outputIndex
    );
    let total = 0;
    const selected: BitcoinUTXO[] = [];
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
    if (!this._wallet || !this.node) {
      this.transactions = [];
      this.transactionViews = [];
      return;
    }
    const walletAddresses = new Set(
      this._wallet.addresses
        .flatMap((addrObj) => Object.values(addrObj))
        .map((addr) => addr.address)
    );
    const transactions: Transaction[] = [];
    const transactionViews: TransactionView[] = [];
    let blockNode = this.node.genesis;
    while (blockNode) {
      const block = blockNode.block;
      for (const tx of block.transactions) {
        const involved =
          tx.inputs.some((input) => walletAddresses.has(input.scriptPubKey)) ||
          tx.outputs.some((output) => walletAddresses.has(output.scriptPubKey));
        if (involved) {
          transactions.push(tx);
          const timestamp = block.timestamp;
          const status = 'Confirmada';
          // 1. Linha "Enviada" se houver input da wallet
          const hasInputFromWallet = tx.inputs.some((i) =>
            walletAddresses.has(i.scriptPubKey)
          );
          if (hasInputFromWallet) {
            // Valor gasto: soma dos inputs da wallet
            const valueSent = tx.inputs
              .filter((i) => walletAddresses.has(i.scriptPubKey))
              .reduce((sum, i) => sum + i.value, 0);
            // Endereços de destino externos (ou '—' se todos outputs são da wallet)
            const externalOutputs = tx.outputs.filter(
              (o) => !walletAddresses.has(o.scriptPubKey)
            );
            const address =
              externalOutputs.length > 0
                ? externalOutputs[0].scriptPubKey
                : '—';
            transactionViews.push({
              id: tx.id,
              type: 'Enviada',
              value: valueSent,
              address,
              addressType: detectBipType(address),
              timestamp,
              status,
            });
          }
          // 2. Uma linha "Recebida" para cada output da wallet
          tx.outputs.forEach((o) => {
            if (walletAddresses.has(o.scriptPubKey)) {
              transactionViews.push({
                id: tx.id,
                type: tx.inputs.length === 0 ? 'Coinbase' : 'Recebida',
                value: o.value,
                address: o.scriptPubKey,
                addressType: detectBipType(o.scriptPubKey),
                timestamp,
                status,
              });
            }
          });
        }
      }
      blockNode = blockNode.children[0];
    }
    this.transactions = transactions;
    this.transactionViews = transactionViews;
  }

  get walletAddressesList(): string[] {
    return this.addresses ? this.addresses.map((a) => a.address) : [];
  }
}

function detectBipType(address: string): BipType | undefined {
  if (address.startsWith('1')) return 'bip44';
  if (address.startsWith('3')) return 'bip49';
  if (address.startsWith('bc1')) return 'bip84';
  return undefined;
}
