import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { clamp, hexToDecimal, shortenValue } from '../../../../utils/tools';

@Component({
  selector: 'app-hash-target-bar',
  imports: [CommonModule, FormsModule, MessageModule, TableModule],
  templateUrl: './hash-target-bar.component.html',
  styleUrl: './hash-target-bar.component.scss',
})
export class HashTargetBarComponent {
  private _hash: string = '';
  private _hashDecimal: string = '';
  private _targetHash: string = '';
  private _targetHashDecimal: string = '';

  @Input()
  set hash(value: string) {
    if (value !== this._hash) {
      this._hash = value;
      this._hashDecimal = hexToDecimal(value).padStart(78, '0');
      this.updateHashPosition();
    }
  }
  get hash(): string {
    return this._hash;
  }

  get hashDecimal(): string {
    return this._hashDecimal;
  }

  @Output() onTargetChange = new EventEmitter<string>();

  @ViewChild('bar') bar!: ElementRef<HTMLDivElement>;

  private maxHashValue = BigInt(
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  );
  private minBarPosition = 0;
  private maxBarPosition = 99.9;

  set targetHash(value: string) {
    if (this._targetHash !== value) {
      this._targetHash = value;
      this._targetHashDecimal = hexToDecimal(value).padStart(78, '0');
      this.onTargetChange.emit(value);
    }
  }

  get targetHash(): string {
    return this._targetHash;
  }

  get targetHashDecimal(): string {
    return this._targetHashDecimal;
  }

  // Posições das linhas (em porcentagem)
  targetPosition: number = this.maxBarPosition;
  hashPosition: number = -1; // fora da tela por enquanto

  draggingTarget = false;

  isHashBelowTarget: boolean = false;

  ngOnInit() {
    this.targetHash = (this.maxHashValue / BigInt(2)).toString(16);
    this.targetPosition = this.calculatePosition(this.targetHash);
  }

  // Inicia o arraste do target
  startDraggingTarget(): void {
    this.draggingTarget = true;
  }

  // Atualiza a posição do target durante o arraste
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.updateTarget(event);
  }

  // Finaliza o arraste do target
  @HostListener('document:mouseup', ['$event'])
  stopDraggingTarget(event: MouseEvent): void {
    this.updateTarget(event);
    this.draggingTarget = false;
  }

  shortenValue(value: string, size: number) {
    return shortenValue(value, size);
  }

  private updateTarget(event: MouseEvent) {
    if (this.draggingTarget) {
      const barRect = this.bar.nativeElement.getBoundingClientRect();
      const relativeX = barRect.right - event.clientX;

      // Calcula a nova posição em porcentagem
      const newTargetPosition = (relativeX / barRect.width) * 100;

      this.targetPosition = clamp(
        newTargetPosition,
        this.minBarPosition,
        this.maxBarPosition
      );

      // Atualiza o target com base na nova posição
      this.targetHash = this.calculateHash(this.targetPosition);
      this.checkTarget();
    }
  }

  // Atualiza o hash e a posição
  private updateHashPosition(): void {
    this.hashPosition = this.calculatePosition(this.hash);
    this.checkTarget();
  }

  // Função para calcular o target com base em uma escala logarítmica/exponencial
  private calculateHash(position: number): string {
    const exponent = (100 - position) / 100; // Escala inversa de 0 a 1
    const scaledValue = Math.max(Math.round(Math.pow(2, 256 * exponent)), 1);
    const scaledValueBigInt = BigInt(scaledValue) - BigInt(1);

    return scaledValueBigInt.toString(16).padStart(64, '0'); // Target ajustado com zeros perceptíveis
  }

  private calculatePosition(hash: string): number {
    if (!hash) {
      return -1;
    }

    const hashValue = BigInt(`0x${hash}`);

    // Calcula a posição como a relação logarítmica do hash em relação ao valor máximo
    const normalizedLog =
      Math.log(Number(this.maxHashValue) / Number(hashValue)) / Math.log(2);
    const position = (normalizedLog / 256) * 100; // Escala proporcional para 0-100%

    // Garante que a posição fique no intervalo [0, 100]
    return Math.max(0, Math.min(100, position));
  }

  private checkTarget() {
    if (!this._hash || !this._targetHash) {
      this.isHashBelowTarget = false;
      return;
    }

    const hashValue = BigInt(`0x${this.hash}`);
    const targetValue = BigInt(`0x${this.targetHash}`);
    this.isHashBelowTarget = hashValue < targetValue;
  }
}
