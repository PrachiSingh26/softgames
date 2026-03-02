import {
    Container,
    Graphics,
    Sprite,
    Text,
    TextStyle,
    Texture,
} from 'pixi.js';
import type { IScene } from './Scenemanager';
import { App } from './App';

const MAX_PARTICLES = 10;
const SPAWN_INTERVAL = 0.08;

interface FireParticle {
    sprite: Sprite;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    baseScale: number;
    active: boolean;
}

export class PhoenixFlame extends Container implements IScene {

    private pool: FireParticle[] = [];
    private particleLayer!: Container;
    private flameTexture!: Texture;
    private emberTexture!: Texture;
    private emitterX = 0;
    private emitterY = 0;
    private spawnTimer = 0;
    private resizeHandler = () => this.onResize();

    public init(): void {
        this.buildTextures();
        this.buildBackground();
        this.buildPool();
        this.buildUI();

        this.onResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    public update(deltaMS: number): void {
        const dt = deltaMS / 1000;
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnParticle();
            this.spawnTimer = SPAWN_INTERVAL + (Math.random() - 0.5) * 0.02;
        }

        for (const p of this.pool) {
            if (!p.active) continue;

            p.life -= dt;

            if (p.life <= 0) {
                this.recycleParticle(p);
                continue;
            }
            const t = p.life / p.maxLife;
            p.vx += (Math.random() - 0.5) * 25 * dt;
            p.vx *= 1 - 2.5 * dt;
            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;

            const scaleCurve = Math.sin(t * Math.PI);
            p.sprite.scale.set(p.baseScale * (0.3 + scaleCurve * 0.9));
            p.sprite.alpha = Math.sin(t * Math.PI) * 0.92;
            p.sprite.rotation += (Math.random() - 0.5) * 0.06;
        }
    }

    public destroy(): void {
        window.removeEventListener('resize', this.resizeHandler);
        this.flameTexture.destroy(true);
        this.emberTexture.destroy(true);
        super.destroy({ children: true });
    }

    private buildTextures(): void {
        const { pixi } = App.instance;
        const SIZE = 80;

        const flameGfx = new Graphics();
        flameGfx.ellipse(SIZE / 2, SIZE / 2 + 10, SIZE / 2, SIZE / 2 - 2);
        flameGfx.fill({ color: 0xff4400, alpha: 0.15 });
        flameGfx.ellipse(SIZE / 2, SIZE / 2 + 8, SIZE / 2 - 8, SIZE / 2 - 10);
        flameGfx.fill({ color: 0xff7700, alpha: 0.55 });
        flameGfx.ellipse(SIZE / 2, SIZE / 2 + 12, SIZE / 2 - 20, SIZE / 2 - 20);
        flameGfx.fill({ color: 0xffee00, alpha: 0.85 });
        flameGfx.ellipse(SIZE / 2, SIZE / 2 + 14, SIZE / 7, SIZE / 9);
        flameGfx.fill({ color: 0xffffff, alpha: 0.9 });
        this.flameTexture = pixi.renderer.generateTexture(flameGfx);
        flameGfx.destroy();

        const emberGfx = new Graphics();
        emberGfx.circle(8, 8, 8);
        emberGfx.fill({ color: 0xffffff, alpha: 1 });

        this.emberTexture = pixi.renderer.generateTexture(emberGfx);
        emberGfx.destroy();
    }

    private buildBackground(): void {
        const { width, height } = App.instance;

        const bg = new Graphics();
        bg.rect(0, 0, width, height);
        bg.fill({ color: 0x08000f });
        bg.label = 'bg';
        this.addChild(bg);

        const halo = new Graphics();
        halo.ellipse(0, 0, 230, 70);
        halo.fill({ color: 0xff3300, alpha: 0.2 });
        halo.label = 'halo';
        this.addChild(halo);
    }

    private buildPool(): void {
        this.particleLayer = new Container();
        this.addChild(this.particleLayer);

        for (let i = 0; i < MAX_PARTICLES; i++) {
            const isEmber = i >= 7;
            const sprite = new Sprite(isEmber ? this.emberTexture : this.flameTexture);
            sprite.anchor.set(0.5);
            sprite.alpha = 0;
            sprite.visible = false;
            sprite.blendMode = 'add';

            this.pool.push({
                sprite,
                vx: 0, vy: 0,
                life: 0, maxLife: 1,
                baseScale: 1,
                active: false,
            });

            this.particleLayer.addChild(sprite);
        }
    }

    private buildUI(): void {
        const label = new Text({
            text: '✦  PHOENIX FLAME  ✦',
            style: new TextStyle({
                fontFamily: 'Georgia, serif',
                fontSize: 18,
                fill: 0xff6622,
                letterSpacing: 6,
                dropShadow: {
                    color: 0xff2200,
                    blur: 12,
                    distance: 0,
                    alpha: 0.9,
                },
            }),
        });
        label.anchor.set(0.5, 0);
        label.label = 'sceneLabel';
        this.addChild(label);
    }

    private spawnParticle(): void {
        const p = this.pool.find((p) => !p.active);
        if (!p) return;
        const isEmber = p.sprite.texture === this.emberTexture;
        p.sprite.position.set(
            this.emitterX + (Math.random() - 0.5) * 28,
            this.emitterY,
        );
        p.vx = (Math.random() - 0.5) * (isEmber ? 110 : 60);
        p.vy = -(Math.random() * (isEmber ? 220 : 130) + (isEmber ? 160 : 80));
        p.maxLife = isEmber
            ? Math.random() * 1.0 + 0.6
            : Math.random() * 0.9 + 0.5;
        p.life = p.maxLife;
        p.baseScale = Math.random() * 0.55 + 0.45;

        const tints = [0xff2200, 0xff5500, 0xff8800, 0xffbb00, 0xffee44];
        p.sprite.tint = tints[Math.floor(Math.random() * tints.length)];
        p.sprite.visible = true;
        p.active = true;
    }

    private recycleParticle(p: FireParticle): void {
        p.active = false;
        p.sprite.visible = false;
        p.sprite.alpha = 0;
    }

    private onResize(): void {
        const { width, height } = App.instance;

        this.emitterX = width / 2;
        this.emitterY = height * 0.74;

        const bg = this.getChildByLabel('bg') as Graphics | null;
        if (bg) {
            bg.clear();
            bg.rect(0, 0, width, height);
            bg.fill({ color: 0x08000f });
        }

        const halo = this.getChildByLabel('halo') as Graphics | null;
        if (halo) halo.position.set(this.emitterX, this.emitterY);

        const label = this.getChildByLabel('sceneLabel') as Text | null;
        if (label) {
            label.x = width / 2;
            label.y = 24;
        }
    }
}