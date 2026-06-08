import DsNav from '../components/ds/DsNav';

// TODO: gerçek Kodlarım ekranı (TC → düz liste, sade kart) sonraki turda.
export default function MyCodes() {
  return (
    <div className="ds">
      <DsNav />
      <div className="ds-container">
        <header className="ds-hero">
          <span className="ds-eyebrow">Üyelere Özel</span>
          <h1 className="ds-h1">Kodlarım</h1>
          <p className="ds-sub">
            T.C. kimlik numaranızla daha önce aldığınız tüm indirim kodlarını burada göreceksiniz.
          </p>
        </header>
        <div className="ds-empty">Bu ekran çok yakında…</div>
      </div>
    </div>
  );
}
