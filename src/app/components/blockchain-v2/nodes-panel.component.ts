import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Node {
  id: number;
  distance: number;
}

const NODES_STORAGE_KEY = 'blockchain-v2-nodes';

@Component({
  selector: 'app-nodes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nodes-panel.component.html',
  styleUrls: ['./nodes-panel.component.scss'],
})
export class NodesPanelComponent implements OnInit {
  nodes: Node[] = [];
  private nextId = 1;

  ngOnInit() {
    const saved = localStorage.getItem(NODES_STORAGE_KEY);
    if (saved) {
      this.nodes = JSON.parse(saved);
      this.nextId =
        this.nodes.length > 0
          ? Math.max(...this.nodes.map((n) => n.id)) + 1
          : 1;
    }
  }

  addNode() {
    this.nodes.push({ id: this.nextId++, distance: 50 });
    this.saveNodes();
  }

  removeNode(index: number) {
    this.nodes.splice(index, 1);
    this.saveNodes();
  }

  saveNodes() {
    localStorage.setItem(NODES_STORAGE_KEY, JSON.stringify(this.nodes));
  }

  onNodeChange() {
    this.saveNodes();
  }
}
