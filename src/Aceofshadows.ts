import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import type { IScene } from './Scenemanager';
import { App } from './App';

const CARD_COUNT = 144;
const CARD_W = 90;
const CARD_H = 126;
const STACK_OFFSET_X = 0.3;
const STACK_OFFSET_Y = 0.6;
const MOVE_INTERVAL_MS = 1000;
const ANIM_DURATION_S = 2;

export class AceOfShadows extends Container implements IScene {
    private stacks: Sprite[][] = [[], []];
    private cardLayer!: Container;
    private labels: Text[] = [];
    private moveTimer: ReturnType<typeof setInterval> | null = null;
    private flyZ = 10000;

    public init(): void {
        this.cardLayer = new Container();
        this.addChild(this.cardLayer);

        const gfx = new Graphics();
        gfx.roundRect(0, 0, CARD_W, CARD_H, 8);
        gfx.fill(0xffffff);
        gfx.roundRect(0, 0, CARD_W, CARD_H, 8);
        gfx.stroke({ color: 0xaaaaaa, width: 1.5 });

        const cardTexture: Texture = App.instance.pixi.renderer.generateTexture(gfx);
        gfx.destroy();

        for (let i = 0; i < CARD_COUNT; i++) {
            const sprite = new Sprite(cardTexture);
            sprite.width = CARD_W;
            sprite.height = CARD_H;
            sprite.anchor.set(0.5, 1);
            this.cardLayer.addChild(sprite);
            this.stacks[0].push(sprite);
        }

        const style = new TextStyle({ fill: 0xffffff, fontSize: 14 });
        for (let i = 0; i < 2; i++) {
            const lbl = new Text({ text: '', style });
            lbl.anchor.set(0.5, 0);
            this.addChild(lbl);
            this.labels.push(lbl);
        }

        this.layoutStacks();
        this.moveTimer = setInterval(() => this.triggerMove(), MOVE_INTERVAL_MS);
    }

    public update(_deltaMS: number): void { }

    public destroy(): void {
        if (this.moveTimer) clearInterval(this.moveTimer);
        gsap.killTweensOf(this.cardLayer.children);
        super.destroy({ children: true });
    }

    private stackPos(index: number): { x: number; y: number } {
        const { width, height } = App.instance;
        return {
            x: width / 2 + (index === 0 ? -180 : 180),
            y: height * 0.55,
        };
    }

    private layoutStacks(): void {
        for (let si = 0; si < 2; si++) {
            const base = this.stackPos(si);
            this.stacks[si].forEach((sprite, i) => {
                sprite.x = base.x + i * STACK_OFFSET_X;
                sprite.y = base.y - i * STACK_OFFSET_Y;
                sprite.zIndex = i;
            });
        }
        this.cardLayer.sortChildren();
        this.updateLabels();
    }

    private updateLabels(): void {
        const { height } = App.instance;
        this.labels.forEach((lbl, i) => {
            lbl.text = `Stack ${i + 1}  [${this.stacks[i].length}]`;
            lbl.x = this.stackPos(i).x;
            lbl.y = height * 0.55 + 20;
        });
    }

    private triggerMove(): void {
        if (this.stacks[0].length === 0) {
            clearInterval(this.moveTimer!);
            this.moveTimer = null;
            return;
        }

        const sprite = this.stacks[0].pop()!;
        const startX = sprite.x;
        const startY = sprite.y;

        this.layoutStacks();

        const dst = this.stackPos(1);
        const landX = dst.x + this.stacks[1].length * STACK_OFFSET_X;
        const landY = dst.y - this.stacks[1].length * STACK_OFFSET_Y;

        sprite.zIndex = this.flyZ++;
        this.cardLayer.sortChildren();

        const half = ANIM_DURATION_S / 2;
        const peakY = Math.min(startY, landY) - 130;
        const midX = (startX + landX) / 2;

        gsap.timeline({
            onComplete: () => { this.stacks[1].push(sprite); this.layoutStacks(); },
        })
            .to(sprite, { duration: half, x: midX, y: peakY, rotation: 0.2, ease: 'power2.out' })
            .to(sprite, { duration: half, x: landX, y: landY, rotation: 0, ease: 'power2.in' });
    }
}