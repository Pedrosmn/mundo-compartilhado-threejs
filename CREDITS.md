# Créditos

Todos os personagens foram criados por **manoeldarochadeoliveira** e publicados
no Sketchfab sob a licença
[Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

| Membro | Modelo | Autor | Licença | Fonte |
|---|---|---|---|---|
| Membro 1 — Pedro | Male Adventurer | manoeldarochadeoliveira | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/male-adventurer-3f5f7d12c07445fe9b8c4958935970e2) |
| Membro 2 — Anderson Gabriel | Blake — The Adventurer V3 | manoeldarochadeoliveira | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/blake-the-adventurer-version-3-0196f2f4aa6d41a4af15ddb204eaef34) |
| Membro 3 — Thayná | Solus The Knight | manoeldarochadeoliveira | CC BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/solus-the-knight-566d1224b48e4765acad9593bd9637b8) |

## Modificações aplicadas

- **Escala:** os três modelos foram normalizados para 1,75 unidade de altura
  (1 unidade = 1 metro) e apoiados no chão da clareira.
- **Root motion:** os componentes horizontais das animações de deslocamento
  foram neutralizados para que os personagens andem/corram no lugar. O movimento
  vertical dos clipes foi preservado.
- **Blake — The Adventurer V3:** o arquivo original apresenta a geometria da pele
  em escala incompatível com o esqueleto (cerca de 100× maior) e matrizes de bind
  inconsistentes. Para exibir o modelo corretamente:
  - as geometrias com skinning foram reescaladas para coincidir com o esqueleto;
  - as matrizes inversas de bind foram recalculadas a partir da pose de repouso;
  - as sub-malhas faciais `inner_mouth`, `teeth`, `eyes` e `tongue` foram
    removidas, pois ficavam destacadas do rosto após o reparo. A textura do corpo
    já cobre a região facial.
- **Texturas:** nenhuma textura foi alterada.

## Cena

A floresta, o terreno, a iluminação, o céu, a interface e a lógica de animação
foram criados para este projeto com [Three.js](https://threejs.org/). Nenhum
asset externo de cenário foi utilizado.
