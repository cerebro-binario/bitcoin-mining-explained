import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-brute-force-impossibility',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ProgressBarModule,
    TooltipModule,
  ],
  templateUrl: './brute-force-impossibility.component.html',
  styleUrls: ['./brute-force-impossibility.component.scss'],
})
export class BruteForceImpossibilityComponent implements OnInit, OnDestroy {
  // Configurações de simulação
  hashesPerSecondInput = '1000000000000'; // 1 TH/s como string
  targetPrivateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  currentAttempt = BigInt(0);
  maxAttempts = BigInt(
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  ); // 2^256 - 1

  // Estados da simulação
  isRunning = false;
  elapsedTime = 0;
  progress = 0;
  private intervalId: any;

  // Cálculo de tempo para quebrar
  timeToBreak: {
    seconds: bigint;
    years: string;
    description: string;
  } = {
    seconds: BigInt(0),
    years: '0',
    description: 'Calculando...',
  };

  // Comparações visuais
  comparisons = [
    {
      name: 'Átomos no Universo',
      value: 1e80,
      description: 'Estimativa de átomos no universo observável',
      currentValue: 0,
    },
    {
      name: 'Segundos desde o Big Bang',
      value: 4.35e17,
      description: 'Aproximadamente 13.8 bilhões de anos',
      currentValue: 0,
    },
    {
      name: 'Estrelas na Via Láctea',
      value: 1e11,
      description: 'Estimativa de estrelas em nossa galáxia',
      currentValue: 0,
    },
    {
      name: 'Células no Corpo Humano',
      value: 3.7e13,
      description: 'Aproximadamente 37 trilhões de células',
      currentValue: 0,
    },
  ];

  ngOnInit() {
    this.updateComparisons();
  }

  ngOnDestroy() {
    this.stopSimulation();
  }

  // Watcher para mudanças no input
  onHashesPerSecondChange() {
    if (!this.isRunning) {
      this.updateComparisons();
    }
  }

  get hashesPerSecond(): bigint {
    try {
      // Tentar converter notação científica primeiro
      if (
        this.hashesPerSecondInput.includes('e') ||
        this.hashesPerSecondInput.includes('E')
      ) {
        const num = Number(this.hashesPerSecondInput);
        if (!isNaN(num) && isFinite(num)) {
          return BigInt(Math.floor(num));
        }
      }
      return BigInt(this.hashesPerSecondInput);
    } catch {
      return BigInt(1000000000000); // fallback para 1 TH/s
    }
  }

  get hashesPerSecondNumber(): number {
    try {
      const value = this.hashesPerSecond;
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number.MAX_SAFE_INTEGER;
      }
      return Number(value);
    } catch {
      return 1000000000000; // fallback para 1 TH/s
    }
  }

  startSimulation() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.elapsedTime = 0;
    this.currentAttempt = BigInt(0);

    this.intervalId = setInterval(() => {
      this.elapsedTime++;
      this.currentAttempt += this.hashesPerSecond;

      // Calcular progresso usando BigInt para precisão
      try {
        const progressBigInt =
          (this.currentAttempt * BigInt(100)) / this.maxAttempts;
        this.progress = Number(progressBigInt);
      } catch (error) {
        // Se houver overflow, manter progresso em 0
        this.progress = 0;
      }

      // Atualizar comparações
      this.updateComparisons();

      // A simulação nunca deve parar automaticamente
      // O usuário deve parar manualmente quando quiser
    }, 1000); // Atualizar a cada segundo
  }

  stopSimulation() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resetSimulation() {
    this.stopSimulation();
    this.elapsedTime = 0;
    this.currentAttempt = BigInt(0);
    this.progress = 0;
    this.updateComparisons();
  }

  updateComparisons() {
    // Atualizar comparações baseadas no tempo atual
    this.comparisons.forEach((comp) => {
      comp.currentValue = this.elapsedTime * this.hashesPerSecondNumber;
    });

    // Calcular tempo para quebrar
    this.calculateTimeToBreak();
  }

  calculateTimeToBreak() {
    try {
      // Tempo = Total de possibilidades / Velocidade de hash
      const totalPossibilities = this.maxAttempts;
      const hashesPerSecond = this.hashesPerSecond;

      if (hashesPerSecond === BigInt(0)) {
        this.timeToBreak = {
          seconds: BigInt(0),
          years: '∞',
          description: 'Velocidade de hash muito baixa',
        };
        return;
      }

      const secondsNeeded = totalPossibilities / hashesPerSecond;
      this.timeToBreak.seconds = secondsNeeded;

      // Converter para anos
      const secondsPerYear = BigInt(365 * 24 * 60 * 60); // 31.536.000 segundos por ano
      const yearsNeeded = secondsNeeded / secondsPerYear;

      // Formatar o resultado
      if (yearsNeeded > BigInt(Number.MAX_SAFE_INTEGER)) {
        this.timeToBreak.years = 'Número muito grande';
        this.timeToBreak.description = 'Tempo maior que a idade do universo';
      } else {
        const yearsNumber = Number(yearsNeeded);
        this.timeToBreak.years = this.formatTimeToBreak(yearsNumber);
        this.timeToBreak.description = this.getTimeDescription(yearsNumber);
      }
    } catch (error) {
      this.timeToBreak = {
        seconds: BigInt(0),
        years: 'Erro no cálculo',
        description: 'Não foi possível calcular',
      };
    }
  }

  formatTimeToBreak(years: number): string {
    if (years >= 1e12) {
      return (years / 1e12).toFixed(2) + ' trilhões de anos';
    } else if (years >= 1e9) {
      return (years / 1e9).toFixed(2) + ' bilhões de anos';
    } else if (years >= 1e6) {
      return (years / 1e6).toFixed(2) + ' milhões de anos';
    } else if (years >= 1e3) {
      return (years / 1e3).toFixed(2) + ' mil anos';
    } else if (years >= 1) {
      return years.toFixed(2) + ' anos';
    } else {
      const months = years * 12;
      if (months >= 1) {
        return months.toFixed(0) + ' meses';
      } else {
        const days = years * 365;
        if (days >= 1) {
          return days.toFixed(0) + ' dias';
        } else {
          const hours = days * 24;
          if (hours >= 1) {
            return hours.toFixed(0) + ' horas';
          } else {
            const minutes = hours * 60;
            if (minutes >= 1) {
              return minutes.toFixed(0) + ' minutos';
            } else {
              return (minutes * 60).toFixed(0) + ' segundos';
            }
          }
        }
      }
    }
  }

  getTimeDescription(years: number): string {
    const ageOfUniverse = 13.8e9; // 13.8 bilhões de anos
    const ageOfEarth = 4.5e9; // 4.5 bilhões de anos

    if (years >= ageOfUniverse * 1000) {
      return 'Tempo maior que 1000x a idade do universo';
    } else if (years >= ageOfUniverse * 100) {
      return 'Tempo maior que 100x a idade do universo';
    } else if (years >= ageOfUniverse * 10) {
      return 'Tempo maior que 10x a idade do universo';
    } else if (years >= ageOfUniverse) {
      return 'Tempo maior que a idade do universo';
    } else if (years >= ageOfEarth * 10) {
      return 'Tempo maior que 10x a idade da Terra';
    } else if (years >= ageOfEarth) {
      return 'Tempo maior que a idade da Terra';
    } else if (years >= 1e9) {
      return 'Tempo de bilhões de anos';
    } else if (years >= 1e6) {
      return 'Tempo de milhões de anos';
    } else if (years >= 1e3) {
      return 'Tempo de milhares de anos';
    } else if (years >= 1) {
      return 'Tempo de anos';
    } else {
      return 'Tempo relativamente curto';
    }
  }

  formatNumber(num: number): string {
    if (num >= 1e33) {
      return (num / 1e33).toFixed(2) + ' decilhões';
    } else if (num >= 1e30) {
      return (num / 1e30).toFixed(2) + ' nonilhões';
    } else if (num >= 1e27) {
      return (num / 1e27).toFixed(2) + ' octilhões';
    } else if (num >= 1e24) {
      return (num / 1e24).toFixed(2) + ' septilhões';
    } else if (num >= 1e21) {
      return (num / 1e21).toFixed(2) + ' sextilhões';
    } else if (num >= 1e18) {
      return (num / 1e18).toFixed(2) + ' quintilhões';
    } else if (num >= 1e15) {
      return (num / 1e15).toFixed(2) + ' quatrilhões';
    } else if (num >= 1e12) {
      return (num / 1e12).toFixed(2) + ' trilhões';
    } else if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + ' bilhões';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + ' milhões';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + ' mil';
    }
    return num.toLocaleString();
  }

  formatBigNumber(bigNum: bigint): string {
    try {
      const num = Number(bigNum);
      if (isNaN(num) || !isFinite(num)) {
        // Para números extremamente grandes, usar notação científica
        const str = bigNum.toString();
        if (str.length > 15) {
          const firstDigit = str[0];
          const remainingDigits = str.slice(1, 4);
          const exponent = str.length - 1;
          return `${firstDigit}.${remainingDigits} × 10^${exponent}`;
        }
        return 'Número muito grande';
      }
      return this.formatNumber(num);
    } catch (error) {
      return 'Número muito grande';
    }
  }

  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} segundos`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minutos`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} horas`;
    } else if (seconds < 31536000) {
      const days = Math.floor(seconds / 86400);
      return `${days} dias`;
    } else {
      const years = Math.floor(seconds / 31536000);
      return `${years} anos`;
    }
  }

  getProgressColor(): string {
    if (this.progress < 0.000001) return 'bg-red-500';
    if (this.progress < 0.00001) return 'bg-orange-500';
    if (this.progress < 0.0001) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  getProgressText(): string {
    if (this.progress === 0) return '0%';
    if (this.progress < 0.0000000001) return '< 0.0000000001%';
    if (this.progress < 0.000001) return '< 0.000001%';
    if (this.progress < 0.00001) return '< 0.00001%';
    if (this.progress < 0.0001) return '< 0.0001%';
    return this.progress.toFixed(6) + '%';
  }
}
