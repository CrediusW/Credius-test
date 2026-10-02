// @ts-check

(function () {
  "use strict";

  class EnemyBase {
    constructor(config) {
      this.type = config.type;
      this.x = config.x;
      this.y = config.y;
      this.originY = config.y;
      this.width = 48;
      this.height = 46;
      this.minX = config.minX ?? config.x - 90;
      this.maxX = config.maxX ?? config.x + 90;
      this.speed = config.speed ?? 58;
      this.direction = config.direction ?? -1;
      this.hp = 1;
      this.alive = true;
      this.squash = 0;
      this.hitFlash = 0;
      this.phase = (config.x + config.y) * 0.01;
      this.contactDamage = 1;
      this.stompable = true;
    }

    update(delta) {
      this.squash = Math.max(0, this.squash - delta);
      this.hitFlash = Math.max(0, this.hitFlash - delta);
    }

    hit() {
      this.hp -= 1;
      this.hitFlash = 0.16;
      this.squash = 0.22;
      if (this.hp <= 0) this.alive = false;
      return !this.alive;
    }

    draw(ctx, time) {
      drawPatrol(ctx, this, time);
    }
  }

  class PatrolEnemy extends EnemyBase {
    constructor(config) {
      super(config);
      this.width = 50;
      this.height = 44;
    }

    update(delta) {
      super.update(delta);
      this.x += this.direction * this.speed * delta;
      if (this.x <= this.minX || this.x + this.width >= this.maxX) {
        this.x = Math.max(this.minX, Math.min(this.maxX - this.width, this.x));
        this.direction *= -1;
      }
    }
  }

  class JumpEnemy extends EnemyBase {
    constructor(config) {
      super(config);
      this.width = 48;
      this.height = 54;
      this.groundY = config.y;
      this.vy = 0;
      this.wait = 0.65 + (config.x % 80) / 100;
      this.airborne = false;
    }

    update(delta) {
      super.update(delta);
      if (this.airborne) {
        this.vy += 1150 * delta;
        this.y += this.vy * delta;
        if (this.y >= this.groundY) {
          this.y = this.groundY;
          this.vy = 0;
          this.airborne = false;
          this.wait = 0.8;
        }
        return;
      }
      this.wait -= delta;
      if (this.wait <= 0) {
        this.airborne = true;
        this.vy = -520;
      }
    }

    draw(ctx, time) {
      drawJump(ctx, this, time);
    }
  }

  class FlyingEnemy extends EnemyBase {
    constructor(config) {
      super(config);
      this.width = 58;
      this.height = 44;
      this.axis = config.axis ?? "x";
      this.stompable = true;
      this.anchorX = config.x;
    }

    update(delta, player, projectiles, time) {
      super.update(delta);
      if (this.axis === "x") {
        this.x += this.direction * this.speed * delta;
        if (this.x <= this.minX || this.x + this.width >= this.maxX) this.direction *= -1;
        this.y = this.originY + Math.sin(time * 2.3 + this.phase) * 28;
      } else {
        this.x = this.anchorX + Math.sin(time * 1.5 + this.phase) * 42;
        this.y = this.originY + Math.sin(time * 2.6 + this.phase) * 72;
      }
    }

    draw(ctx, time) {
      drawFlying(ctx, this, time);
    }
  }

  class ShooterEnemy extends EnemyBase {
    constructor(config) {
      super(config);
      this.width = 60;
      this.height = 62;
      this.cooldown = 0.7 + (config.x % 120) / 100;
      this.stompable = true;
    }

    update(delta, player, projectiles) {
      super.update(delta);
      this.direction = player.x < this.x ? -1 : 1;
      const distance = Math.abs(player.x - this.x);
      this.cooldown -= delta;
      if (distance < 520 && distance > 80 && this.cooldown <= 0) {
        this.cooldown = 2.25;
        const dx = player.x + player.width / 2 - (this.x + this.width / 2);
        const dy = player.y + player.height / 2 - (this.y + 24);
        const length = Math.max(1, Math.hypot(dx, dy));
        projectiles.push({
          type: "seed",
          x: this.x + this.width / 2,
          y: this.y + 25,
          width: 20,
          height: 16,
          vx: (dx / length) * 185,
          vy: (dy / length) * 185,
          life: 4,
          hostile: true,
        });
      }
    }

    draw(ctx, time) {
      drawShooter(ctx, this, time);
    }
  }

  class EliteEnemy extends PatrolEnemy {
    constructor(config) {
      super(config);
      this.width = 82;
      this.height = 72;
      this.hp = 2;
      this.baseSpeed = config.speed ?? 54;
    }

    hit() {
      const defeated = super.hit();
      if (!defeated) this.speed = this.baseSpeed * 1.65;
      return defeated;
    }

    draw(ctx, time) {
      drawElite(ctx, this, time);
    }
  }

  class BossEnemy extends EnemyBase {
    constructor(config) {
      super({ ...config, type: "boss", minX: 6420, maxX: 7140, speed: 66 });
      this.width = 152;
      this.height = 124;
      this.hp = 3;
      this.maxHp = 3;
      this.groundY = config.y;
      this.vy = 0;
      this.attackTimer = 1.8;
      this.active = false;
      this.stompable = true;
      this.contactDamage = 1;
      this.defeatedTimer = 0;
    }

    update(delta, player, projectiles) {
      super.update(delta);
      if (!this.active || !this.alive) return;
      const stage = 4 - this.hp;
      const speed = 58 + stage * 34;
      this.attackTimer -= delta;
      if (this.vy !== 0 || this.y < this.groundY) {
        this.vy += 1250 * delta;
        this.y += this.vy * delta;
        if (this.y >= this.groundY) {
          this.y = this.groundY;
          this.vy = 0;
          if (stage >= 2) {
            projectiles.push({ type: "shockwave", x: this.x + 15, y: 592, width: 34, height: 22, vx: -230, vy: 0, life: 2.2, hostile: true });
            projectiles.push({ type: "shockwave", x: this.x + this.width - 15, y: 592, width: 34, height: 22, vx: 230, vy: 0, life: 2.2, hostile: true });
          }
          this.attackTimer = Math.max(0.8, 1.65 - stage * 0.2);
        }
        return;
      }
      this.x += this.direction * speed * delta;
      if (this.x <= this.minX || this.x + this.width >= this.maxX) this.direction *= -1;
      if (this.attackTimer <= 0) {
        this.vy = -510 - stage * 35;
        this.direction = player.x < this.x ? -1 : 1;
      }
    }

    hit() {
      const defeated = super.hit();
      this.x -= this.direction * 42;
      this.vy = -180;
      if (defeated) this.defeatedTimer = 1.2;
      return defeated;
    }

    draw(ctx, time) {
      drawBoss(ctx, this, time);
    }
  }

  function createEnemy(config) {
    const constructors = {
      patrol: PatrolEnemy,
      jump: JumpEnemy,
      flying: FlyingEnemy,
      shooter: ShooterEnemy,
      elite: EliteEnemy,
    };
    const EnemyClass = constructors[config.type] ?? PatrolEnemy;
    return new EnemyClass(config);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function shadow(ctx, enemy) {
    ctx.fillStyle = "rgba(20, 26, 37, 0.24)";
    ctx.beginPath();
    ctx.ellipse(enemy.x + enemy.width / 2, enemy.y + enemy.height + 5, enemy.width * 0.42, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function eyes(ctx, enemy, y, spread = 9) {
    const center = enemy.x + enemy.width / 2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(center - spread, y, 7, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(center + spread, y, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17202a";
    ctx.beginPath();
    ctx.arc(center - spread + enemy.direction * 2, y + 1, 3, 0, Math.PI * 2);
    ctx.arc(center + spread + enemy.direction * 2, y + 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function withHitFlash(ctx, enemy, draw) {
    ctx.save();
    const squash = enemy.squash > 0 ? 0.72 : 1;
    ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height);
    ctx.scale(1 + (1 - squash) * 0.35, squash);
    ctx.translate(-(enemy.x + enemy.width / 2), -(enemy.y + enemy.height));
    draw();
    if (enemy.hitFlash > 0) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillRect(enemy.x - 5, enemy.y - 5, enemy.width + 10, enemy.height + 10);
    }
    ctx.restore();
  }

  function drawPatrol(ctx, enemy) {
    shadow(ctx, enemy);
    withHitFlash(ctx, enemy, () => {
      const gradient = ctx.createLinearGradient(enemy.x, enemy.y, enemy.x, enemy.y + enemy.height);
      gradient.addColorStop(0, "#a967e8");
      gradient.addColorStop(1, "#59319e");
      ctx.fillStyle = gradient;
      roundedRect(ctx, enemy.x, enemy.y + 5, enemy.width, enemy.height - 5, 18);
      ctx.fill();
      ctx.fillStyle = "#f3d182";
      ctx.beginPath();
      ctx.moveTo(enemy.x + 8, enemy.y + 12);
      ctx.lineTo(enemy.x + 14, enemy.y - 3);
      ctx.lineTo(enemy.x + 22, enemy.y + 10);
      ctx.moveTo(enemy.x + enemy.width - 8, enemy.y + 12);
      ctx.lineTo(enemy.x + enemy.width - 14, enemy.y - 3);
      ctx.lineTo(enemy.x + enemy.width - 22, enemy.y + 10);
      ctx.fill();
      eyes(ctx, enemy, enemy.y + 23, 9);
      ctx.strokeStyle = "#2d164f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(enemy.x + 18, enemy.y + 35);
      ctx.lineTo(enemy.x + 32, enemy.y + 35);
      ctx.stroke();
    });
  }

  function drawJump(ctx, enemy, time) {
    shadow(ctx, enemy);
    withHitFlash(ctx, enemy, () => {
      const bounce = enemy.airborne ? 0 : Math.sin(time * 8 + enemy.phase) * 2;
      ctx.fillStyle = "#8ddc32";
      roundedRect(ctx, enemy.x, enemy.y + 3 + bounce, enemy.width, 36, 18);
      ctx.fill();
      eyes(ctx, enemy, enemy.y + 20 + bounce, 9);
      ctx.strokeStyle = "#526a4d";
      ctx.lineWidth = 4;
      for (const offset of [13, 34]) {
        ctx.beginPath();
        ctx.moveTo(enemy.x + offset, enemy.y + 38);
        ctx.lineTo(enemy.x + offset - 4, enemy.y + 44);
        ctx.lineTo(enemy.x + offset + 4, enemy.y + 49);
        ctx.lineTo(enemy.x + offset, enemy.y + 54);
        ctx.stroke();
      }
    });
  }

  function drawFlying(ctx, enemy, time) {
    shadow(ctx, enemy);
    withHitFlash(ctx, enemy, () => {
      const flap = Math.sin(time * 13 + enemy.phase) * 8;
      ctx.fillStyle = "#fff7df";
      ctx.beginPath();
      ctx.ellipse(enemy.x - 4, enemy.y + 20, 18, 8 + Math.abs(flap), -0.35, 0, Math.PI * 2);
      ctx.ellipse(enemy.x + enemy.width + 4, enemy.y + 20, 18, 8 + Math.abs(flap), 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5842e";
      roundedRect(ctx, enemy.x, enemy.y + 3, enemy.width, enemy.height - 3, 22);
      ctx.fill();
      ctx.fillStyle = "#55311e";
      roundedRect(ctx, enemy.x + 7, enemy.y - 3, enemy.width - 14, 15, 7);
      ctx.fill();
      ctx.fillStyle = "#75d8ef";
      ctx.beginPath();
      ctx.ellipse(enemy.x + 18, enemy.y + 5, 8, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(enemy.x + 40, enemy.y + 5, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, enemy, enemy.y + 25, 10);
    });
  }

  function drawShooter(ctx, enemy) {
    shadow(ctx, enemy);
    withHitFlash(ctx, enemy, () => {
      ctx.fillStyle = "#57a936";
      roundedRect(ctx, enemy.x + 6, enemy.y + 5, enemy.width - 12, enemy.height - 5, 18);
      ctx.fill();
      ctx.fillStyle = "#ef6f9b";
      for (let index = 0; index < 5; index += 1) {
        const angle = (Math.PI * 2 * index) / 5;
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2 + Math.cos(angle) * 10, enemy.y + 4 + Math.sin(angle) * 6, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#315f20";
      const nozzleX = enemy.direction > 0 ? enemy.x + 38 : enemy.x - 18;
      roundedRect(ctx, nozzleX, enemy.y + 22, 40, 19, 8);
      ctx.fill();
      eyes(ctx, enemy, enemy.y + 22, 9);
      ctx.fillStyle = "#2b4d1f";
      ctx.beginPath();
      ctx.moveTo(enemy.x + 8, enemy.y + 20);
      ctx.lineTo(enemy.x, enemy.y + 27);
      ctx.lineTo(enemy.x + 10, enemy.y + 30);
      ctx.fill();
    });
  }

  function drawElite(ctx, enemy) {
    shadow(ctx, enemy);
    withHitFlash(ctx, enemy, () => {
      ctx.fillStyle = enemy.hp === 1 ? "#376f9f" : "#285779";
      roundedRect(ctx, enemy.x, enemy.y + 9, enemy.width, enemy.height - 9, 26);
      ctx.fill();
      ctx.fillStyle = "#172d45";
      for (let index = 0; index < 4; index += 1) {
        ctx.beginPath();
        ctx.moveTo(enemy.x + 10 + index * 18, enemy.y + 13);
        ctx.lineTo(enemy.x + 18 + index * 18, enemy.y - 8 - (index % 2) * 5);
        ctx.lineTo(enemy.x + 27 + index * 18, enemy.y + 14);
        ctx.fill();
      }
      ctx.fillStyle = "#59616b";
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.width - 10, enemy.y + 37, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c4cbd1";
      ctx.lineWidth = 4;
      ctx.stroke();
      eyes(ctx, enemy, enemy.y + 30, 12);
      ctx.fillStyle = "#d7b08b";
      ctx.beginPath();
      ctx.ellipse(enemy.x + 28, enemy.y + 48, 19, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5eee5";
      ctx.beginPath();
      ctx.moveTo(enemy.x + 16, enemy.y + 52);
      ctx.lineTo(enemy.x + 10, enemy.y + 66);
      ctx.lineTo(enemy.x + 22, enemy.y + 55);
      ctx.fill();
    });
  }

  function drawBoss(ctx, enemy, time) {
    shadow(ctx, enemy);
    withHitFlash(ctx, enemy, () => {
      const rage = 4 - enemy.hp;
      const body = ctx.createLinearGradient(enemy.x, enemy.y, enemy.x, enemy.y + enemy.height);
      body.addColorStop(0, rage >= 3 ? "#6154c7" : "#8753b7");
      body.addColorStop(1, "#412159");
      ctx.fillStyle = body;
      roundedRect(ctx, enemy.x + 8, enemy.y + 17, enemy.width - 16, enemy.height - 17, 48);
      ctx.fill();
      ctx.fillStyle = "#242735";
      roundedRect(ctx, enemy.x + 12, enemy.y + 56, enemy.width - 24, 44, 16);
      ctx.fill();
      ctx.strokeStyle = "#f4b83f";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.fillStyle = "#efb94a";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(enemy.x + enemy.width / 2 + side * 48, enemy.y + 35);
        ctx.quadraticCurveTo(enemy.x + enemy.width / 2 + side * 72, enemy.y - 20, enemy.x + enemy.width / 2 + side * 61, enemy.y - 32);
        ctx.quadraticCurveTo(enemy.x + enemy.width / 2 + side * 32, enemy.y - 12, enemy.x + enemy.width / 2 + side * 34, enemy.y + 30);
        ctx.fill();
      }
      eyes(ctx, enemy, enemy.y + 47, 25);
      ctx.fillStyle = "#e5a5bc";
      ctx.beginPath();
      ctx.ellipse(enemy.x + enemy.width / 2, enemy.y + 72, 27, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff2d3";
      for (const offset of [-32, -20, 20, 32]) {
        ctx.beginPath();
        ctx.moveTo(enemy.x + enemy.width / 2 + offset, enemy.y + 82);
        ctx.lineTo(enemy.x + enemy.width / 2 + offset + Math.sign(offset) * 5, enemy.y + 99);
        ctx.lineTo(enemy.x + enemy.width / 2 + offset + Math.sign(offset) * 10, enemy.y + 82);
        ctx.fill();
      }
      ctx.fillStyle = "#26d7ff";
      ctx.save();
      ctx.translate(enemy.x + enemy.width / 2, enemy.y + 10);
      ctx.rotate(Math.PI / 4 + Math.sin(time * 4) * 0.05);
      ctx.fillRect(-13, -13, 26, 26);
      ctx.restore();
    });
  }

  globalThis.CrediusPrinceEntities = {
    EnemyBase,
    PatrolEnemy,
    JumpEnemy,
    FlyingEnemy,
    ShooterEnemy,
    EliteEnemy,
    BossEnemy,
    createEnemy,
    roundedRect,
  };
})();
