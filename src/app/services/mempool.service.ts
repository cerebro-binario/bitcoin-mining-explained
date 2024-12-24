import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MempoolService {
  private transactionsSubject = new BehaviorSubject<any[]>([]);
  transactions$ = this.transactionsSubject.asObservable();

  generateRandomTransaction() {
    const numInputs = this.getWeightedRandomInput();

    const numOutputs = this.getRandomInt(1, 3);

    const inputs = Array.from({ length: numInputs }, () => ({
      address: this.generateRandomAddress(),
      amount: this.getRandomAmount(),
    }));

    let totalAmount = inputs.reduce((sum, input) => sum + input.amount, 0);
    const btcVolume = parseFloat(totalAmount.toFixed(8));

    const outputs = Array.from({ length: numOutputs }, (_, i): any => {
      const output = {
        address: this.generateRandomAddress(),
        amount:
          i === numOutputs - 1
            ? parseFloat(totalAmount.toFixed(8))
            : this.getRandomAmount(totalAmount),
      };

      totalAmount -= output.amount;

      return output;
    });

    const timestamp = new Date();

    const feePercentage = this.getRandomInt(1, 10) / 100;
    const fees = parseFloat((btcVolume * feePercentage).toFixed(8));

    return { inputs, outputs, btcVolume, timestamp, fees };
  }

  addTransaction(transaction: any) {
    const transactions = this.transactionsSubject.value;
    this.transactionsSubject.next([...transactions, transaction]);
  }

  private generateRandomAddress(): string {
    const addressTypes = ['1', '3', 'bc1']; // Legacy, P2SH, Bech32
    const type = addressTypes[Math.floor(Math.random() * addressTypes.length)];

    if (type === 'bc1') {
      // Bech32 address: "bc1" + alfanumérico de 39 a 59 caracteres
      return (
        type + this.getRandomString(39, 'abcdefghijklmnopqrstuvwxyz0123456789')
      );
    } else {
      // Legacy (P2PKH) ou P2SH: alfanumérico de 25 a 34 caracteres
      return (
        type +
        this.getRandomString(
          this.getRandomInt(25, 34),
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        )
      );
    }
  }

  private getRandomString(length: number, characters: string): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  private getRandomAmount(max = 10): number {
    return parseFloat((Math.random() * max).toFixed(8));
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getWeightedRandomInput(): number {
    const weights = [70, 20, 10];
    const cumulativeWeights = weights.map(
      (
        (sum) => (value) =>
          (sum += value)
      )(0)
    );
    const random =
      Math.random() * cumulativeWeights[cumulativeWeights.length - 1];

    return cumulativeWeights.findIndex((weight) => random < weight) + 1;
  }
}
