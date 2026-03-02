import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export class BackButton extends Container {
    constructor(onClick: () => void) {
        super();

        const W = 100;
        const H = 34;

        const bg = new Graphics();
        const draw = (alpha: number) => {
            bg.clear();
            bg.roundRect(0, 0, W, H, 6).fill({ color: 0x000000, alpha });
            bg.roundRect(0, 0, W, H, 6).stroke({ color: 0xd4af6a, width: 1, alpha: 0.5 });
        };
        draw(0.55);
        this.addChild(bg);

        const label = new Text({
            text: '← Menu',
            style: new TextStyle({
                fontFamily: 'Georgia, serif',
                fontSize: 14,
                fill: 0xd4af6a,
            }),
        });
        label.anchor.set(0.5, 0.5);
        label.position.set(W / 2, H / 2);
        this.addChild(label);

        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.on('pointerover', () => draw(0.85));
        this.on('pointerout', () => draw(0.55));
        this.on('pointerup', onClick);
    }
}