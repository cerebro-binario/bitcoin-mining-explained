import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import {
  ConsensusVersion,
  DEFAULT_CONSENSUS,
  ConsensusParameters,
} from '../models/consensus.model';

@Injectable({ providedIn: 'root' })
export class ConsensusService {
  private readonly versionsSubject = new BehaviorSubject<ConsensusVersion[]>([
    DEFAULT_CONSENSUS,
  ]);
  private nVersionRef = DEFAULT_CONSENSUS.version;

  versions: ConsensusVersion[];

  versions$;

  constructor() {
    // Initialize
    this.versions$ = this.versionsSubject.asObservable().pipe(
      tap((versions) => {
        this.versions = versions;
      })
    );

    this.versions = this.versionsSubject.getValue();
  }

  publishConsensus(consensus: ConsensusVersion) {
    // Calculate hashes before publishing
    consensus.calculateHash();

    if (this.versions.some((v) => v.hash === consensus.hash)) {
      return false;
    }

    consensus.version = ++this.nVersionRef;
    consensus.timestamp = Date.now();

    this.versions.push(consensus);
    this.versionsSubject.next(this.versions);

    return true;
  }

  updateConsensus(consensus: ConsensusVersion) {
    const index = this.versions.findIndex((v) => v.hash === consensus.hash);
    if (index !== -1) {
      this.versions[index] = consensus;
      consensus.calculateHash();
      this.versions.sort((a, b) => a.version - b.version);
      this.versionsSubject.next(this.versions);
    }
  }

  // Método para obter a versão padrão (v1)
  getDefaultVersion(): ConsensusVersion | undefined {
    return this.versions.find((v) => v.version === 1);
  }

  // Método para editar a versão padrão
  updateDefaultVersion(newParameters: Partial<ConsensusParameters>): boolean {
    const defaultVersion = this.getDefaultVersion();
    if (!defaultVersion) {
      return false;
    }

    // Atualiza os parâmetros da versão padrão
    Object.assign(defaultVersion.parameters, newParameters);
    (defaultVersion.parameters as ConsensusParameters).calculateHash();
    defaultVersion.timestamp = Date.now();
    defaultVersion.calculateHash();

    // Atualiza a lista de versões
    this.versionsSubject.next([...this.versions]);

    return true;
  }

  // Método para verificar se uma versão é a padrão
  isDefaultVersion(version: ConsensusVersion): boolean {
    return version.version === 1;
  }
}
