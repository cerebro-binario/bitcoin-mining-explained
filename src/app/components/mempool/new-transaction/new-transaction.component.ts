import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MempoolService } from '../../../services/mempool.service';
import { TransactionIoComponent } from '../transaction-io/transaction-io.component';

@Component({
  selector: 'app-new-transaction',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    TransactionIoComponent,
  ],
  templateUrl: './new-transaction.component.html',
  styleUrl: './new-transaction.component.scss',
})
export class NewTransactionComponent implements OnInit {
  transactionForm: FormGroup;
  transactionData: any; // Dados gerados para exibição
  isEditing = false; // Flag para alternar entre exibição e edição

  constructor(
    private fb: FormBuilder,
    private transactionService: MempoolService
  ) {
    this.transactionForm = this.fb.group({
      inputs: this.fb.array([]),
      outputs: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.generateRandomTransaction();
  }

  get inputs() {
    return this.transactionForm.get('inputs') as FormArray;
  }

  get outputs() {
    return this.transactionForm.get('outputs') as FormArray;
  }

  generateRandomTransaction() {
    this.transactionData = this.transactionService.generateRandomTransaction();
    this.populateForm(this.transactionData); // Preenche o formulário, mas não mostra por padrão
  }

  private populateForm(transaction: any) {
    transaction.inputs.forEach((input: any) =>
      this.inputs.push(
        this.fb.group({ address: [input.address], amount: [input.amount] })
      )
    );
    transaction.outputs.forEach((output: any) =>
      this.outputs.push(
        this.fb.group({ address: [output.address], amount: [output.amount] })
      )
    );
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      // Atualiza os dados exibidos com base no formulário ao salvar
      this.transactionData = this.transactionForm.value;
    }
  }

  submitTransaction() {
    if (this.transactionForm.valid) {
      this.transactionService.addTransaction(this.transactionForm.value);
    }
  }
}
