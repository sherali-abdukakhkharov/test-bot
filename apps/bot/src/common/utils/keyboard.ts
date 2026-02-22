import { InlineKeyboard, Keyboard } from 'grammy';

/** Build a single-column inline keyboard from a list of [label, callbackData] pairs */
export function inlineColumn(buttons: Array<[string, string]>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const [label, data] of buttons) {
    kb.text(label, data).row();
  }
  return kb;
}

/** Build a two-column grid from labels array (each label is its own callback data) */
export function inlineGrid(items: Array<{ label: string; data: string }>, cols = 2): InlineKeyboard {
  const kb = new InlineKeyboard();
  items.forEach((item, i) => {
    kb.text(item.label, item.data);
    if ((i + 1) % cols === 0) kb.row();
  });
  return kb;
}

/** Standard main menu reply keyboard */
export function mainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text('📚 Test ishlash').row()
    .text('📖 Qo\'llanma').text('📊 Natijalar').row()
    .text('💬 Yordam').row()
    .resized();
}

/** Admin main menu reply keyboard */
export function adminMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text('📂 Bo\'limlar').text('📝 Savollar').row()
    .text('👥 Foydalanuvchilar').text('📊 Statistika').row()
    .text('📢 E\'lon').text('📖 Qo\'llanma').row()
    .text('💬 Yordam').text('⚙️ Sozlamalar').row()
    .resized();
}
