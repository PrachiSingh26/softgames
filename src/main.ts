import { AceOfShadows } from "./Aceofshadows";
import { App } from "./App";
import { BackButton } from "./Backbutton";
import { MagicWords } from "./Magicwords";
import { MainMenu } from "./Mainmenu";
import { PhoenixFlame } from "./PhoenixFlame";
import { SceneManager } from "./Scenemanager";

async function main(): Promise<void> {
  const app = App.instance;
  await app.init();

  const goToMenu = () => {
    backBtn.visible = false;
    showMenu();
  };

  const backBtn = new BackButton(goToMenu);
  backBtn.position.set(app.width - 116, 10);
  backBtn.visible = false;
  app.pixi.stage.addChild(backBtn);

  window.addEventListener('resize', () => {
    backBtn.position.set(app.width - 116, 10);
  });

  const showMenu = () => {
    const menu = new MainMenu((key) => {
      backBtn.visible = true;
      switch (key) {
        case 'ace':
          SceneManager.show(new AceOfShadows());
          break;
        case 'magic':
          SceneManager.show(new MagicWords())
          break;
        case 'phoenix':
          SceneManager.show(new PhoenixFlame())
          break;
      }
    });
    SceneManager.show(menu);
  };

  showMenu();
}

main().catch(console.error);