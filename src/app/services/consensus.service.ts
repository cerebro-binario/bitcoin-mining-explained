import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import {
  ConsensusParameters,
  DEFAULT_CONSENSUS,
} from '../models/consensus.model';

@Injectable({ providedIn: 'root' })
export class ConsensusService {
  private readonly versionsSubject = new BehaviorSubject<ConsensusParameters[]>(
    [{ ...DEFAULT_CONSENSUS }]
  );

  versions: ConsensusParameters[];

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

  publishConsensus(consensus: ConsensusParameters) {
    if (!this.versions.some((v) => v.version === consensus.version)) {
      consensus.isLocal = false;
      this.versions.push({ ...consensus });
      this.versionsSubject.next(this.versions);
      return true;
    }
    return false;
  }
}
