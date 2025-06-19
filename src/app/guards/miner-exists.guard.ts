import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { BitcoinNetworkService } from '../services/bitcoin-network.service';

@Injectable({
  providedIn: 'root',
})
export class MinerExistsGuard implements CanActivate {
  constructor(
    private bitcoinNetworkService: BitcoinNetworkService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const minerIdParam = route.paramMap.get('id');

    // Verifica se o parâmetro id existe e é um número válido
    if (!minerIdParam || isNaN(+minerIdParam)) {
      console.warn(
        `MinerExistsGuard: ID inválido "${minerIdParam}" - redirecionando para /`
      );
      this.router.navigate(['/']);
      return false;
    }

    const minerId = +minerIdParam;

    // Verifica se o miner existe
    const minerExists = this.bitcoinNetworkService.nodes.some(
      (node) => node.id === minerId
    );

    if (!minerExists) {
      console.warn(
        `MinerExistsGuard: Miner com ID ${minerId} não encontrado - redirecionando para /`
      );
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
