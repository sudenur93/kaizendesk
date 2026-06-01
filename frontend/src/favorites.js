// Talep favorileri — kullanıcı bazlı, tarayıcıda (localStorage) saklanır.
// Anahtar kullanıcı adına göre ayrılır ki aynı tarayıcıda farklı hesaplar karışmasın.
// clearSession (api.js) 'kz_fav_' önekli anahtarları çıkışta korur.
import { getUsername } from './services/api';

function favKey() {
  return 'kz_fav_' + (getUsername() || 'anon');
}

export function getFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(favKey()) || '[]'));
  } catch {
    return new Set();
  }
}

export function isFavorite(id) {
  return getFavorites().has(id);
}

export function toggleFavorite(id) {
  const s = getFavorites();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  localStorage.setItem(favKey(), JSON.stringify([...s]));
  // Aynı sayfadaki bileşenler anında güncellensin
  window.dispatchEvent(new Event('favorites-change'));
  return s.has(id);
}
