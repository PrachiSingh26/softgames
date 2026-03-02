import { Application, Text, TextStyle, Ticker } from 'pixi.js';

export class App {

    public readonly pixi: Application;
    private fpsText: Text;
    private static _instance: App;

    private constructor() {
        this.pixi = new Application();
        this.fpsText = new Text({ text: 'FPS: --', style: this.fpStyle() });
    }

    public static get instance(): App {
        if (!App._instance) App._instance = new App();
        return App._instance;
    }

    public async init(): Promise<void> {
        await this.pixi.init({
            backgroundColor: 0x0a0a0f,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            resizeTo: window,
        });

        document.body.appendChild(this.pixi.canvas);

        this.setupFPS();
        this.setupResize();
    }

    // FPS Counter
    private setupFPS(): void {
        this.fpsText.zIndex = 9999;
        this.fpsText.position.set(12, 10);
        this.pixi.stage.addChild(this.fpsText);
        this.pixi.ticker.add(this.updateFPS, this);
    }

    private updateFPS(_ticker: Ticker): void {
        this.fpsText.text = `FPS: ${Math.round(this.pixi.ticker.FPS)}`;
        this.pixi.stage.setChildIndex(
            this.fpsText,
            this.pixi.stage.children.length - 1
        );
    }

    private fpStyle(): TextStyle {
        return new TextStyle({
            fontFamily: 'monospace',
            fontSize: 14,
            fill: 0x00ff88,
            fontWeight: 'bold',
            dropShadow: {
                color: 0x000000,
                blur: 4,
                distance: 0,
                alpha: 0.8,
            },
        });
    }

    private setupResize(): void {
        window.addEventListener('resize', this.onResize.bind(this));
    }

    private onResize(): void {
        this.pixi.renderer.resize(window.innerWidth, window.innerHeight);
    }

    public get width(): number {
        return this.pixi.screen.width;
    }

    public get height(): number {
        return this.pixi.screen.height;
    }
}