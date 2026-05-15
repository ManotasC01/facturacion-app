import { useState, useMemo, useEffect, useRef } from "react";
import { escucharClientes, guardarCliente, eliminarCliente } from "./firebase";

const ESTADOS = ["Activo", "Agotado", "Cancelado"];
const ESTADO_COLORS = {
  Activo:    { bg: "#e8f5e9", text: "#2e7d32", dot: "#43a047" },
  Agotado:   { bg: "#fff3e0", text: "#e65100", dot: "#fb8c00" },
  Cancelado: { bg: "#fce4ec", text: "#880e4f", dot: "#e91e63" },
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function App() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [vista, setVista] = useState("lista");
  const [modalCliente, setModalCliente] = useState(false);
  const [modalPaquete, setModalPaquete] = useState(false);
  const [paqueteEditando, setPaqueteEditando] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [toast, setToast] = useState(null);

  const [formCliente, setFormCliente] = useState({ nit: "", nombre: "" });
  const [formPaquete, setFormPaquete] = useState({
    prefijo: "", facturaInicio: "", facturaFin: "",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "", estado: "Activo",
  });

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Listener en tiempo real con Firebase
  useEffect(() => {
    setSyncStatus("connecting");
    const unsub = escucharClientes((data) => {
      setClientes(data);
      setSyncStatus("ok");
      // Actualizar cliente seleccionado si cambió en otro dispositivo
      setClienteSel((sel) => {
        if (!sel) return sel;
        return data.find((c) => c.id === sel.id) || sel;
      });
    });
    return () => unsub();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(
      (c) => c.nit.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  function abrirDetalle(c) { setClienteSel(c); setVista("detalle"); }
  function volverLista()   { setVista("lista"); setClienteSel(null); }

  // ── Clientes ──────────────────────────────────────────────────
  function abrirModalCliente(c = null) {
    setFormCliente(c ? { nit: c.nit, nombre: c.nombre } : { nit: "", nombre: "" });
    setModalCliente(true);
  }

  async function guardarClienteHandler() {
    if (!formCliente.nit.trim() || !formCliente.nombre.trim()) return;
    setSyncStatus("saving");
    try {
      if (clienteSel && vista === "detalle") {
        const updated = { ...clienteSel, ...formCliente };
        await guardarCliente(updated);
        setClienteSel(updated);
        showToast("Cliente actualizado ✓");
      } else {
        const nuevo = { id: uid(), ...formCliente, paquetes: [], creadoEn: new Date().toISOString() };
        await guardarCliente(nuevo);
        showToast("Cliente agregado ✓");
      }
    } catch { showToast("Error al guardar", "error"); }
    setModalCliente(false);
  }

  async function eliminarClienteHandler(id) {
    setSyncStatus("saving");
    try {
      await eliminarCliente(id);
      showToast("Cliente eliminado");
    } catch { showToast("Error al eliminar", "error"); }
    setConfirmDelete(null);
    if (clienteSel?.id === id) volverLista();
  }

  // ── Paquetes ──────────────────────────────────────────────────
  function abrirModalPaquete(p = null) {
    setPaqueteEditando(p || null);
    setFormPaquete(p ? { ...p } : {
      prefijo: "", facturaInicio: "", facturaFin: "",
      fecha: new Date().toISOString().split("T")[0], descripcion: "", estado: "Activo",
    });
    setModalPaquete(true);
  }

  async function guardarPaqueteHandler() {
    if (!formPaquete.prefijo.trim() || !formPaquete.facturaInicio || !formPaquete.facturaFin) return;
    const paq = {
      ...formPaquete,
      facturaInicio: parseInt(formPaquete.facturaInicio),
      facturaFin: parseInt(formPaquete.facturaFin),
    };
    let paquetes;
    if (paqueteEditando) {
      paquetes = clienteSel.paquetes.map((p) => p.id === paqueteEditando.id ? { ...paq, id: p.id } : p);
      showToast("Paquete actualizado ✓");
    } else {
      paq.id = uid();
      paquetes = [...clienteSel.paquetes, paq];
      showToast("Paquete agregado ✓");
    }
    setSyncStatus("saving");
    try {
      const updated = { ...clienteSel, paquetes };
      await guardarCliente(updated);
      setClienteSel(updated);
    } catch { showToast("Error al guardar", "error"); }
    setModalPaquete(false);
  }

  async function eliminarPaqueteHandler(pid) {
    const paquetes = clienteSel.paquetes.filter((p) => p.id !== pid);
    setSyncStatus("saving");
    try {
      const updated = { ...clienteSel, paquetes };
      await guardarCliente(updated);
      setClienteSel(updated);
      showToast("Paquete eliminado");
    } catch { showToast("Error al eliminar", "error"); }
    setConfirmDelete(null);
  }

  const totalFacturas = clienteSel
    ? clienteSel.paquetes.reduce((s, p) => s + (p.facturaFin - p.facturaInicio + 1), 0)
    : 0;

  const syncInfo = {
    connecting: { label: "Conectando...", color: "#fb8c00", pulse: true },
    saving:     { label: "Guardando...",  color: "#42a5f5", pulse: true },
    ok:         { label: "En vivo ●",     color: "#69f0ae", pulse: false },
    error:      { label: "Sin conexión",  color: "#ef5350", pulse: false },
  }[syncStatus] || { label: "", color: "#aaa", pulse: false };

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; }
        body { margin: 0; background: #e8eaf0; }
      `}</style>

      {/* STATUS BAR */}
      <div style={s.statusBar}>
        <span style={{ fontSize: 12, color: "#fff" }}>
          {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: syncInfo.color,
            animation: syncInfo.pulse ? "pulse 1s infinite" : "none",
          }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
            {syncInfo.label}
          </span>
        </div>
      </div>

      {/* APP BAR */}
      <div style={s.appBar}>
        {vista === "detalle" && (
          <button style={s.backBtn} onClick={volverLista}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={s.appTitle}>{vista === "lista" ? "Control de Facturación" : clienteSel?.nombre}</div>
          {vista === "detalle" && <div style={s.appSub}>NIT: {clienteSel?.nit}</div>}
        </div>
        {vista === "lista" ? (
          <button style={s.hBtn} onClick={() => abrirModalCliente()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button style={s.hBtn} onClick={() => abrirModalCliente(clienteSel)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button style={{ ...s.hBtn, background: "rgba(229,57,53,0.35)" }}
              onClick={() => setConfirmDelete({ type: "cliente", id: clienteSel.id })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={s.content}>

        {/* ── LISTA ── */}
        {vista === "lista" && (
          <>
            <div style={s.searchBox}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#999">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input style={s.searchInput} placeholder="Buscar por NIT o nombre..."
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              {busqueda && (
                <button style={s.clearBtn} onClick={() => setBusqueda("")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#aaa"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              )}
            </div>

            {syncStatus === "connecting" ? (
              <div style={s.center}>
                <div style={s.spinner} />
                <p style={{ color: "#aaa", fontSize: 13, marginTop: 14 }}>Conectando con Firebase...</p>
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div style={s.center}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="#ddd"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                <p style={{ color: "#bbb", fontSize: 13, marginTop: 10, textAlign: "center" }}>
                  {busqueda ? "Sin resultados" : "No hay clientes.\nToca + para agregar el primero."}
                </p>
              </div>
            ) : (
              <>
                <div style={s.meta}>
                  {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}
                  {busqueda ? " encontrados" : ""}
                  <span style={{ color: "#1565c0", fontWeight: 600 }}> · {clientes.length} en nube</span>
                </div>
                <div style={s.list}>
                  {clientesFiltrados.map((c) => {
                    const activos = c.paquetes.filter((p) => p.estado === "Activo").length;
                    const prefijos = [...new Set(c.paquetes.map((p) => p.prefijo))];
                    return (
                      <div key={c.id} style={s.card} onClick={() => abrirDetalle(c)}>
                        <div style={s.avatar}>{c.nombre.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={s.cNombre}>{c.nombre}</div>
                          <div style={s.cNit}>NIT: {c.nit}</div>
                          {prefijos.length > 0 && (
                            <div style={s.chipRow}>
                              {prefijos.map((p) => <span key={p} style={s.chip}>{p}</span>)}
                            </div>
                          )}
                        </div>
                        <div style={s.cRight}>
                          <div style={s.cCount}>{c.paquetes.length}</div>
                          <div style={s.cCountLbl}>paquetes</div>
                          {activos > 0 && <div style={s.activoBadge}>{activos} activo{activos !== 1 ? "s" : ""}</div>}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ccc" style={{ marginTop: 4 }}>
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── DETALLE ── */}
        {vista === "detalle" && clienteSel && (
          <>
            <div style={s.statsRow}>
              {[
                { num: clienteSel.paquetes.length, label: "Paquetes" },
                { num: totalFacturas,               label: "Facturas" },
                { num: [...new Set(clienteSel.paquetes.map((p) => p.prefijo))].length, label: "Prefijos" },
              ].map((st, i) => (
                <div key={i} style={{ display: "flex", flex: 1 }}>
                  {i > 0 && <div style={s.statDiv} />}
                  <div style={s.statBox}>
                    <div style={s.statNum}>{st.num}</div>
                    <div style={s.statLbl}>{st.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {clienteSel.paquetes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={s.secLbl}>Prefijos registrados</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[...new Set(clienteSel.paquetes.map((p) => p.prefijo))].map((pref) => {
                    const lista = clienteSel.paquetes.filter((p) => p.prefijo === pref);
                    return (
                      <div key={pref} style={s.prefijoCard}>
                        <div style={s.prefijoName}>{pref}</div>
                        <div style={s.prefijoRange}>
                          {Math.min(...lista.map((p) => p.facturaInicio))} → {Math.max(...lista.map((p) => p.facturaFin))}
                        </div>
                        <div style={s.prefijoCnt}>{lista.length} paquete{lista.length !== 1 ? "s" : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={s.secLbl}>Paquetes de numeración</div>
              <button style={s.addPaqBtn} onClick={() => abrirModalPaquete()}>+ Agregar</button>
            </div>

            {clienteSel.paquetes.length === 0 ? (
              <div style={s.center}>
                <p style={{ color: "#bbb", fontSize: 13 }}>Sin paquetes. Toca "+ Agregar".</p>
              </div>
            ) : (
              <div style={s.list}>
                {clienteSel.paquetes.map((p) => {
                  const ec = ESTADO_COLORS[p.estado] || ESTADO_COLORS.Activo;
                  const total = p.facturaFin - p.facturaInicio + 1;
                  return (
                    <div key={p.id} style={s.paqCard}>
                      <div style={s.paqHeader}>
                        <span style={s.paqPref}>{p.prefijo}</span>
                        <div style={{ ...s.estBadge, background: ec.bg, color: ec.text }}>
                          <div style={{ ...s.estDot, background: ec.dot }} />{p.estado}
                        </div>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          <button style={s.paqBtn} onClick={() => abrirModalPaquete(p)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="#555"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                          </button>
                          <button style={s.paqBtn} onClick={() => setConfirmDelete({ type: "paquete", id: p.id })}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="#e53935"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                          </button>
                        </div>
                      </div>
                      <div style={s.rangoRow}>
                        <div style={s.rangoBox}>
                          <div style={s.rangoLbl}>FACTURA INICIO</div>
                          <div style={s.rangoNum}>{p.prefijo}-{String(p.facturaInicio).padStart(8, "0")}</div>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#c5cae9">
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                        </svg>
                        <div style={s.rangoBox}>
                          <div style={s.rangoLbl}>FACTURA FIN</div>
                          <div style={s.rangoNum}>{p.prefijo}-{String(p.facturaFin).padStart(8, "0")}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>📄 {total} facturas</span>
                        <span style={{ fontSize: 11, color: "#aaa" }}>{p.fecha}</span>
                      </div>
                      {p.descripcion && <div style={s.paqDesc}>{p.descripcion}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {vista === "detalle" && (
        <button style={s.fab} onClick={() => abrirModalPaquete()}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...s.toast, background: toast.type === "error" ? "#c62828" : "#1a237e" }}>
          {toast.msg}
        </div>
      )}

      {/* MODAL CLIENTE */}
      {modalCliente && (
        <div style={s.overlay} onClick={() => setModalCliente(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.handle} />
            <div style={s.sheetTitle}>{clienteSel && vista === "detalle" ? "Editar cliente" : "Nuevo cliente"}</div>
            <Fld label="NIT / Número de identificación">
              <input style={s.inp} placeholder="Ej: 900123456-1"
                value={formCliente.nit} onChange={(e) => setFormCliente({ ...formCliente, nit: e.target.value })} />
            </Fld>
            <Fld label="Nombre o razón social">
              <input style={s.inp} placeholder="Ej: Comercializadora XYZ S.A.S"
                value={formCliente.nombre} onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })} />
            </Fld>
            <Btns onCancel={() => setModalCliente(false)} onOk={guardarClienteHandler} />
          </div>
        </div>
      )}

      {/* MODAL PAQUETE */}
      {modalPaquete && (
        <div style={s.overlay} onClick={() => setModalPaquete(false)}>
          <div style={{ ...s.sheet, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={s.handle} />
            <div style={s.sheetTitle}>{paqueteEditando ? "Editar paquete" : "Nuevo paquete"}</div>
            <Fld label="Prefijo">
              <input style={s.inp} placeholder="Ej: FE, NC, DIST..."
                value={formPaquete.prefijo}
                onChange={(e) => setFormPaquete({ ...formPaquete, prefijo: e.target.value.toUpperCase() })} />
            </Fld>
            <div style={{ display: "flex", gap: 10 }}>
              <Fld label="Factura inicio" style={{ flex: 1 }}>
                <input style={s.inp} type="number" placeholder="1001"
                  value={formPaquete.facturaInicio}
                  onChange={(e) => setFormPaquete({ ...formPaquete, facturaInicio: e.target.value })} />
              </Fld>
              <Fld label="Factura fin" style={{ flex: 1 }}>
                <input style={s.inp} type="number" placeholder="1100"
                  value={formPaquete.facturaFin}
                  onChange={(e) => setFormPaquete({ ...formPaquete, facturaFin: e.target.value })} />
              </Fld>
            </div>
            {formPaquete.prefijo && formPaquete.facturaInicio && formPaquete.facturaFin && (
              <div style={s.preview}>
                <span style={{ color: "#1565c0", fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>
                  {formPaquete.prefijo}-{String(formPaquete.facturaInicio).padStart(8, "0")}
                </span>
                <span style={{ color: "#777", margin: "0 6px" }}>→</span>
                <span style={{ color: "#1565c0", fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>
                  {formPaquete.prefijo}-{String(formPaquete.facturaFin).padStart(8, "0")}
                </span>
                <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
                  {Math.max(0, parseInt(formPaquete.facturaFin) - parseInt(formPaquete.facturaInicio) + 1)} facturas
                </div>
              </div>
            )}
            <Fld label="Fecha de asignación">
              <input style={s.inp} type="date" value={formPaquete.fecha}
                onChange={(e) => setFormPaquete({ ...formPaquete, fecha: e.target.value })} />
            </Fld>
            <Fld label="Estado">
              <div style={{ display: "flex", gap: 6 }}>
                {ESTADOS.map((est) => {
                  const ec = ESTADO_COLORS[est];
                  return (
                    <button key={est} style={{
                      flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", textAlign: "center",
                      background: formPaquete.estado === est ? ec.bg : "#f5f5f5",
                      border: `2px solid ${formPaquete.estado === est ? ec.dot : "transparent"}`,
                      color: formPaquete.estado === est ? ec.text : "#888",
                    }} onClick={() => setFormPaquete({ ...formPaquete, estado: est })}>
                      {est}
                    </button>
                  );
                })}
              </div>
            </Fld>
            <Fld label="Descripción (opcional)">
              <input style={s.inp} placeholder="Ej: Paquete enero 2026"
                value={formPaquete.descripcion}
                onChange={(e) => setFormPaquete({ ...formPaquete, descripcion: e.target.value })} />
            </Fld>
            <Btns onCancel={() => setModalPaquete(false)} onOk={guardarPaqueteHandler} />
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={s.sheetTitle}>¿Eliminar {confirmDelete.type === "cliente" ? "cliente" : "paquete"}?</div>
            <div style={{ fontSize: 13, color: "#777", marginBottom: 18, lineHeight: 1.5 }}>
              {confirmDelete.type === "cliente"
                ? "Se eliminarán todos sus paquetes en todos los dispositivos."
                : "Esta acción no se puede deshacer y se sincronizará en tiempo real."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={s.btnCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button style={{ ...s.btnOk, background: "#e53935" }}
                onClick={() => confirmDelete.type === "cliente"
                  ? eliminarClienteHandler(confirmDelete.id)
                  : eliminarPaqueteHandler(confirmDelete.id)}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children, style }) {
  return (
    <div style={{ marginBottom: 13, ...style }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Btns({ onCancel, onOk }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
      <button style={s.btnCancel} onClick={onCancel}>Cancelar</button>
      <button style={s.btnOk} onClick={onOk}>Guardar</button>
    </div>
  );
}

const s = {
  root: { width: "100%", maxWidth: 430, minHeight: "100vh", margin: "0 auto", background: "#f0f2f5", fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", display: "flex", flexDirection: "column", boxShadow: "0 0 40px rgba(0,0,0,0.12)" },
  statusBar: { background: "#0d47a1", padding: "6px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  appBar: { background: "linear-gradient(135deg,#1565c0,#1976d2)", padding: "10px 12px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  backBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  appTitle: { color: "#fff", fontSize: 17, fontWeight: 700 },
  appSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 },
  hBtn: { background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 20, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  content: { flex: 1, overflowY: "auto", padding: "12px 12px 80px" },
  searchBox: { background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", padding: "0 12px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: 14, padding: "12px 10px", background: "transparent", color: "#333" },
  clearBtn: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 },
  meta: { fontSize: 11, color: "#999", marginBottom: 8, paddingLeft: 2 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "#fff", borderRadius: 14, padding: "13px", display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" },
  avatar: { width: 42, height: 42, borderRadius: 21, background: "linear-gradient(135deg,#1565c0,#42a5f5)", color: "#fff", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cNombre: { fontSize: 14, fontWeight: 600, color: "#1a1a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cNit: { fontSize: 12, color: "#888", marginTop: 1 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 },
  chip: { background: "#e3f2fd", color: "#1565c0", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 7 },
  cRight: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  cCount: { fontSize: 20, fontWeight: 700, color: "#1565c0" },
  cCountLbl: { fontSize: 10, color: "#aaa" },
  activoBadge: { background: "#e8f5e9", color: "#2e7d32", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6, marginTop: 2 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0" },
  spinner: { width: 36, height: 36, border: "3px solid #e3f2fd", borderTop: "3px solid #1565c0", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  statsRow: { background: "#fff", borderRadius: 14, display: "flex", alignItems: "stretch", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" },
  statBox: { flex: 1, padding: "13px 8px", textAlign: "center" },
  statDiv: { width: 1, background: "#eee", alignSelf: "stretch", margin: "10px 0" },
  statNum: { fontSize: 21, fontWeight: 700, color: "#1565c0" },
  statLbl: { fontSize: 11, color: "#888", marginTop: 1 },
  secLbl: { fontSize: 11, fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 },
  prefijoCard: { background: "#fff", borderRadius: 11, padding: "9px 13px", border: "2px solid #e3f2fd", minWidth: 90 },
  prefijoName: { fontSize: 15, fontWeight: 700, color: "#1565c0" },
  prefijoRange: { fontSize: 11, color: "#777", marginTop: 1 },
  prefijoCnt: { fontSize: 10, color: "#aaa", marginTop: 1 },
  addPaqBtn: { background: "#1565c0", color: "#fff", border: "none", borderRadius: 18, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  paqCard: { background: "#fff", borderRadius: 13, padding: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" },
  paqHeader: { display: "flex", alignItems: "center", gap: 7, marginBottom: 11 },
  paqPref: { background: "#e3f2fd", color: "#1565c0", fontSize: 13, fontWeight: 700, padding: "3px 9px", borderRadius: 7 },
  estBadge: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 7px", borderRadius: 7 },
  estDot: { width: 6, height: 6, borderRadius: "50%" },
  paqBtn: { background: "#f5f5f5", border: "none", borderRadius: 7, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  rangoRow: { display: "flex", alignItems: "center", gap: 6, background: "#f8f9ff", borderRadius: 10, padding: "10px 12px", marginBottom: 9 },
  rangoBox: { flex: 1, textAlign: "center" },
  rangoLbl: { fontSize: 9, fontWeight: 700, color: "#aaa", letterSpacing: 0.8, marginBottom: 3 },
  rangoNum: { fontSize: 11, fontWeight: 700, color: "#1565c0", fontFamily: "monospace", wordBreak: "break-all" },
  paqDesc: { fontSize: 12, color: "#888", marginTop: 6, fontStyle: "italic", paddingTop: 6, borderTop: "1px solid #f0f0f0" },
  fab: { position: "fixed", bottom: 24, right: "calc(50% - 215px + 16px)", width: 54, height: 54, borderRadius: 27, background: "linear-gradient(135deg,#1565c0,#42a5f5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(21,101,192,0.45)", zIndex: 10 },
  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", color: "#fff", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", whiteSpace: "nowrap" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  sheet: { background: "#fff", borderRadius: "20px 20px 0 0", padding: "14px 18px 30px", width: "100%", maxWidth: 430 },
  handle: { width: 34, height: 4, borderRadius: 2, background: "#ddd", margin: "0 auto 14px" },
  sheetTitle: { fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 16 },
  inp: { width: "100%", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "#333", outline: "none", boxSizing: "border-box", background: "#fafafa" },
  preview: { background: "#e8f4fd", borderRadius: 10, padding: "10px", marginBottom: 13, textAlign: "center" },
  btnCancel: { flex: 1, padding: "11px", borderRadius: 11, border: "1.5px solid #ddd", background: "#fff", fontSize: 14, fontWeight: 600, color: "#555", cursor: "pointer" },
  btnOk: { flex: 2, padding: "11px", borderRadius: 11, border: "none", background: "#1565c0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  dialog: { background: "#fff", borderRadius: 16, padding: "22px 18px 16px", width: "calc(100% - 48px)", maxWidth: 340, alignSelf: "center", margin: "auto" },
};
