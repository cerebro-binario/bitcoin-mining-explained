import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import { ConsensusVersion, DEFAULT_CONSENSUS } from '../models/consensus.model';

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

    this.versions.push(consensus);
    this.versionsSubject.next(this.versions);

    return true;
  }
}
