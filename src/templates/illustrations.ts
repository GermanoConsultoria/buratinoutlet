export interface DecorEmoji {
  emoji: string;
  x: string;
  y: string;
  size?: string;
  rotate?: string;
  opacity?: number;
}

export interface IllustrationConfig {
  gradient: string;
  mainEmoji: string;
  mainEmojiSize: string;
  mainEmojiX?: string;
  mainEmojiY?: string;
  decor?: DecorEmoji[];
  overlayText?: string;
  buttonColor: string;
  buttonTextColor?: string;
}

export const ILLUSTRATIONS: Record<string, IllustrationConfig> = {
  default: {
    gradient: 'linear-gradient(135deg, #040d1f 0%, #0d2050 40%, #1a3a7a 70%, #0d2050 100%)',
    mainEmoji: '💎',
    mainEmojiSize: '70px',
    mainEmojiX: '50%',
    mainEmojiY: '42%',
    decor: [
      { emoji: '✨', x: '12%', y: '18%', size: '22px', opacity: 0.9 },
      { emoji: '⭐', x: '80%', y: '22%', size: '20px', opacity: 0.8 },
      { emoji: '🔹', x: '78%', y: '68%', size: '18px', opacity: 0.7 },
      { emoji: '🔷', x: '10%', y: '65%', size: '24px', opacity: 0.6 },
      { emoji: '✦',  x: '55%', y: '15%', size: '16px', opacity: 0.7 },
    ],
    buttonColor: '#2563eb',
  },
  christmas: {
    gradient: 'linear-gradient(180deg, #7a0000 0%, #b71c1c 20%, #1b5e20 55%, #0a2e0a 100%)',
    mainEmoji: '🎄',
    mainEmojiSize: '80px',
    mainEmojiX: '50%',
    mainEmojiY: '48%',
    decor: [
      { emoji: '⭐', x: '48%', y: '4%',  size: '28px' },
      { emoji: '🎁', x: '12%', y: '62%', size: '32px' },
      { emoji: '🎁', x: '68%', y: '58%', size: '26px' },
      { emoji: '❄️', x: '80%', y: '18%', size: '20px', opacity: 0.85 },
      { emoji: '❄️', x: '8%',  y: '28%', size: '16px', opacity: 0.7 },
      { emoji: '❄️', x: '85%', y: '50%', size: '14px', opacity: 0.6 },
    ],
    buttonColor: '#2e7d32',
  },
  carnaval: {
    gradient: 'linear-gradient(135deg, #1a0040 0%, #4a0080 30%, #8b007a 65%, #c0005a 100%)',
    mainEmoji: '🎭',
    mainEmojiSize: '80px',
    mainEmojiX: '50%',
    mainEmojiY: '44%',
    decor: [
      { emoji: '🪅', x: '10%', y: '15%', size: '28px', rotate: '-15deg' },
      { emoji: '✨', x: '80%', y: '12%', size: '22px' },
      { emoji: '🎊', x: '75%', y: '60%', size: '26px' },
      { emoji: '💫', x: '8%',  y: '68%', size: '24px' },
      { emoji: '🌟', x: '50%', y: '8%',  size: '18px' },
    ],
    buttonColor: '#7b1fa2',
  },
  halloween: {
    gradient: 'linear-gradient(180deg, #0a0500 0%, #1e0a00 25%, #3d1a00 55%, #5a2800 80%, #1a0a00 100%)',
    mainEmoji: '🎃',
    mainEmojiSize: '68px',
    mainEmojiX: '32%',
    mainEmojiY: '52%',
    decor: [
      { emoji: '🦇', x: '12%', y: '12%', size: '26px' },
      { emoji: '🦇', x: '72%', y: '8%',  size: '20px', rotate: '-20deg' },
      { emoji: '🎃', x: '64%', y: '50%', size: '44px' },
      { emoji: '🌙', x: '80%', y: '15%', size: '28px' },
      { emoji: '🕷️', x: '88%', y: '55%', size: '22px' },
      { emoji: '💀', x: '6%',  y: '60%', size: '20px', opacity: 0.7 },
    ],
    buttonColor: '#e65100',
  },
  newYear: {
    gradient: 'linear-gradient(135deg, #01001a 0%, #030330 40%, #060650 70%, #0a0a3a 100%)',
    mainEmoji: '🎆',
    mainEmojiSize: '60px',
    mainEmojiX: '22%',
    mainEmojiY: '42%',
    overlayText: '2025',
    decor: [
      { emoji: '🎇', x: '68%', y: '10%', size: '32px' },
      { emoji: '✨', x: '10%', y: '20%', size: '20px' },
      { emoji: '🌟', x: '80%', y: '62%', size: '24px' },
      { emoji: '⭐', x: '15%', y: '68%', size: '18px', opacity: 0.8 },
      { emoji: '💫', x: '50%', y: '8%',  size: '20px', opacity: 0.9 },
    ],
    buttonColor: '#b8860b',
  },
  easter: {
    gradient: 'linear-gradient(135deg, #f48fb1 0%, #ce93d8 35%, #b39ddb 65%, #90caf9 100%)',
    mainEmoji: '🐰',
    mainEmojiSize: '80px',
    mainEmojiX: '50%',
    mainEmojiY: '50%',
    decor: [
      { emoji: '🥚', x: '10%', y: '20%', size: '28px', rotate: '-15deg' },
      { emoji: '🌸', x: '78%', y: '15%', size: '26px' },
      { emoji: '🥚', x: '74%', y: '62%', size: '32px', rotate: '10deg' },
      { emoji: '🌼', x: '8%',  y: '65%', size: '24px' },
      { emoji: '🦋', x: '45%', y: '8%',  size: '22px' },
    ],
    buttonColor: '#d81b60',
    buttonTextColor: '#fff',
  },
  winter: {
    gradient: 'linear-gradient(180deg, #b3e5fc 0%, #81d4fa 25%, #4fc3f7 50%, #2196f3 75%, #1565c0 100%)',
    mainEmoji: '⛄',
    mainEmojiSize: '72px',
    mainEmojiX: '50%',
    mainEmojiY: '52%',
    decor: [
      { emoji: '❄️', x: '10%', y: '12%', size: '26px' },
      { emoji: '❄️', x: '80%', y: '18%', size: '22px' },
      { emoji: '🌨️', x: '75%', y: '60%', size: '28px', opacity: 0.85 },
      { emoji: '❄️', x: '12%', y: '68%', size: '18px', opacity: 0.75 },
      { emoji: '🏔️', x: '42%', y: '6%',  size: '28px', opacity: 0.9 },
    ],
    buttonColor: '#1565c0',
  },
  summer: {
    gradient: 'linear-gradient(180deg, #ffd600 0%, #ff6f00 22%, #e64a19 40%, #0288d1 65%, #01579b 100%)',
    mainEmoji: '🏖️',
    mainEmojiSize: '68px',
    mainEmojiX: '50%',
    mainEmojiY: '56%',
    decor: [
      { emoji: '☀️', x: '72%', y: '4%',  size: '46px' },
      { emoji: '🌴', x: '80%', y: '38%', size: '44px' },
      { emoji: '🌊', x: '8%',  y: '65%', size: '28px' },
      { emoji: '⛱️', x: '8%',  y: '20%', size: '32px' },
      { emoji: '🐚', x: '60%', y: '72%', size: '20px' },
    ],
    buttonColor: '#e64a19',
  },
  darkPremium: {
    gradient: 'linear-gradient(135deg, #050505 0%, #0a0a0a 30%, #14100a 60%, #1a1400 100%)',
    mainEmoji: '👑',
    mainEmojiSize: '68px',
    mainEmojiX: '50%',
    mainEmojiY: '38%',
    decor: [
      { emoji: '🛡️', x: '50%', y: '56%', size: '52px' },
      { emoji: '💎', x: '14%', y: '20%', size: '22px', opacity: 0.9 },
      { emoji: '✨', x: '80%', y: '16%', size: '20px', opacity: 0.8 },
      { emoji: '⭐', x: '78%', y: '68%', size: '18px', opacity: 0.7 },
      { emoji: '✦',  x: '12%', y: '70%', size: '16px', opacity: 0.6 },
    ],
    buttonColor: '#8b6914',
  },
};
