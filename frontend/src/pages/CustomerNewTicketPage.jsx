import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import {
  createTicket,
  getCategories,
  getIssueTypes,
  getProducts,
  uploadTicketAttachment,
} from '../services/api';

const TITLE_MIN = 6;
const TITLE_MAX = 200;
const DESC_MIN = 20;
const DESC_MAX = 1000;
const FILE_MAX_MB = 20;
const FILE_MAX_BYTES = FILE_MAX_MB * 1024 * 1024;

const PRIORITIES = [
  { key: 'LOW', label: 'Düşük', sla: '24 saat' },
  { key: 'MEDIUM', label: 'Orta', sla: '12 saat' },
  { key: 'HIGH', label: 'Yüksek', sla: '8 saat' },
];

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

export default function CustomerNewTicketPage() {
  const navigate = useNavigate();
  const { pushToast } = useOutletContext() || {};

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);

  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [issueTypeId, setIssueTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [files, setFiles] = useState([]);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingMeta(true);
      try {
        const data = await getProducts();
        if (!cancelled) setProducts(data);
      } catch {
        if (!cancelled) setError('Ürünler yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!productId) {
        setCategories([]);
        setCategoryId('');
        setIssueTypes([]);
        setIssueTypeId('');
        return;
      }
      try {
        const data = await getCategories(productId);
        if (cancelled) return;
        setCategories(data);
        setCategoryId('');
        setIssueTypes([]);
        setIssueTypeId('');
      } catch {
        if (!cancelled) setError('Kategori bilgileri yüklenemedi.');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!categoryId) {
        setIssueTypes([]);
        setIssueTypeId('');
        return;
      }
      try {
        const data = await getIssueTypes(categoryId);
        if (cancelled) return;
        setIssueTypes(data);
        setIssueTypeId('');
      } catch {
        if (!cancelled) setError('Sorun tipleri yüklenemedi.');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);
  const totalMB = totalBytes / 1024 / 1024;
  const overLimit = totalBytes > FILE_MAX_BYTES;

  const slaLabel = useMemo(
    () => PRIORITIES.find((p) => p.key === priority)?.sla || '12 saat',
    [priority]
  );

  function findValidationError() {
    if (!productId) return 'Lütfen bir ürün / sistem seçin.';
    if (!categoryId) return 'Lütfen bir kategori seçin.';
    if (title.trim().length < TITLE_MIN)
      return `Başlık en az ${TITLE_MIN} karakter olmalı.`;
    if (title.length > TITLE_MAX)
      return `Başlık en fazla ${TITLE_MAX} karakter olabilir.`;
    if (desc.trim().length < DESC_MIN)
      return `Açıklama en az ${DESC_MIN} karakter olmalı.`;
    if (desc.length > DESC_MAX)
      return `Açıklama en fazla ${DESC_MAX} karakter olabilir.`;
    if (overLimit)
      return `Eklenen dosyaların toplam boyutu ${FILE_MAX_MB} MB sınırını aştı.`;
    return null;
  }

  function addFiles(rawFiles) {
    const list = Array.from(rawFiles || []);
    const accepted = [];
    const rejected = [];
    let running = totalBytes;
    list.forEach((f) => {
      if (f.size > FILE_MAX_BYTES || running + f.size > FILE_MAX_BYTES) {
        rejected.push(f.name);
        return;
      }
      running += f.size;
      accepted.push(f);
    });
    if (accepted.length) setFiles((fs) => [...fs, ...accepted]);
    if (rejected.length && pushToast) pushToast(`Boyut sınırı aşıldı: ${rejected.join(', ')}`);
  }

  function onDrop(e) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  function onPick(e) {
    addFiles(e.target.files);
    e.target.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const validationError = findValidationError();
    if (validationError) {
      setError(validationError);
      if (pushToast) pushToast(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      let resolvedTypes = issueTypes;
      if (resolvedTypes.length === 0) {
        resolvedTypes = await getIssueTypes(categoryId);
        setIssueTypes(resolvedTypes);
      }
      if (resolvedTypes.length === 0) {
        setError('Seçilen kategori için sorun tipi bulunamadı.');
        return;
      }
      const finalIssueTypeId = issueTypeId
        ? Number(issueTypeId)
        : resolvedTypes[0].id;

      const ticket = await createTicket({
        title: title.trim(),
        description: desc.trim(),
        priority,
        productId: Number(productId),
        categoryId: Number(categoryId),
        issueTypeIds: [finalIssueTypeId],
      });

      let uploadFailed = false;
      for (const file of files) {
        try {
          // Sequential upload: backend writes to disk, ordering avoids race
          // eslint-disable-next-line no-await-in-loop
          await uploadTicketAttachment(ticket.id, file);
        } catch {
          uploadFailed = true;
        }
      }

      if (uploadFailed && pushToast) {
        pushToast('Talep oluşturuldu, bazı dosyalar yüklenemedi.');
      } else if (pushToast) {
        pushToast(`#${ticket.id} oluşturuldu`);
      }

      navigate(`/customer/tickets/${ticket.id}`);
    } catch (err) {
      console.error('createTicket failed', err);
      const status = err.response?.status;
      const data = err.response?.data;
      const fieldErrors =
        Array.isArray(data?.errors) && data.errors.length > 0
          ? data.errors.map((e) => e.defaultMessage || e.message).join(' • ')
          : '';
      const baseMessage =
        data?.message ||
        data?.error ||
        fieldErrors ||
        err.message ||
        'Talep oluşturulamadı.';
      const message = status
        ? `Talep oluşturulamadı (HTTP ${status}). ${baseMessage}`
        : `Talep oluşturulamadı. ${baseMessage}`;
      setError(message);
      if (pushToast) pushToast(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  const titleColor =
    title.length > TITLE_MAX
      ? 'var(--err)'
      : title.length > TITLE_MAX * 0.9
        ? 'var(--warn)'
        : 'var(--text-3)';
  const descColor =
    desc.length > DESC_MAX
      ? 'var(--err)'
      : desc.length > DESC_MAX * 0.9
        ? 'var(--warn)'
        : 'var(--text-3)';

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 880 }}>
        <div className="page-head">
          <div>
            <h1 className="page-title">Yeni Destek Talebi</h1>
            <div className="page-sub">
              Bir sistem ve sorun tipi seçin, yaşadığınız problemi anlatın.
            </div>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/customer/tickets')}
            >
              <Ic.X size={12} /> Vazgeç
            </button>
          </div>
        </div>

        {error && (
          <div
            className="badge p-high"
            style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}
          >
            <Ic.AlertTriangle size={13} />
            {error}
          </div>
        )}

        <form
          className="card card-pad"
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          onSubmit={submit}
        >
          <div className="h-grid-2">
            <div className="field">
              <label className="field-label">
                Ürün / Sistem<span className="req">*</span>
              </label>
              <select
                className="select"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={loadingMeta || submitting}
              >
                <option value="">Sistem seçin…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="field-hint">Sorununuzun ait olduğu ana sistemi seçin.</div>
            </div>
            <div className="field">
              <label className="field-label">
                Kategori<span className="req">*</span>
              </label>
              <select
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={!productId || submitting}
              >
                <option value="">{productId ? 'Kategori seçin…' : 'Önce sistem seçin'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="field-hint">Sistem seçildikten sonra kategoriler listelenir.</div>
            </div>
          </div>

          {issueTypes.length > 1 && (
            <div className="field">
              <label className="field-label">Sorun Tipi</label>
              <select
                className="select"
                value={issueTypeId}
                onChange={(e) => setIssueTypeId(e.target.value)}
                disabled={submitting}
              >
                <option value="">Otomatik seç (önerilen)</option>
                {issueTypes.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <div className="field-hint">
                Boş bırakılırsa kategoriye uygun varsayılan sorun tipi kullanılır.
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label">
              Başlık<span className="req">*</span>
              <span className="spacer" />
              <span className="mono" style={{ fontSize: 11, color: titleColor }}>
                {title.length} / {TITLE_MAX}
              </span>
            </label>
            <input
              className="input"
              placeholder="Kısa ve açıklayıcı bir başlık yazın"
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              disabled={submitting}
            />
            <div className="field-hint">
              En az {TITLE_MIN}, en fazla {TITLE_MAX} karakter.
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Detaylı Açıklama<span className="req">*</span>
              <span className="spacer" />
              <span className="mono" style={{ fontSize: 11, color: descColor }}>
                {desc.length} / {DESC_MAX}
              </span>
            </label>
            <textarea
              className="textarea"
              placeholder="Ne zaman başladı, ne tür hatalar görüyorsunuz, hangi adımlarla yeniden üretiliyor?"
              maxLength={DESC_MAX}
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, DESC_MAX))}
              disabled={submitting}
            />
            <div className="field-hint">
              En az {DESC_MIN}, en fazla {DESC_MAX} karakter.
            </div>
          </div>

          <div className="h-grid-2">
            <div className="field">
              <label className="field-label">
                Öncelik<span className="req">*</span>
              </label>
              <div className="row" style={{ gap: 8 }}>
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.key}
                    className={'btn btn-sm' + (priority === p.key ? ' btn-primary' : '')}
                    onClick={() => setPriority(p.key)}
                    disabled={submitting}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="field-hint">
                Yüksek öncelik daha kısa SLA hedef süresine alınır.
              </div>
            </div>
            <div className="field">
              <label className="field-label">Tahmini SLA</label>
              <div className="card" style={{ padding: '12px 14px', background: 'var(--surface-2)' }}>
                <div className="mono" style={{ fontSize: 14 }}>
                  {slaLabel}
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  Çözüm hedefi (iş saatleri içinde)
                </div>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Ek Dosyalar
              <span className="spacer" />
              <span
                className="mono"
                style={{ fontSize: 11, color: overLimit ? 'var(--err)' : 'var(--text-3)' }}
              >
                {totalMB.toFixed(1)} MB / {FILE_MAX_MB} MB
              </span>
            </label>
            <label
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              style={{ cursor: 'pointer', display: 'block' }}
            >
              <input
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={onPick}
                accept=".txt,.docx,.xlsx,.pdf,.png,.jpg,.jpeg,.log"
                disabled={submitting}
              />
              <Ic.Paperclip />
              <div style={{ marginTop: 8 }}>
                Dosyaları sürükleyin veya <strong>seçmek için tıklayın</strong>
              </div>
              <div className="formats">
                <span>txt</span>
                <span>docx</span>
                <span>xlsx</span>
                <span>pdf</span>
                <span>png</span>
                <span>jpeg</span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                Dosya başına ve toplamda en fazla <b>{FILE_MAX_MB} MB</b>
              </div>
            </label>
            {overLimit && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--err)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <Ic.AlertTriangle size={12} /> Toplam boyut {FILE_MAX_MB} MB sınırını aştı.
              </div>
            )}
            {files.length > 0 && (
              <div className="col" style={{ gap: 6, marginTop: 8 }}>
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="row"
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--hairline)',
                      borderRadius: 6,
                    }}
                  >
                    {f.type?.startsWith('image/') ? <Ic.Image size={14} /> : <Ic.File size={14} />}
                    <span style={{ fontSize: 13 }}>{f.name}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      {fmtSize(f.size)}
                    </span>
                    <span className="spacer" />
                    <button
                      type="button"
                      className="btn-ghost icon-btn"
                      onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                      disabled={submitting}
                    >
                      <Ic.X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/customer/tickets')}
              disabled={submitting}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={submitting}
            >
              <Ic.Send size={14} />
              {submitting ? 'Gönderiliyor…' : 'Talep Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
