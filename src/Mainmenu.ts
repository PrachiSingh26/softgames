import {
    Container,
    Graphics,
    Text,
    TextStyle,
    FederatedPointerEvent,
} from 'pixi.js';
import type { IScene } from './Scenemanager';
import { App } from './App';

export type MenuSelectCallback = (sceneKey: 'ace' | 'magic' | 'phoenix') => void;

interface MenuEntry {
    key: 'ace' | 'magic' | 'phoenix';
    label: string;
    subtitle: string;
    color: number;
    hoverColor: number;
}

const MENU_ENTRIES: MenuEntry[] = [
    {
        key: 'ace',
        label: '♠  Ace of Shadows',
        subtitle: '144 animated card sprites',
        color: 0x1a2a4a,
        hoverColor: 0x253d6e,
    },
    {
        key: 'magic',
        label: '✦  Magic Words',
        subtitle: 'Text + emoji dialogue system',
        color: 0x2a1a3a,
        hoverColor: 0x3e2857,
    },
    {
        key: 'phoenix',
        label: '🔥  Phoenix Flame',
        subtitle: 'Particle fire effect',
        color: 0x3a1a0a,
        hoverColor: 0x5c2c10,
    },
];


export class MainMenu extends Container implements IScene {
    private onSelect: MenuSelectCallback;
    private buttons: Container[] = [];

    constructor(onSelect: MenuSelectCallback) {
        super();
        this.onSelect = onSelect;
    }

    public init(): void {
        this.drawBackground();
        this.drawTitle();
        this.drawButtons();
    }

    public update(_deltaMS: number): void { }

    public destroy(): void {
        super.destroy({ children: true });
    }


    private drawBackground(): void {
        const { width, height } = App.instance;
        const bg = new Graphics();
        bg.rect(0, 0, width, height).fill({ color: 0x070b14 });
        bg.rect(0, 0, width, height).fill({
            color: 0x000000,
            alpha: 0.45,
        });
        bg.rect(width * 0.1, height * 0.72, width * 0.8, 1).fill({
            color: 0xd4af6a,
            alpha: 0.25,
        });
        this.addChildAt(bg, 0);
    }

    private drawTitle(): void {
        const { width, height } = App.instance;

        const titleStyle = new TextStyle({
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: Math.min(width * 0.065, 52),
            fontWeight: 'bold',
            fill: 0xd4af6a,
            letterSpacing: 6,
            dropShadow: {
                color: 0xd4af6a,
                blur: 20,
                distance: 0,
                alpha: 0.4,
            },
        });

        const title = new Text({ text: 'SOFTGAMES', style: titleStyle });
        title.anchor.set(0.5, 0);
        title.position.set(width / 2, height * 0.1);
        this.addChild(title);

        const subStyle = new TextStyle({
            fontFamily: 'Georgia, serif',
            fontSize: Math.min(width * 0.022, 17),
            fill: 0x8899aa,
            letterSpacing: 3,
        });

        const subtitle = new Text({
            text: 'GAME DEVELOPER ASSIGNMENT',
            style: subStyle,
        });
        subtitle.anchor.set(0.5, 0);
        subtitle.position.set(width / 2, height * 0.1 + titleStyle.fontSize + 8);
        this.addChild(subtitle);
    }

    private drawButtons(): void {
        const { width, height } = App.instance;
        const btnW = Math.min(width * 0.72, 420);
        const btnH = 76;
        const gap = 18;
        const totalH = MENU_ENTRIES.length * (btnH + gap) - gap;
        const startY = height * 0.34;

        MENU_ENTRIES.forEach((entry, i) => {
            const btn = this.createButton(entry, btnW, btnH);
            btn.x = width / 2 - btnW / 2;
            btn.y = startY + i * (btnH + gap);
            this.addChild(btn);
            this.buttons.push(btn);
        });

        void totalH;
    }

    private createButton(entry: MenuEntry, w: number, h: number): Container {
        const btn = new Container();
        btn.eventMode = 'static';
        btn.cursor = 'pointer';

        const bg = new Graphics();
        const drawBg = (color: number, alpha = 1) => {
            bg.clear();
            bg.roundRect(0, 0, w, h, 10).fill({ color, alpha });
            bg.rect(0, 8, 3, h - 16).fill({ color: entry.color === 0x1a2a4a ? 0x5588ff : entry.color === 0x2a1a3a ? 0xaa66ff : 0xff7722, alpha: 0.9 });
        };

        drawBg(entry.color);
        btn.addChild(bg);

        const labelStyle = new TextStyle({
            fontFamily: 'Georgia, serif',
            fontSize: 20,
            fontWeight: 'bold',
            fill: 0xeef2ff,
        });

        const label = new Text({ text: entry.label, style: labelStyle });
        label.anchor.set(0, 0.5);
        label.position.set(18, h * 0.38);
        btn.addChild(label);

        const subStyle = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 12,
            fill: 0x8899aa,
        });

        const sub = new Text({ text: entry.subtitle, style: subStyle });
        sub.anchor.set(0, 0.5);
        sub.position.set(20, h * 0.7);
        btn.addChild(sub);

        btn.on('pointerover', () => drawBg(entry.hoverColor));
        btn.on('pointerout', () => drawBg(entry.color));
        btn.on('pointerdown', () => drawBg(entry.hoverColor, 0.7));
        btn.on('pointerup', (_e: FederatedPointerEvent) => {
            this.onSelect(entry.key);
        });

        return btn;
    }
}