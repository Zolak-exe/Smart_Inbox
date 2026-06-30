const fs = require('fs');
const path = require('path');
const f = path.join(process.env.HOME, '.zshrc');
let c = fs.readFileSync(f, 'utf8');

// 1. Fix openclaw (si la ligne 164 n'a pas encore été modifiée)
c = c.replace(/source \/home\/zolak\/\.openclaw\/completions\/openclaw\.zsh/, '[ -f /home/zolak/.openclaw/completions/openclaw.zsh ] && source /home/zolak/.openclaw/completions/openclaw.zsh');

// 2. Le nouveau logo Slant épuré
const newAscii = `       ______  ____   _         _     _  __
      |_  /  \\/  | | | |       / \\   | |/ /
       / /| |\\/| | | | |      / _ \\  | ' / 
      / /_| |  | | |_| |___  / ___ \\ | . \\ 
     /____|_|  |_|____|_____/_/   \\_\\_|_|\\_\\`;

// On cible le bloc ASCII peu importe ses espaces ou ses barres cassées
c = c.replace(/(_+[\s\S]*?\\_\\_\\_\\_\\_)|(\|__[\s\S]*?\\_\\_)/, newAscii);

fs.writeFileSync(f, c);
