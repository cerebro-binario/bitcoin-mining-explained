import { Component, Input } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-transaction-io',
  imports: [ButtonModule, Toast, TooltipModule],
  templateUrl: './transaction-io.component.html',
  styleUrl: './transaction-io.component.scss',
  providers: [MessageService],
})
export class TransactionIoComponent {
  @Input() item: any;
  @Input() index: number = 0;

  constructor(private messageService: MessageService) {}

  copyToClipboard(address: string): void {
    navigator.clipboard.writeText(address).then(
      () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Endereço copiado',
          life: 3000,
        });
      },
      (err) => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy the address.');
      }
    );
  }
}
