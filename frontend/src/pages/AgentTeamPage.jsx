import { useEffect, useMemo, useState } from 'react';
import { Avatar, EmptyState, Skeleton, SkeletonCard, getInitials } from '../components/Common';
import { getAgents, getTickets } from '../services/api';

const TEAM_COLOR = {
  'IT Destek':      { bg: '#e8f0fe', color: '#1a56db' },
  'Bakım & Arıza':  { bg: '#fde8e8', color: '#c81e1e' },
  'Üretim':         { bg: '#fef3c7', color: '#92400e' },
  'Kalite Kontrol': { bg: '#d1fae5', color: '#065f46' },
  'Genel':          { bg: '#f3f4f6', color: '#374151' },
};

function TeamBadge({ team }) {
  const c = TEAM_COLOR[team] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
      fontSize: 12, fontWeight: 600, background: c.bg, color: c.color,
    }}>
      {team}
    </span>
  );
}

export default function AgentTeamPage() {
  const [agents, setAgents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getAgents(), getTickets()])
      .then(([a, t]) => {
        setAgents(a);
        setTickets(t);
        // mevcut kullanıcıyı token'dan bul
        try {
          const raw = localStorage.getItem('kc_token') || sessionStorage.getItem('kc_token');
          if (raw) {
            const payload = JSON.parse(atob(raw.split('.')[1]));
            const me = a.find(ag => ag.email === payload.email || ag.name === payload.name);
            if (me) setCurrentUser(me);
          }
        } catch { /* ignore */ }
      })
      .finally(() => setLoading(false));
  }, []);

  // Ekip → üyeler gruplandır
  const teamGroups = useMemo(() => {
    const groups = {};
    agents.forEach((a) => {
      const key = a.team || '—';
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        ...a,
        openCount: tickets.filter(t => t.assignedAgentId === a.id && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
        resolvedCount: tickets.filter(t => t.assignedAgentId === a.id && ['RESOLVED', 'CLOSED'].includes(t.status)).length,
        breachedCount: tickets.filter(t => t.assignedAgentId === a.id && t.slaBreached && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
      });
    });
    // ekip ismine göre sırala, atamasız en sona
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '—') return 1;
      if (b === '—') return -1;
      return a.localeCompare(b, 'tr');
    });
  }, [agents, tickets]);

  if (loading) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="page-head">
            <div>
              <h1 className="page-title">Ekibim</h1>
              <Skeleton width={160} height={13} style={{ marginTop: 6 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card card-pad">
                <SkeletonCard rows={3} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="page-head">
          <div>
            <h1 className="page-title">Ekibim</h1>
            <div className="page-sub">{agents.length} destek uzmanı · {teamGroups.length} ekip</div>
          </div>
        </div>

        {teamGroups.length === 0 ? (
          <EmptyState type="team" title="Henüz ekip yok" sub="Yönetici ekip atamalarını Ekip sayfasından yapabilir." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {teamGroups.map(([teamName, members]) => (
              <div key={teamName} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Ekip başlığı */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--hairline)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--bg-soft)',
                }}>
                  {teamName !== '—'
                    ? <TeamBadge team={teamName} />
                    : <span style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>Ekip atanmamış</span>
                  }
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{members.length} kişi</span>
                </div>

                {/* Üye listesi */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                  {members.map((member, idx) => (
                    <div
                      key={member.id}
                      style={{
                        padding: '16px 20px',
                        borderRight: (idx + 1) % 2 === 1 ? '1px solid var(--hairline)' : 'none',
                        borderBottom: '1px solid var(--hairline)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <Avatar initials={getInitials(member.name)} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {member.name}
                            {currentUser && member.id === currentUser.id && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>(sen)</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{member.email}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                          <div style={{
                            fontSize: 22, fontWeight: 700, lineHeight: 1,
                            color: member.openCount > 5 ? 'var(--err)' : member.openCount > 2 ? 'var(--warn)' : 'var(--text)',
                          }}>
                            {member.openCount}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>açık</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--ok)' }}>
                            {member.resolvedCount}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>çözülen</div>
                        </div>
                        {member.breachedCount > 0 && (
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--err)' }}>
                              {member.breachedCount}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>SLA ihlal</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
