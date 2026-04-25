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
let imagenActual = null;

// Debounce para regenerar GFA escalado solo al soltar el slider
let _debounceGFA = null;
function debounceGFA(fn, ms = 400) {
    clearTimeout(_debounceGFA);
    _debounceGFA = setTimeout(fn, ms);
}

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
    controlesExtra.style.display = (nombreTab === 'tabModoIC' || nombreTab === 'tabModoImagen') ? 'none' : 'flex';

    validar();
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
    validar();
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

function aplicarReglasTextoEtiquetaLibre() {
    const textarea = document.getElementById('textoEtiqueta');
    const size = parseInt(document.getElementById('tamano').value);
    if (!textarea) return;

    if (size === 210) {
        // Extra Grande: una sola linea de hasta 15 caracteres.
        textarea.value = textarea.value.replace(/[\r\n]+/g, ' ');
        textarea.maxLength = 15;
    } else {
        textarea.removeAttribute('maxlength');
    }
}

function actualizarFeedbackEtiquetaLibre() {
    const textarea = document.getElementById('textoEtiqueta');
    const statusEtiqueta = document.getElementById('statusEtiqueta');
    if (!textarea || !statusEtiqueta) return;

    if (modoActual !== 'tabEtiquetaLibre') {
        statusEtiqueta.innerText = '';
        textarea.style.borderColor = 'var(--border-color)';
        return;
    }

    const size = parseInt(document.getElementById('tamano').value);
    if (size === 210) {
        const largo = textarea.value.length;
        const llegoLimite = largo >= 15;
        textarea.placeholder = 'EXTRA GRANDE: UNA LINEA, MAX 15';
        statusEtiqueta.innerText = llegoLimite
            ? 'Limite alcanzado: 15 caracteres en Extra Grande.'
            : `Extra Grande: ${largo}/15 caracteres (sin saltos de linea).`;
        statusEtiqueta.style.color = llegoLimite ? 'var(--error-color)' : 'var(--text-label)';
        textarea.style.borderColor = llegoLimite ? 'var(--error-color)' : 'var(--border-color)';
        return;
    }

    textarea.placeholder = 'ESCRIBA AQUI...';
    statusEtiqueta.innerText = 'Saltos de linea permitidos.';
    statusEtiqueta.style.color = 'var(--text-label)';
    textarea.style.borderColor = 'var(--border-color)';
}

function validar() {
    const btnImprimir = document.getElementById('btnImprimir');

    // Mantiene la validacion de copias para todos los modos.
    validarSeguridad();

    // En modo etiqueta libre, exige contenido para habilitar impresion.
    if (modoActual === 'tabEtiquetaLibre') {
        aplicarReglasTextoEtiquetaLibre();
        actualizarFeedbackEtiquetaLibre();
        const texto = document.getElementById('textoEtiqueta').value.trim();
        if (!texto) {
            btnImprimir.disabled = true;
            btnImprimir.innerText = 'INGRESE CONTENIDO';
        }
    } else {
        actualizarFeedbackEtiquetaLibre();
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
    
    if (modoActual === 'tabModoImagen') {
        if (!imagenActual || !imagenActual.zplGraphics) return "";
        
        const posX     = parseInt(document.getElementById('posicionX').value);
        const posY     = parseInt(document.getElementById('posicionY').value);
        const escala   = parseInt(document.getElementById('escalaImagen').value) / 100;
        const rotacion = parseInt(document.getElementById('rotacionImagen').value);

        // Usar GFA pre-calculado por el debounce si coincide con los parámetros actuales
        const usarPreCalc = imagenActual.zplGraphicsCurrent
            && imagenActual.currentEscala   === escala
            && imagenActual.currentRotacion === rotacion;

        const gfaFinal = usarPreCalc
            ? imagenActual.zplGraphicsCurrent
            : aplicarEscalaYRotacionAGFA(imagenActual.zplGraphics, escala, rotacion,
                                          imagenActual.dotW, imagenActual.dotH);

        // Dimensiones del GFA final para calcular el FO centrado
        const baseW = imagenActual.dotW || 400;
        const baseH = imagenActual.dotH || 400;
        let imgW = Math.min(Math.round(baseW * escala), 812);
        let imgH = Math.min(Math.round(baseH * escala), 1218);
        if (rotacion === 90 || rotacion === 270) { [imgW, imgH] = [imgH, imgW]; }

        // FO centrado: el punto elegido es el centro de la imagen
        const foX = Math.max(0, posX - Math.round(imgW / 2));
        const foY = Math.max(0, posY - Math.round(imgH / 2));

        return `^XA^PW812^LL1218^FO${foX},${foY}${gfaFinal}^FS^XZ`;
    }
    
    return "";
}

/* ==========================================================================
   MANEJO DE IMÁGENES - USAR API LABELARY CON CORS PROXY
   ========================================================================== */
async function cargarImagen() {
    const input = document.getElementById('imagenFile');
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            imagenActual = {
                src: e.target.result,
                file: file,
                procesando: true
            };
            actualizarPreviewImagen();
            
            // Procesamiento local inmediato
            try {
                const resultado = await procesarImagenALocal(img);
                imagenActual.zplGraphics = resultado.gfa;
                imagenActual.dotW = resultado.dotW;
                imagenActual.dotH = resultado.dotH;
                imagenActual.procesando = false;
                console.log(`✅ Imagen convertida (${resultado.dotW}×${resultado.dotH} dots). Tamaño: ${Math.round(resultado.gfa.length / 1024)}KB`);
                validar();
            } catch (err) {
                console.error("Error en proceso local:", err);
                alert("Error al procesar la imagen localmente.");
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
/* Reconstruye el bitmap del GFA aplicando escala y rotación en canvas.
   baseW/baseH son las dimensiones reales en dots de la imagen original. */
function aplicarEscalaYRotacionAGFA(gfaOriginal, escala, rotacionGrados, baseW, baseH) {
    if (escala === 1 && rotacionGrados === 0) return gfaOriginal;

    const match = gfaOriginal.match(/\^GFA,(\d+),(\d+),(\d+),([\s\S]*)/);
    if (!match) return gfaOriginal;

    const bytesPerRowOrig = parseInt(match[3]);
    const totalBytesOrig  = parseInt(match[2]);
    const hexData         = match[4];
    // Usar dimensiones reales si se pasaron; sino inferir desde BPR
    const anchoOrig = baseW  || bytesPerRowOrig * 8;
    const altoOrig  = baseH  || Math.ceil(totalBytesOrig / bytesPerRowOrig);

    // ── Expandir compresión de filas vacías (',') ──────────────────────────
    const rowZeros = "00".repeat(bytesPerRowOrig);
    let hexExpanded = "";
    for (const ch of hexData) {
        hexExpanded += (ch === ',') ? rowZeros : ch;
    }

    // ── Reconstruir bitmap original como ImageData en canvas ───────────────
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width  = anchoOrig;
    srcCanvas.height = altoOrig;
    const srcCtx = srcCanvas.getContext('2d');
    const imgData = srcCtx.createImageData(anchoOrig, altoOrig);
    for (let y = 0; y < altoOrig; y++) {
        for (let x = 0; x < anchoOrig; x++) {
            const byteIdx = y * bytesPerRowOrig + Math.floor(x / 8);
            const byteVal = parseInt(hexExpanded.substring(byteIdx * 2, byteIdx * 2 + 2), 16) || 0;
            const bit     = (byteVal >> (7 - (x % 8))) & 1;
            const val     = bit ? 0 : 255;
            const idx     = (y * anchoOrig + x) * 4;
            imgData.data[idx] = imgData.data[idx+1] = imgData.data[idx+2] = val;
            imgData.data[idx+3] = 255;
        }
    }
    srcCtx.putImageData(imgData, 0, 0);

    // ── Dimensiones tras escalar ───────────────────────────────────────────
    const nuevoAncho = Math.round(anchoOrig * escala);
    const nuevoAlto  = Math.round(altoOrig  * escala);

    // ── Canvas final con rotación (dimensiones ya intercambiadas si aplica) ─
    let cW = nuevoAncho, cH = nuevoAlto;
    if (rotacionGrados === 90 || rotacionGrados === 270) { cW = nuevoAlto; cH = nuevoAncho; }
    const MAX_W = 812, MAX_H = 1218;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width  = Math.min(cW, MAX_W);
    finalCanvas.height = Math.min(cH, MAX_H);
    const ctx = finalCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.save();
    ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
    ctx.rotate((rotacionGrados * Math.PI) / 180);
    // drawImage con interpolación bicúbica automática del navegador
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, -nuevoAncho / 2, -nuevoAlto / 2, nuevoAncho, nuevoAlto);
    ctx.restore();

    // ── Convertir canvas final a GFA hex ──────────────────────────────────
    const finalPixels = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height).data;
    const finalBPR = Math.ceil(finalCanvas.width / 8);
    let hexResult = "";
    for (let y = 0; y < finalCanvas.height; y++) {
        let rowHex = "";
        for (let bx = 0; bx < finalBPR; bx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const px = bx * 8 + bit;
                if (px < finalCanvas.width) {
                    const i = (y * finalCanvas.width + px) * 4;
                    const brightness = (finalPixels[i] + finalPixels[i+1] + finalPixels[i+2]) / 3;
                    if (brightness < 128) byte |= (1 << (7 - bit));
                }
            }
            rowHex += byte.toString(16).padStart(2, '0').toUpperCase();
        }
        hexResult += /^0+$/.test(rowHex) ? "," : rowHex;
    }
    const totalBytes = finalBPR * finalCanvas.height;
    return `^GFA,${totalBytes},${totalBytes},${finalBPR},${hexResult}`;
}

async function procesarImagenALocal(img, escalaForzada = 1, rotacionForzada = 0) {
    // ── 1. Escalar al ancho máximo de la etiqueta (812 dots a 8dpmm) ────────
    // Si viene escalaForzada (del debounce), se aplica además del fit inicial.
    const MAX_W = 812;
    const MAX_H = 1218;
    const fitScale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
    const totalScale = fitScale * escalaForzada;

    // Dimensiones base sin rotación
    let dotW = Math.round(img.width  * totalScale);
    let dotH = Math.round(img.height * totalScale);

    // Si hay rotación 90/270 las dimensiones del canvas final se invierten
    let canvasW = dotW, canvasH = dotH;
    if (rotacionForzada === 90 || rotacionForzada === 270) {
        canvasW = dotH; canvasH = dotW;
    }
    canvasW = Math.min(canvasW, MAX_W);
    canvasH = Math.min(canvasH, MAX_H);

    // ── 2. Canvas intermedio sin rotación (para sharpening + binarización) ──
    const canvas = document.createElement('canvas');
    canvas.width  = dotW;
    canvas.height = dotH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, dotW, dotH);
    ctx.drawImage(img, 0, 0, dotW, dotH);

    // ── 3. Sharpening: kernel unsharp-mask 5-1-1-1-1 ────────────────────────
    const imageData = ctx.getImageData(0, 0, dotW, dotH);
    const src = new Uint8ClampedArray(imageData.data);
    const dst = imageData.data;
    for (let y = 1; y < dotH - 1; y++) {
        for (let x = 1; x < dotW - 1; x++) {
            const idx = (y * dotW + x) * 4;
            for (let c = 0; c < 3; c++) {
                const v = 5 * src[idx + c]
                    - src[((y-1)*dotW +  x   ) * 4 + c]
                    - src[((y+1)*dotW +  x   ) * 4 + c]
                    - src[( y   *dotW + x - 1) * 4 + c]
                    - src[( y   *dotW + x + 1) * 4 + c];
                dst[idx + c] = Math.max(0, Math.min(255, v));
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);

    // ── 4. Aplicar rotación en canvas final ───────────────────────────────
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width  = canvasW;
    finalCanvas.height = canvasH;
    const fCtx = finalCanvas.getContext('2d');
    fCtx.fillStyle = 'white';
    fCtx.fillRect(0, 0, canvasW, canvasH);
    if (rotacionForzada !== 0) {
        fCtx.save();
        fCtx.translate(canvasW / 2, canvasH / 2);
        fCtx.rotate((rotacionForzada * Math.PI) / 180);
        fCtx.imageSmoothingEnabled = true;
        fCtx.imageSmoothingQuality = 'high';
        fCtx.drawImage(canvas, -dotW / 2, -dotH / 2, dotW, dotH);
        fCtx.restore();
    } else {
        fCtx.drawImage(canvas, 0, 0);
    }

    // ── 5. Binarización adaptativa por bloques ───────────────────────────────
    const pixels = fCtx.getImageData(0, 0, canvasW, canvasH).data;
    const BLOCK = 20;
    const luma = (i) => pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;

    const bytesPerRow = Math.ceil(canvasW / 8);
    let hexData = "";

    for (let y = 0; y < canvasH; y++) {
        const by0 = Math.max(0, y - BLOCK);
        const by1 = Math.min(canvasH - 1, y + BLOCK);
        let rowHex = "";

        for (let bx = 0; bx < bytesPerRow; bx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const px = bx * 8 + bit;
                if (px >= canvasW) break;

                const bx0 = Math.max(0, px - BLOCK);
                const bx1 = Math.min(canvasW - 1, px + BLOCK);
                let sum = 0, count = 0;
                for (let sy = by0; sy <= by1; sy += 4) {
                    for (let sx = bx0; sx <= bx1; sx += 4) {
                        sum += luma((sy * canvasW + sx) * 4);
                        count++;
                    }
                }
                const umbral = (sum / count) * 0.85;
                if (luma((y * canvasW + px) * 4) < umbral) byte |= (1 << (7 - bit));
            }
            rowHex += byte.toString(16).padStart(2, '0').toUpperCase();
        }
        hexData += /^0+$/.test(rowHex) ? "," : rowHex;
    }

    const totalBytes = bytesPerRow * canvasH;
    return {
        gfa:  `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexData}`,
        // dotW/dotH son las dimensiones SIN rotación (para centrado de posición)
        dotW: Math.round(img.width  * fitScale),
        dotH: Math.round(img.height * fitScale)
    };
}

/* ==========================================================================
   PREVIEW CANVAS PROPORCIONAL 4"×6" (812×1218 dots)
   ========================================================================== */

// Dimensiones lógicas de la etiqueta ZT411 a 8dpmm
const ETIQ_W = 812;
const ETIQ_H = 1218;

function actualizarPreviewImagen() {
    if (!imagenActual) return;

    const escala    = parseInt(document.getElementById('escalaImagen').value);
    const posX      = parseInt(document.getElementById('posicionX').value);
    const posY      = parseInt(document.getElementById('posicionY').value);
    const rotacion  = parseInt(document.getElementById('rotacionImagen').value);

    // ── Actualizar labels de los sliders ───────────────────────────────────
    document.getElementById('escalaDisplay').innerText    = `${escala}%`;
    document.getElementById('posicionXDisplay').innerText = posX === 406 ? 'Centro' : `${posX}px`;
    document.getElementById('posicionYDisplay').innerText = posY === 609 ? 'Centro' : `${posY}px`;

    // ── Mostrar el contenedor ──────────────────────────────────────────────
    document.getElementById('previewImagenContainer').style.display = 'block';

    // ── Dibujar en el canvas proporcional ──────────────────────────────────
    dibujarPreviewCanvas(escala / 100, posX, posY, rotacion);

    // ── Debounce: regenerar GFA solo 400ms después de soltar el slider ─────
    debounceGFA(() => regenerarGFAEscalado(escala / 100, rotacion), 400);

    validar();
}

function dibujarPreviewCanvas(escala, posX, posY, rotacion) {
    const canvas = document.getElementById('previewCanvas');
    if (!canvas) return;

    // El canvas interno siempre trabaja en dots (812×1218)
    canvas.width  = ETIQ_W;
    canvas.height = ETIQ_H;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ETIQ_W, ETIQ_H);

    // Grilla tenue de referencia (cada 100 dots ≈ 12.5mm)
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 1;
    for (let x = 0; x <= ETIQ_W; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ETIQ_H); ctx.stroke(); }
    for (let y = 0; y <= ETIQ_H; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ETIQ_W, y); ctx.stroke(); }

    // Cargar la imagen original y dibujarla transformada
    const imgEl = new Image();
    imgEl.onload = () => {
        // Dimensiones en dots de la imagen tras escalar
        let iW = Math.round(imagenActual.dotW * escala);
        let iH = Math.round(imagenActual.dotH * escala);
        if (rotacion === 90 || rotacion === 270) { [iW, iH] = [iH, iW]; }

        // FO (esquina sup. izq.) centrado respecto al punto elegido
        const foX = posX - Math.round(iW / 2);
        const foY = posY - Math.round(iH / 2);

        // Actualizar info de tamaño
        const sizeKB = imagenActual.zplGraphics ? Math.round(imagenActual.zplGraphics.length / 1024) : 0;
        const info = document.getElementById('previewSizeInfo');
        if (info) info.innerText = `${iW}×${iH} dots · ZPL ~${sizeKB}KB`;

        // Dibujar: trasladar al centro del área que ocupará la imagen rotada,
        // luego rotar, luego dibujar con las dimensiones ORIGINALES (sin rotar).
        // ctx.rotate() se encarga del giro — drawImage siempre recibe ancho×alto original.
        const origW = Math.round(imagenActual.dotW * escala);
        const origH = Math.round(imagenActual.dotH * escala);

        ctx.save();
        ctx.translate(foX + iW / 2, foY + iH / 2);
        ctx.rotate((rotacion * Math.PI) / 180);
        ctx.drawImage(imgEl, -origW / 2, -origH / 2, origW, origH);
        ctx.restore();

        // Borde de recorte de etiqueta (lo que se imprime)
        ctx.strokeStyle = '#cc0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, ETIQ_W - 2, ETIQ_H - 2);

        // Marcador de la posición elegida (crosshair)
        ctx.strokeStyle = 'rgba(0,86,179,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(posX, 0);      ctx.lineTo(posX, ETIQ_H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, posY);       ctx.lineTo(ETIQ_W, posY); ctx.stroke();
        ctx.setLineDash([]);
    };
    imgEl.src = imagenActual.src;
}

/* Regenera el GFA a la escala+rotación actual (llamado con debounce) */
async function regenerarGFAEscalado(escala, rotacion) {
    if (!imagenActual?.zplGraphics) return;

    // Si la escala es 1 y rotación 0, el GFA base ya es correcto
    if (escala === 1 && rotacion === 0) return;

    const baseW = imagenActual.dotW;
    const baseH = imagenActual.dotH;

    // Regeneramos desde la imagen original (no del GFA procesado) para máxima calidad
    const imgEl = new Image();
    imgEl.onload = async () => {
        const result = await procesarImagenALocal(imgEl, escala, rotacion);
        if (imagenActual) {
            imagenActual.zplGraphicsCurrent = result.gfa;
            imagenActual.currentEscala      = escala;
            imagenActual.currentRotacion    = rotacion;
            // Actualizar info KB
            const info = document.getElementById('previewSizeInfo');
            if (info) {
                let iW = Math.round(baseW * escala);
                let iH = Math.round(baseH * escala);
                if (rotacion === 90 || rotacion === 270) [iW, iH] = [iH, iW];
                info.innerText = `${Math.min(iW, ETIQ_W)}×${Math.min(iH, ETIQ_H)} dots · ZPL ~${Math.round(result.gfa.length / 1024)}KB`;
            }
        }
    };
    imgEl.src = imagenActual.src;
}

/* ==========================================================================
   ENVÍO A IMPRESIÓN Y PREVIEW
   ========================================================================== */
function mostrarPreview() {
    const zpl = generarZPL();
    const img = document.getElementById('labelaryImage');
    const spinner = document.getElementById('previewSpinner');
    const placeholder = document.getElementById('previewPlaceholder');

    img.classList.add('hidden');
    spinner.classList.add('hidden');
    placeholder.classList.add('hidden');

    if (!zpl || !zpl.trim()) {
        placeholder.innerText = 'No hay contenido para previsualizar. Complete los campos antes de abrir la vista previa.';
        placeholder.classList.remove('hidden');
        document.getElementById('modalPreview').classList.remove('hidden');
        return;
    }

    // Si estamos en modo imagen
    if (modoActual === 'tabModoImagen') {
        if (imagenActual?.procesando) {
            placeholder.innerText = '⏳ Procesando imagen con Labelary API...';
            placeholder.classList.remove('hidden');
        } else if (!imagenActual?.zplGraphics) {
            placeholder.innerText = '⚠️ Imagen no convertida. Intenta cargar nuevamente.';
            placeholder.classList.remove('hidden');
        } else {
            placeholder.innerText = '✓ Imagen convertida por Labelary API. Lista para imprimir.';
            placeholder.style.color = 'var(--primary-color)';
            placeholder.classList.remove('hidden');
        }
        document.getElementById('modalPreview').classList.remove('hidden');
        return;
    }

    spinner.classList.remove('hidden');
    img.onload = () => {
        spinner.classList.add('hidden');
        placeholder.classList.add('hidden');
        img.classList.remove('hidden');
    };
    img.onerror = () => {
        spinner.classList.add('hidden');
        img.classList.add('hidden');
        placeholder.innerText = 'No se pudo cargar la vista previa. Revise el contenido de la etiqueta e intente nuevamente.';
        placeholder.classList.remove('hidden');
    };

    const url = `http://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/${encodeURIComponent(zpl)}`;
    img.src = url;
    document.getElementById('modalPreview').classList.remove('hidden');
}

function cerrarPreview() {
    const img = document.getElementById('labelaryImage');
    const spinner = document.getElementById('previewSpinner');
    const placeholder = document.getElementById('previewPlaceholder');

    img.onload = null;
    img.onerror = null;
    spinner.classList.add('hidden');
    placeholder.classList.add('hidden');
    img.classList.remove('hidden');

    document.getElementById('modalPreview').classList.add('hidden');
    img.src = "";
}

async function imprimir() {
    const ip = document.getElementById('printerIp').value;
    const copias = document.getElementById('copias').value;
    const status = document.getElementById('status');

    if (!ip) return alert("Seleccione impresora");

    if (modoActual === 'tabModoIC') {
        const confirmar = confirm('IMPORTANTE: Estas etiquetas NO reemplazan la declaracion de productos por JDE. ¿Desea continuar con la impresion?');
        if (!confirmar) return;
    }

    if (modoActual === 'tabModoImagen') {
        if (!imagenActual) return alert("Cargue una imagen antes de imprimir");
    }

    let textoHist = modoActual === 'tabEtiquetaLibre' ? 
        document.getElementById('textoEtiqueta').value : 
        (modoActual === 'tabModoImagen' ? `IMAGEN: ${document.getElementById('imagenFile').value.split('\\').pop()}` : `IC: ${document.getElementById('icItem').value}`);

    const tipoHist = modoActual === 'tabEtiquetaLibre' ? 'ETIQUETA' : (modoActual === 'tabModoImagen' ? 'IMAGEN' : 'IC');
    const datosIC = modoActual === 'tabModoIC'
        ? {
            item: document.getElementById('icItem').value,
            lote: document.getElementById('icLote').value,
            cantidad: document.getElementById('icCantidad').value,
            wo: document.getElementById('icWO').value,
            vto: document.getElementById('icVto').value
        }
        : null;

    guardarEnHistorial({ ip, texto: textoHist, tipo: tipoHist, datosIC });

    let zplFinal = generarZPL().replace('^XZ', `^PQ${copias}^XZ`);
    
    // Validar tamaño del ZPL para prevenir saturación de buffer
    if (zplFinal.length > 80000) { //1080000
        status.style.display = "block";
        status.innerText = "❌ ZPL demasiado grande (" + Math.floor(zplFinal.length / 1024) + "KB). Usa imagen más pequeña.";
        status.style.color = "red";
        setTimeout(() => status.style.display = "none", 5000);
        return;
    }
    
    status.style.display = "block";
    status.innerText = "Enviando...";

    try {
        await fetch(`http://${ip}/pstprnt`, { method: 'POST', mode: 'no-cors', body: zplFinal });
        const sizeKB = Math.floor(zplFinal.length / 1024);
        status.innerText = "¡Enviado! (" + sizeKB + "KB)";
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

function activarTabProgramaticamente(nombreTab) {
    cambiarTab(null, nombreTab);
    const botones = document.querySelectorAll('.tab-btn');
    botones.forEach(btn => {
        const esTabActiva = btn.getAttribute('onclick')?.includes(`'${nombreTab}'`);
        btn.classList.toggle('active', !!esTabActiva);
    });
}

function guardarEnHistorial(datos) {
    if (!datos.texto) return;
    historial.unshift({
        id: Date.now(),
        fecha: new Date().toLocaleTimeString(),
        fijada: false,
        ...datos
    });
    historial = historial.slice(0, 10);
    localStorage.setItem('historial', JSON.stringify(historial));
}

function persistirHistorial() {
    localStorage.setItem('historial', JSON.stringify(historial));
}

function eliminarCardHistorial(id) {
    historial = historial.filter(item => item.id !== id);
    persistirHistorial();
    renderizarHistorial();
}

function fijarCardHistorial(id) {
    historial = historial.map(item => item.id === id ? { ...item, fijada: !item.fijada } : item);
    historial.sort((a, b) => {
        const aFijada = !!a.fijada;
        const bFijada = !!b.fijada;
        if (aFijada !== bFijada) return aFijada ? -1 : 1;
        return b.id - a.id;
    });
    persistirHistorial();
    renderizarHistorial();
}

function renderizarHistorial() {
    const lista = document.getElementById('historial-lista');
    lista.innerHTML = '';
    const historialOrdenado = [...historial].sort((a, b) => {
        const aFijada = !!a.fijada;
        const bFijada = !!b.fijada;
        if (aFijada !== bFijada) return aFijada ? -1 : 1;
        return b.id - a.id;
    });

    historialOrdenado.forEach(item => {
        const tipo = item.tipo || (item.texto?.startsWith('IC: ') ? 'IC' : 'ETIQUETA');
        const card = document.createElement('div');
        card.className = 'mini-card';
        if (item.fijada) card.classList.add('mini-card-fijada');
        card.innerHTML = `
            <div class="mini-card-top">
                <h4>${item.fecha} | ${tipo}</h4>
                <div class="mini-card-actions">
                    <button class="mini-card-btn" title="Fijar" aria-label="Fijar">${item.fijada ? '📌' : '📍'}</button>
                    <button class="mini-card-btn" title="Borrar" aria-label="Borrar">✖️</button>
                </div>
            </div>
            <p>${item.texto.substring(0, 30)}...</p>`;

        const btnFijar = card.querySelector('.mini-card-actions .mini-card-btn:nth-child(1)');
        const btnBorrar = card.querySelector('.mini-card-actions .mini-card-btn:nth-child(2)');

        btnFijar.addEventListener('click', (event) => {
            event.stopPropagation();
            fijarCardHistorial(item.id);
        });

        btnBorrar.addEventListener('click', (event) => {
            event.stopPropagation();
            eliminarCardHistorial(item.id);
        });

        card.addEventListener('click', () => cargarDesdeHistorial(item));
        lista.appendChild(card);
    });
}

function cargarDesdeHistorial(item) {
    if (!item || !item.texto) return;

    if (item.tipo === 'IC' || item.texto.startsWith('IC: ')) {
        activarTabProgramaticamente('tabModoIC');
        const inputItem = document.getElementById('icItem');
        const inputLote = document.getElementById('icLote');
        const inputCantidad = document.getElementById('icCantidad');
        const inputWO = document.getElementById('icWO');
        const inputVto = document.getElementById('icVto');

        const codigo = item.datosIC?.item || item.texto.replace('IC: ', '').trim();
        inputItem.value = codigo;
        inputLote.value = item.datosIC?.lote || '';
        inputCantidad.value = item.datosIC?.cantidad || '';
        inputWO.value = item.datosIC?.wo || '';
        inputVto.value = item.datosIC?.vto || '';
        autoCompletarDescripcion();
        return;
    }

    activarTabProgramaticamente('tabEtiquetaLibre');
    document.getElementById('textoEtiqueta').value = item.texto;
    validar();
}

function limpiarHistorial() {
    historial = historial.filter(item => !!item.fijada);
    if (historial.length === 0) {
        localStorage.removeItem('historial');
    } else {
        persistirHistorial();
    }
    renderizarHistorial();
}
