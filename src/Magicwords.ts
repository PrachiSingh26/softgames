import {
    Container,
    Graphics,
    Sprite,
    Text,
    TextStyle,
    Texture,
} from 'pixi.js';
import { gsap } from 'gsap';
import type { IScene } from './Scenemanager';
import { App } from './App';

const API_URL = 'https://private-624120-softgamesassignment.apiary-mock.com/v2/magicwords';
const HEADER_H = 52;
const AVATAR_SIZE = 44;
const BUBBLE_PAD = 10;
const BUBBLE_MAX_W = 0.52;
const EMOJI_SIZE = 28;
const FONT_SIZE = 14;
const LINE_HEIGHT = 22;
const MSG_GAP = 10;
const MSG_DELAY_S = 1.4;

interface DialogueLine { name: string; text: string; }
interface EmojiDef { name: string; url: string; }
interface AvatarDef { name: string; url: string; position: 'left' | 'right'; }
interface APIData { dialogue: DialogueLine[]; emojies: EmojiDef[]; avatars: AvatarDef[]; }

const EMOJI_GLYPHS: Record<string, string> = {
    sad: '😢',
    intrigued: '🤔',
    neutral: '😐',
    satisfied: '😌',
    laughing: '😂',
    affirmative: '👍',
    win: '🏆',
};

const AVATAR_STYLES: Record<string, { initial: string; bg: string }> = {
    Sheldon: { initial: 'S', bg: '#2ecc71' },
    Leonard: { initial: 'L', bg: '#3498db' },
    Penny: { initial: 'P', bg: '#e91e8c' },
    Neighbour: { initial: 'N', bg: '#9b59b6' },
};

function makeEmojiTexture(name: string, size: number): Texture {
    const glyph = EMOJI_GLYPHS[name] ?? '❓';
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.font = `${Math.floor(size * 0.78)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + size * 0.05);

    return Texture.from(cv);
}

function makeAvatarCanvas(name: string, size: number): HTMLCanvasElement {
    const style = AVATAR_STYLES[name] ?? { initial: name[0].toUpperCase(), bg: '#6655aa' };
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d')!;

    ctx.fillStyle = style.bg;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.44)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.initial, size / 2, size / 2 + size * 0.03);

    return cv;
}

async function tryLoadRemoteTexture(url: string): Promise<Texture | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        return await new Promise<Texture | null>((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const w = img.naturalWidth || 100;
                    const h = img.naturalHeight || 100;
                    const cv = document.createElement('canvas');
                    cv.width = w; cv.height = h;
                    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
                    ctx.drawImage(img, 0, 0);
                    resolve(Texture.from(cv));
                } catch { resolve(null); }
                finally { URL.revokeObjectURL(blobUrl); }
            };
            img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
            img.src = blobUrl;
        });
    } catch { return null; }
}

export class MagicWords extends Container implements IScene {

    private data: APIData | null = null;

    private emojiTextures = new Map<string, Texture>();
    private avatarCanvases = new Map<string, HTMLCanvasElement>();
    private chatContainer!: Container;
    private chatMask!: Graphics;
    private bg!: Graphics;

    private cursorY = 0;
    private contentH = 0;
    private scrollY = 0;
    private targetScroll = 0;

    private revealIdx = 0;
    private revealTimer = 0;
    private revealDone = false;

    private dragActive = false;
    private dragStartY = 0;
    private dragScrollBase = 0;

    private readonly resizeHandler = () => this.onResize();

    public init(): void {
        this.buildBg();
        this.buildHeader();
        this.buildChatArea();
        this.onResize();
        window.addEventListener('resize', this.resizeHandler);
        this.loadData();
    }

    public update(deltaMS: number): void {
        if (!this.data) return;
        const dt = deltaMS / 1000;

        if (!this.revealDone) {
            this.revealTimer -= dt;
            if (this.revealTimer <= 0) {
                if (this.revealIdx < this.data.dialogue.length) {
                    this.showNextMessage();
                    this.revealTimer = MSG_DELAY_S;
                } else {
                    this.revealDone = true;
                }
            }
        }

        const diff = this.targetScroll - this.scrollY;
        if (Math.abs(diff) > 0.3) {
            this.scrollY += diff * Math.min(dt * 14, 1);
            this.chatContainer.y = this.chatTop - this.scrollY;
        }
    }

    public destroy(): void {
        window.removeEventListener('resize', this.resizeHandler);
        this.removeEvents();
        super.destroy({ children: true });
    }

    private async loadData(): Promise<void> {
        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('network');
            this.data = await res.json() as APIData;
        } catch {
            this.data = FALLBACK_DATA;
        }

        this.data.avatars = this.data.avatars.map(a => ({
            ...a,
            url: a.url.replace(':81/', '/'),
        }));

        this.data = this.patchMissingEmojis(this.data);
        this.buildLocalTextures();
        this.addEvents();
        this.revealTimer = 0.2;
        this.upgradeToRemoteTextures();
    }

    private buildLocalTextures(): void {
        if (!this.data) return;

        for (const e of this.data.emojies) {
            this.emojiTextures.set(e.name, makeEmojiTexture(e.name, EMOJI_SIZE));
        }

        for (const a of this.data.avatars) {
            this.avatarCanvases.set(a.name, makeAvatarCanvas(a.name, AVATAR_SIZE));
        }
    }

    private async upgradeToRemoteTextures(): Promise<void> {
        if (!this.data) return;

        await Promise.all([
            ...this.data.emojies.map(async (e) => {
                const t = await tryLoadRemoteTexture(e.url);
                if (t) this.emojiTextures.set(e.name, t);
            }),
            ...this.data.avatars.map(async (a) => {
                void a;
            }),
        ]);
    }

    private patchMissingEmojis(data: APIData): APIData {
        const known = new Set(data.emojies.map(e => e.name));
        const extras: EmojiDef[] = [];
        for (const line of data.dialogue) {
            for (const [, name] of line.text.matchAll(/\{([^}]+)\}/g)) {
                if (!known.has(name)) {
                    known.add(name);
                    extras.push({ name, url: `https://api.dicebear.com/9.x/fun-emoji/png?seed=${encodeURIComponent(name)}` });
                }
            }
        }
        return { ...data, emojies: [...data.emojies, ...extras] };
    }

    private buildBg(): void {
        this.bg = new Graphics();
        this.bg.label = 'bg';
        this.addChild(this.bg);
    }

    private buildHeader(): void {
        const hdr = new Container();
        hdr.label = 'header';
        const hBg = new Graphics();
        hBg.label = 'hBg';
        const title = new Text({
            text: '✦  MAGIC WORDS  ✦',
            style: new TextStyle({
                fontFamily: 'Georgia, serif',
                fontSize: 17,
                fill: 0xffffff,
                fontWeight: 'bold',
                letterSpacing: 4,
                dropShadow: { color: 0x000000, blur: 8, distance: 0, alpha: 0.6 },
            }),
        });
        title.anchor.set(0.5);
        title.label = 'title';
        hdr.addChild(hBg, title);
        this.addChild(hdr);
    }

    private buildChatArea(): void {
        this.chatMask = new Graphics();
        this.chatContainer = new Container();
        this.addChild(this.chatMask);
        this.addChild(this.chatContainer);
        this.chatContainer.mask = this.chatMask;
    }

    private showNextMessage(): void {
        if (!this.data) return;
        const line = this.data.dialogue[this.revealIdx++];
        const avDef = this.data.avatars.find(a => a.name === line.name);
        const isRight = avDef?.position === 'right';
        const bubble = isRight
            ? this.buildBubbleRight(line)
            : this.buildBubbleLeft(line);
        const bh: number = (bubble as any)._bubbleHeight ?? 80;

        bubble.alpha = 0;
        bubble.y = this.cursorY;
        this.chatContainer.addChild(bubble);

        this.cursorY += bh + MSG_GAP;
        this.contentH = this.cursorY;

        const { width } = App.instance;
        const endX = bubble.x;
        bubble.x = isRight ? endX + width * 0.25 : endX - width * 0.25;
        gsap.to(bubble, { duration: 0.38, x: endX, alpha: 1, ease: 'power2.out' });

        if (this.contentH > this.chatAreaH) {
            this.targetScroll = this.contentH - this.chatAreaH;
        }
    }

    private buildBubbleLeft(line: DialogueLine): Container {
        const { width } = App.instance;
        const maxW = Math.floor(width * BUBBLE_MAX_W);
        const root = new Container();
        const color = this.bubbleColor(line.name);
        const offX = AVATAR_SIZE + 8;

        const nameLbl = this.makeNameLabel(line.name, false);
        nameLbl.x = offX;
        nameLbl.y = 0;

        const content = this.buildRichText(line.text, maxW - BUBBLE_PAD * 2);
        const contentY = nameLbl.height + 4;
        const bw = Math.max(content.width, nameLbl.width) + BUBBLE_PAD * 2;
        const bh = content.height + BUBBLE_PAD * 2;

        content.x = offX + BUBBLE_PAD;
        content.y = contentY + BUBBLE_PAD;

        const bg = new Graphics();
        bg.roundRect(offX, contentY, bw, bh, 10);
        bg.fill({ color, alpha: 0.93 });
        bg.moveTo(offX, contentY + 12);
        bg.lineTo(offX - 7, contentY + 18);
        bg.lineTo(offX, contentY + 25);
        bg.fill({ color, alpha: 0.93 });

        const avCanvas = this.avatarCanvases.get(line.name) ?? makeAvatarCanvas(line.name, AVATAR_SIZE);
        const avatar = this.makeAvatarSprite(avCanvas);
        avatar.x = 0;
        avatar.y = contentY + bh / 2 - AVATAR_SIZE / 2;

        root.addChild(bg, nameLbl, content, avatar);
        root.x = 14;
        (root as any)._bubbleHeight = contentY + bh + 4;
        return root;
    }

    private buildBubbleRight(line: DialogueLine): Container {
        const { width } = App.instance;
        const maxW = Math.floor(width * BUBBLE_MAX_W);
        const rightEdge = width - 14;
        const root = new Container();
        const color = this.bubbleColor(line.name);

        const content = this.buildRichText(line.text, maxW - BUBBLE_PAD * 2);
        const bw = Math.max(content.width, 40) + BUBBLE_PAD * 2;
        const bh = content.height + BUBBLE_PAD * 2;

        const nameLbl = this.makeNameLabel(line.name, true);
        nameLbl.x = rightEdge - AVATAR_SIZE - nameLbl.width - 4;
        nameLbl.y = 0;

        const avCanvas = this.avatarCanvases.get(line.name) ?? makeAvatarCanvas(line.name, AVATAR_SIZE);
        const avatar = this.makeAvatarSprite(avCanvas);
        avatar.x = rightEdge - AVATAR_SIZE;

        const bgX = rightEdge - AVATAR_SIZE - 8 - bw;
        const bgY = nameLbl.height + 4;

        const bg = new Graphics();
        bg.roundRect(bgX, bgY, bw, bh, 10);
        bg.fill({ color, alpha: 0.93 });
        const tailX = bgX + bw;
        bg.moveTo(tailX, bgY + 12);
        bg.lineTo(tailX + 7, bgY + 18);
        bg.lineTo(tailX, bgY + 25);
        bg.fill({ color, alpha: 0.93 });

        content.x = bgX + BUBBLE_PAD;
        content.y = bgY + BUBBLE_PAD;
        avatar.y = bgY + bh / 2 - AVATAR_SIZE / 2;

        root.addChild(bg, nameLbl, content, avatar);
        root.x = 0;
        // Store actual pixel height so showNextMessage can read it without bounds calls
        (root as any)._bubbleHeight = bgY + bh + 4;
        return root;
    }

    private buildRichText(rawText: string, maxWidth: number): Container {
        const root = new Container();
        let cx = 0;
        let cy = 0;
        const newLine = () => { cx = 0; cy += LINE_HEIGHT; };

        const parts = rawText.split(/(\{[^}]+\})/g);

        for (const part of parts) {
            if (!part) continue;
            const tokenMatch = part.match(/^\{([^}]+)\}$/);

            if (tokenMatch) {
                const emojiName = tokenMatch[1];
                const tex = this.emojiTextures.get(emojiName)
                    ?? makeEmojiTexture(emojiName, EMOJI_SIZE);

                if (cx + EMOJI_SIZE > maxWidth && cx > 0) newLine();

                const sp = new Sprite(tex);
                sp.width = EMOJI_SIZE;
                sp.height = EMOJI_SIZE;
                sp.x = cx;
                sp.y = cy + Math.floor((LINE_HEIGHT - EMOJI_SIZE) / 2);
                root.addChild(sp);
                cx += EMOJI_SIZE + 4;

            } else {
                const words = part.split(' ');
                for (const word of words) {
                    if (!word) continue;
                    const probe = new Text({ text: word, style: this.txtStyle });
                    const ww = probe.width;
                    const gap = cx > 0 ? 4 : 0;

                    if (cx + gap + ww > maxWidth && cx > 0) {
                        probe.destroy();
                        newLine();
                        const n = new Text({ text: word, style: this.txtStyle });
                        n.x = 0; n.y = cy;
                        root.addChild(n);
                        cx = n.width + 4;
                    } else {
                        probe.x = cx + gap;
                        probe.y = cy;
                        root.addChild(probe);
                        cx += gap + ww;
                    }
                }
            }
        }

        return root;
    }

    private readonly txtStyle = new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: FONT_SIZE,
        fill: 0xeeeeff,
        lineHeight: LINE_HEIGHT,
    });

    private makeAvatarSprite(srcCanvas: HTMLCanvasElement): Sprite {
        const S = AVATAR_SIZE;
        const cv = document.createElement('canvas');
        cv.width = S;
        cv.height = S;
        const ctx = cv.getContext('2d')!;

        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(srcCanvas, 0, 0, S, S);

        const sp = new Sprite(Texture.from(cv));
        sp.width = S;
        sp.height = S;
        return sp;
    }

    private makeNameLabel(name: string, isRight: boolean): Text {
        return new Text({
            text: name,
            style: new TextStyle({
                fontFamily: 'Georgia, serif',
                fontSize: 11,
                fill: isRight ? 0xaacca0 : 0xaaaacc,
                fontWeight: 'bold',
                letterSpacing: 0.5,
            }),
        });
    }

    private bubbleColor(name: string): number {
        const map: Record<string, number> = {
            Sheldon: 0x1a3554,
            Leonard: 0x1e4020,
            Penny: 0x4a1838,
            Neighbour: 0x2a2a3a,
        };
        return map[name] ?? 0x2a2a3a;
    }

    private get chatTop(): number { return HEADER_H + 8; }
    private get chatAreaH(): number { return App.instance.height - this.chatTop - 8; }
    private get maxScroll(): number { return Math.max(0, this.contentH - this.chatAreaH); }

    private addEvents(): void {
        this.eventMode = 'static';
        this.hitArea = { contains: () => true } as any;
        this.on('pointerdown', this.onDown, this);
        this.on('pointermove', this.onMove, this);
        this.on('pointerup', this.onUp, this);
        this.on('pointerupoutside', this.onUp, this);
        this.on('wheel', this.onWheel as any, this);
    }

    private removeEvents(): void {
        this.off('pointerdown', this.onDown, this);
        this.off('pointermove', this.onMove, this);
        this.off('pointerup', this.onUp, this);
        this.off('pointerupoutside', this.onUp, this);
        this.off('wheel', this.onWheel as any, this);
    }

    private onDown = (e: { global: { y: number } }) => {
        this.dragActive = true;
        this.dragStartY = e.global.y;
        this.dragScrollBase = this.targetScroll;
    };
    private onMove = (e: { global: { y: number } }) => {
        if (!this.dragActive) return;
        this.targetScroll = Math.max(0, Math.min(
            this.maxScroll, this.dragScrollBase + (this.dragStartY - e.global.y),
        ));
    };
    private onUp = () => { this.dragActive = false; };
    private onWheel = (e: WheelEvent) => {
        this.targetScroll = Math.max(0, Math.min(
            this.maxScroll, this.targetScroll + e.deltaY * 0.6,
        ));
    };

    private onResize(): void {
        const { width, height } = App.instance;

        this.bg.clear();
        this.bg.rect(0, 0, width, height);
        this.bg.fill({ color: 0x0f0d1a });

        const hdr = this.getChildByLabel('header') as Container | null;
        if (hdr) {
            const hBg = hdr.getChildByLabel('hBg') as Graphics | null;
            if (hBg) {
                hBg.clear();
                hBg.rect(0, 0, width, HEADER_H);
                hBg.fill({ color: 0x1a1630 });
                hBg.rect(0, HEADER_H - 2, width, 2);
                hBg.fill({ color: 0x6c63ff });
            }
            const title = hdr.getChildByLabel('title') as Text | null;
            if (title) title.position.set(width / 2, HEADER_H / 2);
        }

        if (this.chatMask) {
            this.chatMask.clear();
            this.chatMask.rect(0, this.chatTop, width, this.chatAreaH);
            this.chatMask.fill({ color: 0xffffff });
        }

        this.chatContainer.y = this.chatTop - this.scrollY;
    }
}

const FALLBACK_DATA: APIData = {
    dialogue: [
        { name: 'Sheldon', text: 'I admit {satisfied} the design of Cookie Crush is quite elegant in its simplicity.' },
        { name: 'Leonard', text: "That's practically a compliment, Sheldon. {intrigued} Are you feeling okay?" },
        { name: 'Penny', text: "Don't worry, Leonard. He's probably just trying to justify playing it himself." },
        { name: 'Sheldon', text: "Incorrect. {neutral} I'm studying its mechanics. The progression system is oddly satisfying." },
        { name: 'Penny', text: "It's called fun, Sheldon. You should try it more often." },
        { name: 'Leonard', text: "She's got a point. Sometimes, a simple game can be relaxing." },
        { name: 'Neighbour', text: 'I fully agree {affirmative}' },
        { name: 'Sheldon', text: "Relaxing? I suppose there's merit in low-stakes gameplay to reduce cortisol levels." },
        { name: 'Penny', text: "Translation: Sheldon likes crushing cookies but won't admit it. {laughing}" },
        { name: 'Sheldon', text: 'Fine. I find the color-matching oddly soothing. Happy?' },
        { name: 'Leonard', text: 'Very. Now we can finally play as a team in Wordscapes.' },
        { name: 'Penny', text: "Wait, Sheldon's doing team games now? What's next, co-op decorating?" },
        { name: 'Sheldon', text: 'Unlikely. But if the design involves symmetry and efficiency, I may consider it.' },
        { name: 'Penny', text: 'See? Casual gaming brings people together!' },
        { name: 'Leonard', text: "Even Sheldon. That's a win for everyone. {win}" },
        { name: 'Sheldon', text: "Agreed. {neutral} Though I still maintain chess simulators are superior." },
        { name: 'Penny', text: "Sure, Sheldon. {intrigued} You can play chess *after* we beat this next level." },
    ],
    emojies: [
        { name: 'sad', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Sad' },
        { name: 'intrigued', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Sawyer' },
        { name: 'neutral', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Destiny' },
        { name: 'satisfied', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Jocelyn' },
        { name: 'laughing', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Sophia' },
    ],
    avatars: [
        { name: 'Sheldon', url: 'https://api.dicebear.com/9.x/personas/png?body=squared&clothingColor=6dbb58&eyes=open&hair=buzzcut&hairColor=6c4545&mouth=smirk&nose=smallRound&skinColor=e5a07e', position: 'left' },
        { name: 'Penny', url: 'https://api.dicebear.com/9.x/personas/png?body=squared&clothingColor=f55d81&eyes=happy&hair=extraLong&hairColor=f29c65&mouth=smile&nose=smallRound&skinColor=e5a07e', position: 'right' },
        { name: 'Leonard', url: 'https://api.dicebear.com/9.x/personas/png?body=checkered&clothingColor=f3b63a&eyes=glasses&hair=shortCombover&hairColor=362c47&mouth=surprise&nose=mediumRound&skinColor=d78774', position: 'right' },
    ],
};