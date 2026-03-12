/* ==========================================================================
   CONFIGURACIÓN Y VARIABLES GLOBALES
   ========================================================================== */
const MODO_RESTRINGIDO = false;

const CONFIG_IMPRESORAS = {
    "10.54.204.171": { nombre: "CONSERVAS", clave: "con2026" },
    "10.54.204.152": { nombre: "PASTA", clave: "pas2026" },
    "10.54.204.151": { nombre: "ETIQUETADO", clave: "eti2026" }
};

let baseDeProductos = {};
let ultimaImpresora = "";
let historial = JSON.parse(localStorage.getItem('historial')) || [];
let modoActual = 'tabEtiquetaLibre';

/* ==========================================================================
   SISTEMA DE NAVEGACIÓN (TABS)
   ========================================================================== */
function cambiarTab(evt, nombreTab) {
    modoActual = nombreTab;

    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.remove("active");
    }

    document.getElementById(nombreTab).classList.add("active");
    if (evt) evt.currentTarget.classList.add("active");

    const controlesExtra = document.getElementById('controles-extra');
    controlesExtra.style.display = (nombreTab === 'tabModoIC') ? 'none' : 'flex';
}

/* ==========================================================================
   INICIALIZACIÓN Y CARGA DE DATOS
   ========================================================================== */
window.onload = async () => {
    const fechaInput = document.getElementById('fechaEtiqueta');
    if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        const icon = document.getElementById('theme-icon');
        if (icon) icon.innerText = savedTheme === 'dark' ? '☀️' : '🌙';
    }

    try {
        const response = await fetch('productos.json');
        if (!response.ok) throw new Error("Error carga JSON");
        baseDeProductos = await response.json();
        popularDatalistIC();
    } catch (error) {
        console.error("Error:", error);
    }

    document.getElementById('copias').addEventListener('input', validarSeguridad);
    validarSeguridad();
};

function popularDatalistIC() {
    const datalist = document.getElementById('listaProductosIC');
    if (!datalist || !baseDeProductos) return;

    datalist.innerHTML = '';
    Object.values(baseDeProductos).flat().forEach(p => {
        const option = document.createElement('option');
        option.value = p.cod;
        option.textContent = p.desc;
        datalist.appendChild(option);
    });
}

/* ==========================================================================
   SEGURIDAD Y VALIDACIONES
   ========================================================================== */
function verificarPasswordImpresora() {
    const select = document.getElementById('printerIp');
    if (!MODO_RESTRINGIDO) {
        ultimaImpresora = select.value;
        return;
    }
    if (select.value !== "" && select.value !== ultimaImpresora) {
        mostrarModal();
    }
}

function validarPassword() {
    const passInput = document.getElementById('passImpresora');
    const select = document.getElementById('printerIp');
    const config = CONFIG_IMPRESORAS[select.value];

    if (config && passInput.value === config.clave) {
        ultimaImpresora = select.value;
        cerrarModal();
    } else {
        alert("❌ Contraseña incorrecta");
    }
}

function validarSeguridad() {
    const inputCopias = document.getElementById('copias');
    const btnImprimir = document.getElementById('btnImprimir');
    const num = parseInt(inputCopias.value);

    if (num > 10 || num < 1 || isNaN(num)) {
        inputCopias.style.borderColor = "var(--error-color)";
        btnImprimir.disabled = true;
        btnImprimir.innerText = "MÁXIMO 10 COPIAS";
    } else {
        inputCopias.style.borderColor = "var(--border-color)";
        btnImprimir.disabled = false;
        btnImprimir.innerText = "IMPRIMIR ETIQUETA";
    }
}

function mostrarModal() { document.getElementById('modalSeguridad').classList.remove('hidden'); }
function cerrarModal() { document.getElementById('modalSeguridad').classList.add('hidden'); }
function cancelarSeleccion() {
    document.getElementById('printerIp').value = ultimaImpresora;
    cerrarModal();
}

/* ==========================================================================
   LÓGICA DE INTERFAZ Y UI
   ========================================================================== */
function toggleEncabezado() {
    const section = document.getElementById('sectionEncabezado');
    section.classList.toggle('hidden', !document.getElementById('chkEncabezado').checked);
}

function cargarProductos() {
    const linea = document.getElementById('selectLinea').value;
    const combo = document.getElementById('selectProducto');
    combo.innerHTML = '<option value="">-- Seleccione un producto --</option>';
    if (linea && baseDeProductos[linea]) {
        baseDeProductos[linea].forEach(p => {
            let opt = document.createElement('option');
            opt.value = `${p.cod}|${p.desc}`;
            opt.text = `${p.cod} - ${p.desc}`;
            combo.appendChild(opt);
        });
    }
}

function autoCompletarDescripcion() {
    const codBusqueda = document.getElementById('icItem').value;
    const display = document.getElementById('icDescDisplay');

    if (!codBusqueda) {
        display.innerText = "";
        return;
    }

    const producto = Object.values(baseDeProductos).flat().find(p => p.cod === codBusqueda);
    if (producto) {
        display.innerText = producto.desc;
        display.style.color = "var(--primary-color)";
    } else {
        display.innerText = "Código no encontrado";
        display.style.color = "var(--error-color)";
    }
}

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').innerText = isDark ? '🌙' : '☀️';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

/* ==========================================================================
   GENERACIÓN DE CÓDIGO ZPL
   ========================================================================== */
function generarZPL() {
    if (modoActual === 'tabEtiquetaLibre') {
        const textoPrincipal = document.getElementById('textoEtiqueta').value.toUpperCase().trim();
        const size = parseInt(document.getElementById('tamano').value);
        const orient = document.getElementById('orientacion').value;
        const modoInvertido = document.getElementById('chkInversion').checked;

        let zpl = `^XA^CI28^PW812^LL1218`;
        if (modoInvertido) zpl += `^FO0,0^GB812,1218,1218^FS`;

        if (document.getElementById('chkEncabezado').checked) {
            const val = document.getElementById('selectProducto').value;
            if (val) {
                const [cod, desc] = val.split('|');
                const f = document.getElementById('fechaEtiqueta').value.split('-').reverse().join('/');
                const txt = `${cod} ${desc} ${f}`;
                const r = modoInvertido ? "^FR" : "";

                if (orient === 'V') {
                    zpl += `^FT6,39^A0N,27,38${r}^FDINDUSTRIA ARGENTINA^FS`;
                    zpl += `^FT428,39^A0N,27,35${r}^FDARCOR S.A.I.C.^FS`;
                    zpl += `^FT6,96^A0N,38,35${r}^FDPLANTA SAN JUAN^FS`;
                    zpl += `^FO20,130^A0N,28,28${r}^FD${txt}^FS`;
                } else {
                    zpl += `^FO750,20^A0R,28,28${r}^FD${txt}^FS`;
                }
            }
        }

        if (textoPrincipal) {
            const nL = textoPrincipal.split('\n').length;
            const r = modoInvertido ? "^FR" : "";
            if (orient === 'V') {
                let pY = 640 - ((nL * size) / 2);
                zpl += `^FO20,${pY}^A0N,${size},${size}^FB772,${nL},0,C${r}^FD${textoPrincipal.replace(/\n/g, '\\&')}^FS`;
            } else {
                let pX = 380 - ((nL * size) / 2);
                zpl += `^FO${pX},20^A0R,${size},${size}^FB1180,${nL},0,C${r}^FD${textoPrincipal.replace(/\n/g, '\\&')}^FS`;
            }
        }
        return zpl + `^XZ`;
    } 
    
    if (modoActual === 'tabModoIC') {
        const itemLargo = document.getElementById('icItem').value;
        const loteRaw = document.getElementById('icLote').value.trim();
        const cant = document.getElementById('icCantidad').value.padStart(5, '0');
        const wo = document.getElementById('icWO').value;
        const vto = document.getElementById('icVto').value;

        if (!itemLargo || !loteRaw) return "";

        const loteCompleto = loteRaw.padStart(12, '0');
        const producto = Object.values(baseDeProductos).flat().find(p => p.cod === itemLargo);
        const desc = producto ? producto.desc.toUpperCase() : "";
        const itemCorto = itemLargo.length > 7 ? itemLargo.slice(-7) : itemLargo;
        const fab = new Date().toLocaleDateString('es-AR') + " " + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const vtoShow = vto ? vto.split('-').reverse().join('/') : "";
        const barcodeData = `0${itemCorto}${loteCompleto}${cant}`;

        return `^XA^CI27^PW799^LL1199^LS0
^FT6,39^A0N,27,38^FH\\^CI28^FDINDUSTRIA ARGENTINA^FS^CI27
^FT428,39^A0N,27,35^FH\\^CI28^FDARCOR S.A.I.C. ^FS^CI27
^FT6,96^A0N,38,35^FH\\^CI28^FDPLANTA SAN JUAN ^FS^CI27
^FT10,154^A0N,29,28^FH\\^CI28^FDITEM LARGO: ${itemLargo} ^FS^CI27
^FT6,217^A0N,28,38^FH\\^CI28^FDITEM: ${itemCorto}^FS^CI27
^FT345,154^A0N,29,33^FH\\^CI28^FD${desc}^FS^CI27
^FT255,217^A0N,28,33^FH\\^CI28^FDCANTIDAD: ${parseInt(cant)}^FS^CI27
^FT499,217^A0N,28,33^FH\\^CI28^FDLOTE:${loteCompleto}^FS^CI27
^FT524,282^A0N,34,38^FH\\^CI28^FDWO:${wo}^FS^CI27
^FT0,282^A0N,34,33^FB163,1,9,R^FH\\^CI28^FDFECHA VTO ^FS^CI27
^FT10,346^A0N,34,33^FH\\^CI28^FDFecha de Fab: ${fab}^FS^CI27
^FT179,282^A0N,34,33^FH\\^CI28^FD${vtoShow}^FS^CI27
^FT524,346^A0N,34,33^FH\\^CI28^FDCARPETA: 0^FS^CI27
^FT98,1005^BXN,34,200,0,0,1,_,1^FH\\^FD${barcodeData}^FS
^FO30,1055^BY3^B2N,95,Y,N,Y^FD${barcodeData} ^FS^BY2
^PQ1,0,1,Y^XZ`;
    }
    return "";
}

/* ==========================================================================
   ENVÍO A IMPRESIÓN Y PREVIEW
   ========================================================================== */
function mostrarPreview() {
    const zpl = generarZPL();
    const url = `http://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/${encodeURIComponent(zpl)}`;
    document.getElementById('labelaryImage').src = url;
    document.getElementById('modalPreview').classList.remove('hidden');
}

function cerrarPreview() {
    document.getElementById('modalPreview').classList.add('hidden');
    document.getElementById('labelaryImage').src = "";
}

async function imprimir() {
    const ip = document.getElementById('printerIp').value;
    const copias = document.getElementById('copias').value;
    const status = document.getElementById('status');

    if (!ip) return alert("Seleccione impresora");

    let textoHist = modoActual === 'tabEtiquetaLibre' ? 
        document.getElementById('textoEtiqueta').value : 
        `IC: ${document.getElementById('icItem').value}`;

    guardarEnHistorial({ ip, texto: textoHist });

    let zplFinal = generarZPL().replace('^XZ', `^PQ${copias}^XZ`);
    status.style.display = "block";
    status.innerText = "Enviando...";

    try {
        await fetch(`http://${ip}/pstprnt`, { method: 'POST', mode: 'no-cors', body: zplFinal });
        status.innerText = "¡Enviado!";
        status.style.color = "green";
    } catch (e) {
        status.innerText = "Error conexión";
        status.style.color = "red";
    }
    setTimeout(() => status.style.display = "none", 3000);
}

/* ==========================================================================
   GESTIÓN DE HISTORIAL
   ========================================================================== */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    renderizarHistorial();
}

function guardarEnHistorial(datos) {
    if (!datos.texto) return;
    historial.unshift({ id: Date.now(), fecha: new Date().toLocaleTimeString(), ...datos });
    historial = historial.slice(0, 10);
    localStorage.setItem('historial', JSON.stringify(historial));
}

function renderizarHistorial() {
    const lista = document.getElementById('historial-lista');
    lista.innerHTML = '';
    historial.forEach(item => {
        const card = document.createElement('div');
        card.className = 'mini-card';
        card.innerHTML = `<h4>${item.fecha}</h4><p>${item.texto.substring(0, 30)}...</p>`;
        lista.appendChild(card);
    });
}

function limpiarHistorial() {
    historial = [];
    localStorage.removeItem('historial');
    renderizarHistorial();
}