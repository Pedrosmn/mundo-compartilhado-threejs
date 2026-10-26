# Mundo Compartilhado

Cena 3D de uma floresta procedural com três personagens animados do Sketchfab,
construída com **Three.js** e **Vite**. Cada personagem tem seu próprio conjunto
de animações, e todos os clipes podem ser acionados por um painel HTML
personalizado.

- Floresta gerada em código (chão, árvores, pedras, arbustos, grama e esporos),
  sem assets externos de cenário.
- Três modelos `.glb` do autor `manoeldarochadeoliveira`, licença **CC BY 4.0**.
- 86 clipes de animação no total (21 + 18 + 47), todos disponíveis na interface.
- 1 unidade = 1 metro. Todos os personagens são normalizados para **1,75 m**.
- Interface e documentação em português; código e comentários em inglês.
- Layout responsivo: painel lateral no desktop e folha inferior (bottom sheet)
  em celulares e tablets em retrato.

## Requisitos

- [Node.js](https://nodejs.org/) `^20.19.0` ou `>=22.12.0` (exigência do Vite 8).
- Navegador com suporte a WebGL 2.

## Instalação

```bash
npm install
```

O `postinstall` copia automaticamente os decoders Draco de
`node_modules/three/examples/jsm/libs/draco/` para `public/draco/`. O mesmo
script roda antes de `npm run dev` e `npm run build`, então o projeto não depende
de CDN.

## Desenvolvimento

```bash
npm run dev
```

Abra o endereço exibido no terminal (por padrão, `http://localhost:5173/`).

## Build de produção

```bash
npm run build
```

Os arquivos finais ficam em `dist/`. O `base: './'` faz o build funcionar tanto
na raiz quanto em subpastas (por exemplo, GitHub Pages).

Para conferir o build localmente:

```bash
npm run preview
```

## Controles

| Ação | Como usar |
|---|---|
| Orbitar a câmera | Arraste com o botão esquerdo (ou com um dedo) |
| Aproximar / afastar | Role a roda do mouse (ou faça pinça na tela) |
| Selecionar um personagem | Clique nele na cena ou no card do painel |
| Trocar a animação | Use os botões **Parado / Andar / Correr** ou o seletor com todos os clipes |
| Pausar / retomar | Botão **Pausar animações** / **Retomar animações** |
| Voltar ao enquadramento inicial | Botão **Resetar câmera** |
| Ver créditos e licenças | Botão **Créditos** |
| Recolher o painel | Botão de seta no cabeçalho do painel |

No celular, o painel ocupa a parte inferior da tela e a cena é enquadrada na área
livre acima dele. Ao recolher o painel, a câmera se afasta para manter os três
personagens visíveis.

## Estrutura do projeto

```
mundo_compartilhado/
├── index.html              # marcação do painel, créditos e loading
├── vite.config.js          # base relativa e alvo do build
├── scripts/
│   └── copy-draco.mjs      # copia os decoders Draco para public/
├── public/
│   ├── models/             # os três arquivos .glb
│   └── draco/              # decoders locais (gerados pelo script)
└── src/
    ├── main.js             # bootstrap, carregamento, seleção e loop
    ├── scene.js            # renderer, câmera responsiva, luzes, céu e controles
    ├── forest.js           # floresta procedural e animação do vento
    ├── loader.js           # GLTFLoader + DRACOLoader
    ├── characters.js       # normalização, reparo, rótulos e anel de seleção
    ├── animations.js       # mixer, presets, loop/one-shot e root motion
    ├── ui.js               # painel, cards, créditos e loading
    └── config.js           # membros, posições, cores e caminhos
```

## Notas técnicas

- **Escala e chão:** a altura é calculada a partir da maior malha com skinning
  (o corpo), e não da união de todas as geometrias. Isso evita que acessórios
  mal posicionados distorçam a normalização.
- **Root motion:** os componentes horizontais das tracks de posição do osso
  raiz/quadril são neutralizados; o movimento vertical (passo, pulo) é mantido.
  Tracks de posição em nós que não são ossos (armature) são descartadas.
- **Blake:** o GLB original tem a geometria da pele em uma escala cerca de 100×
  maior que o esqueleto e matrizes de bind inconsistentes. O app detecta a
  divergência, reescala as geometrias para o esqueleto e recalcula as matrizes
  inversas. Sub-malhas faciais (boca, dentes, olhos e língua) foram removidas
  porque ficavam soltas; a textura do corpo já cobre o rosto.
- **Sombras:** `PCFShadowMap` (o `PCFSoftShadowMap` foi removido no Three.js
  r186). A luz direcional usa mapa de sombras 2048×2048.
- **Pausa:** o botão pausa os mixers de todos os personagens sem interromper a
  renderização, o vento ou a câmera.
- **Falha de carregamento:** se um modelo não carregar, o card mostra um aviso e
  uma cápsula provisória é posicionada na cena, mantendo o restante funcional.

## Créditos

Os modelos, autores, links e a licença estão em [CREDITS.md](CREDITS.md) e também
no diálogo **Créditos** da própria aplicação.
