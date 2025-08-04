export function createAdminUI(onToggle, onExport) {
  const panel = document.createElement('div');
  panel.id = 'admin-panel';
  panel.innerHTML = `
    <button id="admin-toggle" class="control-btn">Admin Mode</button>
    <button id="export-btn" class="control-btn">Export GeoJSON</button>
  `;
  document.body.appendChild(panel);
  const toggle = panel.querySelector('#admin-toggle');
  const exportBtn = panel.querySelector('#export-btn');
  toggle.addEventListener('click', () => onToggle());
  exportBtn.addEventListener('click', () => onExport());
  return { panel, toggle, exportBtn };
}
