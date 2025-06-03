import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

const WORDLIST = [
  'apple',
  'zebra',
  'cat',
  'tree',
  'rose',
  'monkey',
  'wolf',
  'kite',
  'violet',
  'umbrella',
  'banana',
  'sun',
  'river',
  'mountain',
  'cloud',
  'star',
  'ocean',
  'leaf',
  'stone',
  'fire',
  'wind',
  'rain',
  'snow',
  'grass',
  'bird',
  'fish',
  'lion',
  'tiger',
  'bear',
  'fox',
  'dog',
  'horse',
  'frog',
  'snake',
  'eagle',
  'owl',
  'shark',
  'whale',
  'dolphin',
  'peach',
  'pear',
  'plum',
  'grape',
  'melon',
  'berry',
  'nut',
  'bean',
  'corn',
  'rice',
  'wheat',
  'mint',
  'rose',
  'lily',
  'ivy',
  'fern',
  'bamboo',
  'cedar',
  'pine',
  'oak',
  'maple',
  'willow',
  'elm',
  'ash',
  'birch',
  'fig',
  'date',
  'olive',
  'cocoa',
  'coffee',
  'tea',
  'sugar',
  'salt',
  'spice',
  'honey',
  'milk',
  'cheese',
  'bread',
  'cake',
  'pie',
  'jam',
  'soup',
  'meat',
  'egg',
  'bean',
  'corn',
  'rice',
  'wheat',
  'mint',
  'rose',
  'lily',
  'ivy',
  'fern',
  'bamboo',
  'cedar',
  'pine',
  'oak',
  'maple',
  'willow',
  'elm',
  'ash',
  'birch',
  'fig',
  'date',
  'olive',
  'cocoa',
  'coffee',
  'tea',
  'sugar',
  'salt',
  'spice',
  'honey',
  'milk',
  'cheese',
  'bread',
  'cake',
  'pie',
  'jam',
  'soup',
  'meat',
  'egg',
  'bean',
  'corn',
  'rice',
  'wheat',
  'mint',
  'rose',
  'lily',
  'ivy',
  'fern',
  'bamboo',
  'cedar',
  'pine',
  'oak',
  'maple',
  'willow',
  'elm',
  'ash',
  'birch',
  'fig',
  'date',
  'olive',
];

function randomSeedWords(): string[] {
  const words = [];
  for (let i = 0; i < 12; i++) {
    const idx = Math.floor(Math.random() * WORDLIST.length);
    words.push(WORDLIST[idx]);
  }
  return words;
}

@Component({
  selector: 'app-seed-address-visual',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seed-address-visual.component.html',
  styleUrls: ['./seed-address-visual.component.scss'],
})
export class SeedAddressVisualComponent {
  animationStep: number = 0;
  seedWords: string[] = [];
  privKey: string = '';
  pubKey: string = '';
  address: string = '';
  saldo: number = 0;

  startBruteForceManual() {
    this.animationStep = 1;
    this.seedWords = randomSeedWords();
    this.privKey = '';
    this.pubKey = '';
    this.address = '';
    this.saldo = 0;
  }

  nextStepManual() {
    if (this.animationStep === 0) {
      this.startBruteForceManual();
      return;
    }
    if (this.animationStep === 1) {
      // Derivar chave priv/pub
      this.privKey = 'priv_' + Math.random().toString(36).slice(2, 10);
      this.pubKey = 'pub_' + Math.random().toString(36).slice(2, 10);
    }
    if (this.animationStep === 2) {
      // Derivar endereço
      this.address = 'bc1q' + Math.random().toString(36).slice(2, 12);
    }
    if (this.animationStep === 3) {
      // Consultar saldo
      this.saldo = 0;
    }
    if (this.animationStep < 5) {
      this.animationStep++;
    }
  }

  prevStepManual() {
    if (this.animationStep > 1) {
      this.animationStep--;
    }
  }

  resetManual() {
    this.animationStep = 0;
    this.seedWords = [];
    this.privKey = '';
    this.pubKey = '';
    this.address = '';
    this.saldo = 0;
  }
}
