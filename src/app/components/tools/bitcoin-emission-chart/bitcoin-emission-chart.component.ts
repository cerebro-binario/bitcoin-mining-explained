import { Component, OnInit } from '@angular/core';
import Chart from 'chart.js/auto';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FormatNumberPipe } from '../../../pipes/format-number.pipe';

@Component({
  selector: 'app-bitcoin-emission-chart',
  imports: [CardModule, ButtonModule, FormatNumberPipe],
  templateUrl: './bitcoin-emission-chart.component.html',
  styleUrl: './bitcoin-emission-chart.component.scss',
})
export class BitcoinEmissionChartComponent implements OnInit {
  private formatNumberPipe = new FormatNumberPipe();

  emissionChart: any;
  blocksMined = 0;
  totalBTC = 0;
  halvingInterval = 210000;
  pointsPerHalving = 10;
  blocksPerPoint = this.halvingInterval / this.pointsPerHalving;

  // Informações exibidas na UI
  currentHalving = 0;
  nextHalvingBlock = this.halvingInterval;
  currentSubsidy = 50; // Primeira recompensa em BTC

  // Arrays para os halvings e recompensas
  halvingBlocks: number[] = [];
  subsidies: bigint[] = [];

  ngOnInit() {
    this.initializeHalvings();
    this.initializeCharts();
  }

  initializeHalvings() {
    let subsidy = 50n * 100_000_000n;
    let block = 0;

    let c = 0;

    while (Number(subsidy) / 100_000_000 > 0.0) {
      this.halvingBlocks.push(block);
      this.subsidies.push(subsidy);
      subsidy >>= 1n; // Halving (reduz recompensa pela metade)
      block += this.halvingInterval;
    }

    this.subsidies.push(subsidy);
    this.halvingBlocks.push(block);
  }

  initializeCharts() {
    const ctxEmission = document.getElementById(
      'emissionChart'
    ) as HTMLCanvasElement;

    this.emissionChart = new Chart(ctxEmission, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'BTC emitidos por bloco',
            data: [],
            borderColor: 'orange',
            backgroundColor: 'rgba(255, 165, 0, 0.2)', // Laranja transparente
            fill: true,
            borderWidth: 2, // Deixa a linha mais fina
            pointRadius: 3, // Pequenos pontos para indicar os valores
            tension: 0, // Mantém a linha reta
            yAxisID: 'y1', // Associa ao primeiro eixo Y
          },
          {
            label: 'BTC Total Acumulado',
            data: [],
            borderColor: 'green',
            backgroundColor: 'rgba(0, 128, 0, 0.2)', // Verde transparente
            fill: true,
            borderWidth: 2, // Deixa a linha mais fina
            pointRadius: 3, // Pequenos pontos para indicar os valores
            tension: 0, // Mantém a linha reta
            yAxisID: 'y2', // Associa ao segundo eixo Y
          },
        ],
      },
      options: {
        elements: {
          line: {
            tension: 1, // Garante que a linha seja totalmente reta
            borderWidth: 2, // Ajusta a espessura da linha
          },
        },
        scales: {
          y1: {
            type: 'logarithmic',
            position: 'left',
            min: 0,
            title: {
              display: true,
              text: 'BTC emitidos por bloco',
            },
            grid: {
              drawOnChartArea: false, // Evita sobreposição de grades
            },
          },
          y2: {
            type: 'linear', // Pode ser log também, dependendo da necessidade
            position: 'right',
            title: {
              display: true,
              text: 'BTC Total Acumulado',
            },
            grid: {
              drawOnChartArea: false, // Evita sobreposição de grades
            },
          },
        },
      },
    });

    this.updateState();
  }

  nextHalving() {
    if (this.currentHalving >= this.halvingBlocks.length - 1) return;

    this.currentHalving++;
    this.updateState();
  }

  previousHalving() {
    if (this.currentHalving <= 0) return;

    this.currentHalving--;
    this.updateState(true);
  }

  resetSimulation() {
    this.emissionChart.data.labels = [];
    this.emissionChart.data.datasets[0].data = [];
    this.emissionChart.data.datasets[1].data = [];

    this.currentHalving = 0;
    this.updateState();
  }

  updateState(backward: boolean = false) {
    this.blocksMined = this.halvingBlocks[this.currentHalving];
    this.nextHalvingBlock =
      this.halvingBlocks[this.currentHalving + 1] || this.blocksMined;
    this.currentSubsidy =
      Number(this.subsidies[this.currentHalving]) / 100_000_000;
    this.totalBTC = this.calculateTotalBTC(this.currentHalving);

    this.updateCharts(backward);
  }

  calculateTotalBTC(halvingIndex: number): number {
    let total = 0;
    for (let i = 0; i <= halvingIndex; i++) {
      const subsidy = this.subsidies[i];
      const startBlock = this.halvingBlocks[i];
      const endBlock =
        this.halvingBlocks[i + 1] || startBlock + this.halvingInterval;
      total += (Number(subsidy) / 100_000_000) * (endBlock - startBlock);
    }
    return total;
  }

  updateCharts(backward: boolean = false) {
    if (backward) {
      const toDelete = this.pointsPerHalving + 1;

      this.emissionChart.data.labels = this.emissionChart.data.labels.slice(
        0,
        -toDelete
      );

      this.emissionChart.data.datasets[0].data =
        this.emissionChart.data.datasets[0].data.slice(0, -toDelete);

      this.emissionChart.data.datasets[1].data =
        this.emissionChart.data.datasets[1].data.slice(0, -toDelete);

      this.emissionChart.update();
      return;
    }

    let block = this.halvingBlocks[this.currentHalving];
    const subsidy = Number(this.subsidies[this.currentHalving]) / 100_000_000;

    // Inserir primeiro bloco do halving
    this.emissionChart.data.labels.push(
      `Bloco ${this.formatNumberPipe.transform(block)}`
    );
    this.emissionChart.data.datasets[0].data.push(subsidy);

    this.emissionChart.data.datasets[1].data.push(
      this.calculateTotalBTCUpToBlock(block + 1)
    );

    for (let i = 0; i < this.pointsPerHalving; i++) {
      block += this.blocksPerPoint;
      this.emissionChart.data.labels.push(
        `Bloco ${this.formatNumberPipe.transform(block - 1)}`
      );
      this.emissionChart.data.datasets[0].data.push(subsidy);

      this.emissionChart.data.datasets[1].data.push(
        this.calculateTotalBTCUpToBlock(block)
      );
    }

    this.emissionChart.update();
  }

  calculateTotalBTCUpToBlock(block: number): number {
    let total = 0;
    for (let i = 0; i < this.halvingBlocks.length; i++) {
      if (this.halvingBlocks[i] >= block) break;

      const subsidy = this.subsidies[i];
      const startBlock = this.halvingBlocks[i];
      const endBlock = this.halvingBlocks[i + 1] || block;

      total +=
        (Number(subsidy) / 100_000_000) *
        (Math.min(block, endBlock) - startBlock);
    }
    return total;
  }
}
