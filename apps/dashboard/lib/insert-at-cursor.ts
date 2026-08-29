/** Insert `token` at the caret of a text field, updating the controlled value. */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  token: string,
  onChange: (next: string) => void,
) {
  if (!el) {
    onChange(current + token);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  onChange(current.slice(0, start) + token + current.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}
