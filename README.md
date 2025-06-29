# Bitcoin Mining Explained

Uma aplicação Angular interativa para explicar conceitos de mineração de Bitcoin e blockchain.

## 🚀 Deploy

O projeto está configurado para deploy automático no GitHub Pages.

### URLs de Acesso

- **Aplicação Principal**: `https://cerebro-binario.github.io/bitcoin-mining-explained/`
- **Slides de Moeda Lastro vs Liquidez**: `https://cerebro-binario.github.io/bitcoin-mining-explained/slides`
- **Slides HTML Direto**: `https://cerebro-binario.github.io/bitcoin-mining-explained/assets/slides.html`

## 📊 Slides Incluídos

### Moeda Lastro vs Moeda de Liquidez
Uma apresentação completa sobre:
- Diferenças entre moeda lastro e moeda de liquidez
- Perspectiva sistêmica vs individual
- Importância do dinheiro forte
- Pilares do sistema monetário atual
- Complexidade da confiança
- Ciclos econômicos e fluxo do dinheiro
- Endividamento governamental
- Falha sistêmica inevitável
- Bitcoin como ferramenta estratégica
- Dilema de alocação de capital
- Hiperbitcoinização
- Como conseguir bitcoins

## 🛠️ Desenvolvimento

### Pré-requisitos
- Node.js 18+
- npm

### Instalação
```bash
npm install
```

### Executar em desenvolvimento
```bash
npm start
```

### Build de produção
```bash
npm run build
```

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── pages/
│   │   └── slides-page/          # Componente para exibir slides
│   └── ...
├── assets/
│   └── slides.html              # Arquivo HTML dos slides
└── ...
```

## 🔄 Deploy Automático

O projeto usa GitHub Actions para deploy automático:
- Qualquer push para a branch `master` dispara o build
- O resultado é publicado automaticamente no GitHub Pages
- Os slides ficam disponíveis em `/slides` e `/assets/slides.html`

## 📝 Notas

- Os slides são servidos como um componente Angular em `/slides`
- Também é possível acessar diretamente o HTML em `/assets/slides.html`
- O arquivo de slides está em `src/assets/slides.html`
