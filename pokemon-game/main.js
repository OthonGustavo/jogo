class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;

        this.world = new World(this);
        this.battle = new Battle(this);
        
        this.isWorldActive = true;
        this.isBattleActive = false;

        this.init();
    }

    init() {
        // Listeners de Teclado
        window.addEventListener('keydown', (e) => {
            if (this.isWorldActive) {
                switch(e.key.toLowerCase()) {
                    case 'w': case 'arrowup': this.world.move(0, -1); break;
                    case 's': case 'arrowdown': this.world.move(0, 1); break;
                    case 'a': case 'arrowleft': this.world.move(-1, 0); break;
                    case 'd': case 'arrowright': this.world.move(1, 0); break;
                }
            }
        });

        // Iniciar Loop
        this.loop();
    }

    startBattle() {
        this.isWorldActive = false;
        this.isBattleActive = true;
        document.getElementById('battle-ui').classList.remove('hidden');
        this.battle.start();
    }

    endBattle(victory) {
        this.isBattleActive = false;
        this.isWorldActive = true;
        document.getElementById('battle-ui').classList.add('hidden');
        
        if (victory) {
            this.showDialog("Você venceu a batalha! A vila está segura.");
        } else {
            this.showDialog("Você foi derrotado... o monstro fugiu.");
            // Resetar posição do jogador para o início da vila
            this.world.player.gridX = 5;
            this.world.player.gridY = 5;
        }
    }

    showDialog(text) {
        const box = document.getElementById('dialog-box');
        const content = document.getElementById('dialog-text');
        content.innerText = text;
        box.classList.remove('hidden');

        const handler = (e) => {
            if (e.key.toLowerCase() === 'e') {
                box.classList.add('hidden');
                window.removeEventListener('keydown', handler);
            }
        };
        window.addEventListener('keydown', handler);
    }

    update() {
        if (this.isWorldActive) this.world.update();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.isWorldActive) {
            this.world.draw(this.ctx);
        } else if (this.isBattleActive) {
            this.battle.draw(this.ctx);
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Iniciar Jogo
const game = new Game();
window.game = game; // Expor para os handlers onclik no HTML
