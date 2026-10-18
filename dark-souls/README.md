# Almas Sombrias — uma homenagem a Dark Souls

Jogo de ação 3D no navegador, no estilo "souls-like", feito com Three.js (incluído em `vendor/`, funciona offline).

## Como jogar
Precisa de um servidor local (módulos JS não abrem via `file://`):

```bash
cd dark-souls
python3 -m http.server 8000
# abra http://localhost:8000
```

## Controles
| Tecla | Ação |
|---|---|
| WASD | mover |
| Mouse / setas | câmera |
| Shift | correr (gasta estamina) |
| Espaço | rolar — invencível no começo da rolagem; parado = passo para trás |
| Clique esquerdo | ataque leve |
| F | ataque forte |
| Clique direito (segurar) | defender com o escudo |
| Q / botão do meio | travar a mira |
| R | beber Estus |
| E | interagir (fogueira, item, névoa, mensagens) |
| Esc | pausa |

## O que tem
- **Estamina** em tudo: atacar, rolar, correr e defender.
- **Fogueiras**: acender, descansar (restaura vida e Estus, *revive os inimigos*) e subir de nível (Vigor, Fôlego, Força) gastando almas.
- **Morte**: "VOCÊ MORREU", você volta à última fogueira e as almas ficam no chão. Recupere-as — se morrer de novo antes, perde tudo.
- **Abismo**: a ponte não tem parapeito; cair é morte.
- **Inimigos**: Ocos, Arqueiros (flechas), Cavaleiro Negro (bloqueia com escudo, só é atordoado por ataque forte).
- **Chefe**: Demônio do Asilo atrás da névoa — esmagada, varrida e salto com área de impacto; fica mais rápido e ganha combo abaixo de 50% de vida.
- Mensagens no chão, fragmentos de Estus, itens, Jornada Nova+ ao terminar.

Tudo é procedural: modelos com formas geométricas, texturas desenhadas em canvas e sons sintetizados com WebAudio.
