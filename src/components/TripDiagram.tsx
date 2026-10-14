import { t } from '../i18n.ts'
export function TripDiagram() {
  return (
    <div className="diagram">
      <svg viewBox="0 0 420 300" role="img" aria-label={t('Trip at the center, linked to Skyhop flights, a MyMaps AI map, destinations and stays')}>
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" className="arrowhead" />
          </marker>
        </defs>
        <g className="edges">
          <path d="M150 150 H96" markerEnd="url(#ah)" />
          <path d="M270 150 H324" markerEnd="url(#ah)" />
          <path d="M210 112 V70" markerEnd="url(#ah)" />
          <path d="M210 188 V230" markerEnd="url(#ah)" />
        </g>
        <rect x="150" y="112" width="120" height="76" rx="12" className="node node--trip" />
        <text x="210" y="146" textAnchor="middle" className="node-title">Trip</text>
        <text x="210" y="166" textAnchor="middle" className="sub">dates · travelers</text>

        <rect x="8" y="118" width="88" height="64" rx="10" className="node node--sky" />
        <text x="52" y="146" textAnchor="middle" className="t-sky">Skyhop</text>
        <text x="52" y="164" textAnchor="middle" className="sub">flights[]</text>

        <rect x="324" y="118" width="88" height="64" rx="10" className="node node--map" />
        <text x="368" y="146" textAnchor="middle" className="t-map">MyMaps</text>
        <text x="368" y="164" textAnchor="middle" className="sub">days[]</text>

        <rect x="150" y="10" width="120" height="58" rx="10" className="node" />
        <text x="210" y="36" textAnchor="middle" className="t-strong">destinations</text>
        <text x="210" y="54" textAnchor="middle" className="sub">arrive · depart</text>

        <rect x="150" y="232" width="120" height="58" rx="10" className="node" />
        <text x="210" y="258" textAnchor="middle" className="t-strong">stays</text>
        <text x="210" y="276" textAnchor="middle" className="sub">check-in · out</text>
      </svg>
    </div>
  )
}
