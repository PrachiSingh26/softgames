import { Container } from 'pixi.js';
import { App } from './App';

export interface IScene {
    init(): void;
    update(deltaMS: number): void;
    destroy(): void;
}

export class SceneManager {
    private static currentScene: (IScene & Container) | null = null;
    private static tickerCb: (() => void) | null = null;

    public static show<T extends IScene & Container>(scene: T): void {
        const { pixi } = App.instance;

        if (SceneManager.currentScene) {
            SceneManager.currentScene.destroy();
            pixi.stage.removeChild(SceneManager.currentScene);
        }

        if (SceneManager.tickerCb) {
            pixi.ticker.remove(SceneManager.tickerCb);
            SceneManager.tickerCb = null;
        }

        SceneManager.currentScene = scene;
        pixi.stage.addChildAt(scene, 0);
        scene.init();
        SceneManager.tickerCb = () => scene.update(pixi.ticker.deltaMS);
        pixi.ticker.add(SceneManager.tickerCb);
    }
}