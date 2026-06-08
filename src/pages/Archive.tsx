import DsNav from '../components/ds/DsNav';

// TODO: gerçek Arşiv ekranı (biten + arşivlenen, tıklanamaz kartlar) sonraki turda.
export default function Archive() {
  return (
    <div className="ds">
      <DsNav />
      <div className="ds-container">
        <header className="ds-hero">
          <span className="ds-eyebrow">Geçmiş</span>
          <h1 className="ds-h1">Arşiv</h1>
          <p className="ds-sub">Süresi geçmiş ve arşivlenmiş kampanyalar burada listelenecek.</p>
        </header>
        <div className="ds-empty">Bu ekran çok yakında…</div>
      </div>
    </div>
  );
}
