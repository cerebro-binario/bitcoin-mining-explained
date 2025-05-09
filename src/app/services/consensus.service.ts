import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import {
  ConsensusVersion,
  DEFAULT_CONSENSUS,
  calculateConsensusVersionHash,
  calculateEpochHash,
} from '../models/consensus.model';

@Injectable({ providedIn: 'root' })
export class ConsensusService {
  private readonly versionsSubject = new BehaviorSubject<ConsensusVersion[]>([
    { ...DEFAULT_CONSENSUS },
  ]);

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
    if (!this.versions.some((v) => v.version === consensus.version)) {
      // Calculate hashes before publishing
      consensus.epochs.forEach((epoch) => {
        epoch.hash = calculateEpochHash(epoch);
      });
      consensus.hash = calculateConsensusVersionHash(consensus);
      consensus.isLocal = false;

      this.versions.push({ ...consensus });
      this.versionsSubject.next(this.versions);
      return true;
    }
    return false;
  }
}
