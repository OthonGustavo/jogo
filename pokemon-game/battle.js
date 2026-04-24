class Battle {
    constructor(game) {
        this.game = game;
        this.player = { hp: 100, maxHp: 100, name: 'Raicat' };
        this.enemy = { hp: 100, maxHp: 100, name: 'Ignis' };
        this.isPlayerTurn = true;
        this.isProcessing = false;
        
        this.playerImg = new Image();
        this.playerImg.src = 'player.png';
        this.enemyImg = new Image();
        this.enemyImg.src = 'enemy.png';
    }

    start() {
        this.player.hp = 100;
        this.enemy.hp = 100;
        this.isPlayerTurn = true;
        this.isProcessing = false;
        this.updateUI();
        this.setMessage(`Um ${this.enemy.name} selvagem apareceu!`);
    }

    attack(abilityIndex) {
        if (!this.isPlayerTurn || this.isProcessing) return;

        this.isProcessing = true;
        const damage = Math.floor(Math.random() * 15) + 10;
        this.enemy.hp = Math.max(0, this.enemy.hp - damage);
        
        this.setMessage(`Raicat usou uma habilidade e causou ${damage} de dano!`);
        this.updateUI();

        setTimeout(() => {
            if (this.enemy.hp <= 0) {
                this.setMessage(`O ${this.enemy.name} foi derrotado!`);
                setTimeout(() => this.game.endBattle(true), 2000);
            } else {
                this.isPlayerTurn = false;
                this.enemyTurn();
            }
        }, 1500);
    }

    enemyTurn() {
        this.setMessage(`${this.enemy.name} está pensando...`);
        
        setTimeout(() => {
            const damage = Math.floor(Math.random() * 12) + 8;
            this.player.hp = Math.max(0, this.player.hp - damage);
            this.setMessage(`${this.enemy.name} atacou e causou ${damage} de dano!`);
            this.updateUI();

            setTimeout(() => {
                if (this.player.hp <= 0) {
                    this.setMessage(`Raicat desmaiou...`);
                    setTimeout(() => this.game.endBattle(false), 2000);
                } else {
                    this.isPlayerTurn = true;
                    this.isProcessing = false;
                    this.setMessage(`O que o Raicat deve fazer?`);
                }
            }, 1500);
        }, 1500);
    }

    updateUI() {
        document.getElementById('player-hp').style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
        document.getElementById('enemy-hp').style.width = `${(this.enemy.hp / this.enemy.maxHp) * 100}%`;
        
        // Mudar cor com base na vida
        this.updateHpColor('player-hp', this.player.hp);
        this.updateHpColor('enemy-hp', this.enemy.hp);
    }

    updateHpColor(id, hp) {
        const bar = document.getElementById(id);
        if (hp < 20) bar.style.background = 'var(--gba-red)';
        else if (hp < 50) bar.style.background = 'var(--gba-orange)';
        else bar.style.background = 'var(--gba-green)';
    }

    setMessage(msg) {
        document.getElementById('battle-message').innerText = msg;
    }

    draw(ctx) {
        // Fundo de Batalha (Simples gradiente para visual limpo)
        const grad = ctx.createLinearGradient(0, 0, 0, 600);
        grad.addColorStop(0, '#3b82f6');
        grad.addColorStop(1, '#93c5fd');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 600);

        // Chão (Elipse moderna)
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(200, 450, 150, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(600, 250, 150, 50, 0, 0, Math.PI * 2);
        ctx.fill();

        // Monstros (Ilustrações Digitais)
        // Jogador (Costas/Diagonal)
        if (this.playerImg.complete) {
            ctx.drawImage(this.playerImg, 100, 300, 250, 250);
        }
        
        // Inimigo (Frente)
        if (this.enemyImg.complete) {
            ctx.drawImage(this.enemyImg, 500, 100, 200, 200);
        }
    }
}
