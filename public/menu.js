/**
 * ヘッダーナビゲーションメニュー (ドロップダウン開閉)
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('menuToggleBtn');
  const dropdown = document.getElementById('headerDropdown');
  if (!toggleBtn || !dropdown) return;

  function toggleMenu(forceState) {
    const isExpanded = forceState !== undefined ? forceState : dropdown.hidden;
    dropdown.hidden = !isExpanded;
    toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    toggleBtn.classList.toggle('active', isExpanded);
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // ドロップダウン外のクリックで閉じる
  document.addEventListener('click', (e) => {
    if (!dropdown.hidden && !dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
      toggleMenu(false);
    }
  });

  // Esc キーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) {
      toggleMenu(false);
    }
  });
});
