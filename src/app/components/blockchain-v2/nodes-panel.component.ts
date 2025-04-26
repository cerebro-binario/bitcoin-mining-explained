import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Node {
  id: number;
}

@Component({
  selector: 'app-nodes-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nodes-panel.component.html',
  styleUrls: ['./nodes-panel.component.scss'],
})
export class NodesPanelComponent {
  nodes: Node[] = [];
  private nextId = 1;

  addNode() {
    this.nodes.push({ id: this.nextId++ });
  }

  removeNode(index: number) {
    this.nodes.splice(index, 1);
  }
}
