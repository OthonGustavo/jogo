# Gerar o chefe com IA na sua RTX 5060 (método 4)

Quem faz isso é um agente Claude Code (modelo Sonnet) rodando NO SEU NOTEBOOK.
A nuvem não enxerga a sua placa de vídeo.

## Passo a passo (você)
1. No PowerShell: `cd C:\Users\gugas\Documents\projetos-claude-code\projeto-jogo2` e depois `git pull`.
2. Abra essa pasta no app **Claude Desktop → Code**.
3. Escolha o modelo **Sonnet**.
4. Cole o prompt "GPU-0" abaixo. Ele instala tudo e mede se a sua placa aguenta (8 GB).
5. Quando o GPU-0 terminar, cole o prompt "GPU-1". Ele gera o chefe.
6. No fim, o agente envia o arquivo para `dark-souls/assets/inbox/` com `git push`.
   Depois avise na conversa da nuvem: eu coloco o chefe no jogo.

Leia o que o agente pede antes de aprovar: ele vai instalar programas (dezenas de GB).

## Prompt GPU-0 (instalação e teste)
Você roda no notebook do dono (Windows, RTX 5060 Laptop). O dono não é técnico: explique cada passo em português simples antes de pedir permissão. Leia `dark-souls/PLANO-3D.md` (seções 3, 4 e 6). Faça: (1) `nvidia-smi` e anote a VRAM e a versão do driver; (2) instale Python 3.11 e PyTorch com CUDA 12.8 (build cu128, necessário para a série 50 / Blackwell); (3) instale o ComfyUI ou o Pinokio e os geradores imagem→3D Hunyuan3D 2.1 e TRELLIS 2 (modo de pouca VRAM), confirmando nos repositórios oficiais os requisitos e a licença de cada um; (4) gere 1 modelo de teste com cada gerador a partir de uma imagem simples e meça VRAM de pico, tempo e qualidade (forma e textura); (5) escreva `dark-souls/tools/gpu/BENCH.md` com os números e a recomendação (qual gerador usar e se a textura cabe nos 8 GB; se não couber, diga que só a forma deve ser gerada). Não invente números: se algo falhar, registre o erro. Commit e push na branch `claude/dark-souls-recreate-b5ggyx`.

## Prompt GPU-1 (o chefe)
Leia `dark-souls/PLANO-3D.md` e `dark-souls/tools/gpu/BENCH.md`. Use o gerador recomendado. Passo 1: crie uma imagem conceito do "Demônio do Asilo" (criatura enorme e corcunda, chifres, barriga inchada, pele cinzenta e rachada, clava de pedra; fundo neutro, vista 3/4, pose em pé, estilo dark fantasy sombrio, sem cenário), usando um gerador de imagem local (ex.: Flux ou SDXL no ComfyUI); gere 4 variações e escolha a melhor. Passo 2: gere o 3D a partir da imagem. Passo 3: abra no Blender, reduza para menos de 30 mil triângulos (Decimate), confira normais, escala (1 unidade = 1 metro; altura ~5 m), orientação (frente para +Z) e origem nos pés, e exporte `.glb` com textura de no máximo 2048. Passo 4: renderize uma prévia `.png`. Salve em `dark-souls/assets/inbox/boss.glb` e `boss-preview.png`, com `assets/inbox/README.md` dizendo qual gerador foi usado e a licença dele. Commit e push.
