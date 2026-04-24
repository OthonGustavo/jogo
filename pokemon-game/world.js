class World {
    constructor(game) {
        this.game = game;
        this.tileSize = 40;
        this.player = {
            gridX: 5,
            gridY: 5,
            screenX: 5 * 40,
            screenY: 5 * 40,
            direction: 'down',
            isMoving: false
        };

        // 0: Grama, 1: Parede, 2: Grama Alta (Batalha), 3: Casa
        this.map = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,3,3,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,1],
            [1,0,3,3,0,0,0,0,0,3,3,0,0,0,0,0,2,2,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];
    }

    update() {
        if (!this.game.isWorldActive) return;

        // Suavizar movimento
        const targetX = this.player.gridX * this.tileSize;
        const targetY = this.player.gridY * this.tileSize;

        if (this.player.screenX < targetX) this.player.screenX += 4;
        if (this.player.screenX > targetX) this.player.screenX -= 4;
        if (this.player.screenY < targetY) this.player.screenY += 4;
        if (this.player.screenY > targetY) this.player.screenY -= 4;

        if (Math.abs(this.player.screenX - targetX) < 4) this.player.screenX = targetX;
        if (Math.abs(this.player.screenY - targetY) < 4) this.player.screenY = targetY;
    }

    draw(ctx) {
        // Desenhar Mapa
        for (let y = 0; y < this.map.length; y++) {
            for (let x = 0; x < this.map[y].length; x++) {
                const tile = this.map[y][x];
                ctx.fillStyle = this.getTileColor(tile);
                ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                
                // Bordas leves nos tiles
                ctx.strokeStyle = 'rgba(0,0,0,0.05)';
                ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
            }
        }

        // Desenhar Jogador (Emoji por enquanto, trocaremos por sprite se necessário)
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(this.player.screenX + 20, this.player.screenY + 20, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('P', this.player.screenX + 16, this.player.screenY + 25);
    }

    getTileColor(tile) {
        switch(tile) {
            case 0: return '#4ade80'; // Grama
            case 1: return '#1e293b'; // Parede/Limite
            case 2: return '#166534'; // Grama Alta
            case 3: return '#f59e0b'; // Casa
            default: return '#000';
        }
    }

    move(dx, dy) {
        if (this.player.screenX !== this.player.gridX * this.tileSize || 
            this.player.screenY !== this.player.gridY * this.tileSize) return;

        const nextX = this.player.gridX + dx;
        const nextY = this.player.gridY + dy;

        // Verificar limites e colisões
        if (nextX >= 0 && nextX < 20 && nextY >= 0 && nextY < 15) {
            const nextTile = this.map[nextY][nextX];
            if (nextTile !== 1 && nextTile !== 3) {
                this.player.gridX = nextX;
                this.player.gridY = nextY;

                // Verificar gatilho de batalha
                if (nextTile === 2 && Math.random() < 0.2) {
                    this.game.startBattle();
                }
            }
        }
    }
}
