/* ==========================================================================
   CONFIGURACIÓN MAESTRA (Edita aquí para agregar impresoras)
   ========================================================================== */
const MODO_RESTRINGIDO = false; // 🔓 FALSE: Modo Libre | 🔒 TRUE: Pide contraseñas

const CONFIG_IMPRESORAS = {
    "10.54.204.171": { nombre: "CONSERVAS", clave: "con2026" },
    "10.54.204.152": { nombre: "PASTA",     clave: "pas2026" },
    "10.54.204.151": { nombre: "ETIQUETADO", clave: "eti2026" }
};

let baseDeProductos = {};
let ultimaImpresora = ""; 
let historial = JSON.parse(localStorage.getItem('historial')) || [];

/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */
window.onload = async () => {
    document.getElementById('fechaEtiqueta').value = new Date().toISOString().split('T')[0];
    document.getElementById('copias').addEventListener('input', validarSeguridad);

    try {
        const response = await fetch('productos.json');
        if (!response.ok) throw new Error("No se pudo cargar la base de productos");
        baseDeProductos = await response.json();
    } catch (error) {
        console.error("Error al cargar JSON:", error);
    }

    validarSeguridad();
    
    // Cargar Modo Noche guardado
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        const icon = document.getElementById('theme-icon');
        if(icon) icon.innerText = savedTheme === 'dark' ? '☀️' : '🌙';
    }
};

/* ==========================================================================
   GESTIÓN DE SEGURIDAD (PASSWORDS Y LÍMITES)
   ========================================================================== */

function verificarPasswordImpresora() {
    const select = document.getElementById('printerIp');
    const ipSeleccionada = select.value;

    // Si el modo restringido está apagado, autorizamos la impresora automáticamente
    if (!MODO_RESTRINGIDO) {
        ultimaImpresora = ipSeleccionada;
        console.log("Modo Libre: Impresora autorizada sin clave.");
        return; 
    }

    // Si está prendido, ejecutamos la lógica de siempre
    if (ipSeleccionada !== "" && ipSeleccionada !== ultimaImpresora) {
        document.getElementById('modalContentPassword').classList.remove('hidden');
        document.getElementById('modalContentAlerta').classList.add('hidden');
        document.getElementById('passImpresora').value = "";
        mostrarModal();
    }
}

function validarPassword() {
    const passInput = document.getElementById('passImpresora');
    const select = document.getElementById('printerIp');
    const ipSeleccionada = select.value;
    const config = CONFIG_IMPRESORAS[ipSeleccionada];

    if (config && passInput.value === config.clave) {
        ultimaImpresora = ipSeleccionada;
        cerrarModal();
        alert(`✅ Acceso concedido a: ${config.nombre}`);
    } else {
        alert("❌ Contraseña incorrecta para esta impresora");
        passInput.value = "";
    }
}

function cancelarSeleccion() {
    document.getElementById('printerIp').value = ultimaImpresora;
    cerrarModal();
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

/* ==========================================================================
   SISTEMA DE HISTORIAL Y SIDEBAR
   ========================================================================== */

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    renderizarHistorial();
}

function guardarEnHistorial(datos) {
    if (!datos.texto) return;
    const nuevaEntrada = { id: Date.now(), fecha: new Date().toLocaleTimeString(), ...datos };
    historial.unshift(nuevaEntrada); 
    historial = historial.slice(0, 10);
    localStorage.setItem('historial', JSON.stringify(historial));
}

function renderizarHistorial() {
    const lista = document.getElementById('historial-lista');
    lista.innerHTML = '';
    historial.forEach(item => {
        const nombreImp = CONFIG_IMPRESORAS[item.ip]?.nombre || "DESCONOCIDA";
        const card = document.createElement('div');
        card.className = 'mini-card';
        card.onclick = () => cargarParaReimprimir(item);
        card.innerHTML = `<h4>${item.fecha} - ${nombreImp}</h4><p>${item.texto.substring(0, 40)}...</p>`;
        lista.appendChild(card);
    });
}

function cargarParaReimprimir(item) {
    document.getElementById('printerIp').value = item.ip;
    ultimaImpresora = item.ip; 
    document.getElementById('textoEtiqueta').value = item.texto;
    document.getElementById('tamano').value = item.tamano;
    document.getElementById('orientacion').value = item.orientacion;
    toggleSidebar();
    validar(); // Agregado para que valide los límites al cargar
}

function limpiarHistorial() {
    historial = [];
    localStorage.removeItem('historial');
    renderizarHistorial();
}

/* ==========================================================================
   LÓGICA DE INTERFAZ Y MODO NOCHE
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

function validar() {
    const textarea = document.getElementById('textoEtiqueta');
    const texto = textarea.value;
    const tamano = document.getElementById('tamano').value;
    const status = document.getElementById('status');

    // Reset de estilos y visibilidad
    status.style.display = "none";
    status.style.padding = "0";

    if (tamano === "210") {
        // Bloqueo físico
        textarea.setAttribute('maxlength', '15');
        
        if (texto.length > 15) {
            // Recorte automático si cambia de tamaño con mucho texto
            textarea.value = texto.substring(0, 15);
            status.style.display = "block";
            status.style.padding = "10px";
            status.innerText = "⚠️ MÁXIMO 15 CARACTERES";
            status.style.color = "var(--error-color)";
        } else if (texto.length === 15) {
            // Aviso discreto de límite alcanzado
            status.style.display = "block";
            status.style.padding = "10px";
            status.innerText = "⛔ LÍMITE ALCANZADO";
            status.style.color = "var(--error-color)";
        }
    } else {
        // En cualquier otro tamaño, libertad total de escritura
        textarea.removeAttribute('maxlength');
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
   CORE: GENERACIÓN Y ENVÍO ZPL
   ========================================================================== */

/**
 * Función Maestra para generar el código ZPL base.
 */
function generarZPL() {
    const textoPrincipal = document.getElementById('textoEtiqueta').value.toUpperCase().trim();
    const size = parseInt(document.getElementById('tamano').value);
    const orient = document.getElementById('orientacion').value;
    const modoInvertido = document.getElementById('chkInversion').checked;

    let zpl = `^XA^PW812^LL1218`;
    if (modoInvertido) zpl += `^FO0,0^GB812,1218,1218^FS`;

    if (document.getElementById('chkEncabezado').checked) {
        const val = document.getElementById('selectProducto').value;
        if (val) {
            const [cod, desc] = val.split('|');
            const f = document.getElementById('fechaEtiqueta').value.split('-').reverse().join('/');
            const txt = `${cod} ${desc} ${f}`;
            const r = modoInvertido ? "^FR" : "";
            zpl += orient === 'V' ? `^FO20,30^A0N,28,28${r}^FD${txt}^FS` : `^FO750,20^A0R,28,28${r}^FD${txt}^FS`;
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

    return zpl;
}


/* ==========================================================================
   PREVIEW CON LABELARY
   ========================================================================== */
function mostrarPreview() {
    const texto = document.getElementById('textoEtiqueta').value.trim();
    const conEncabezado = document.getElementById('chkEncabezado').checked;

    // VALIDACIÓN RECUPERADA
    if (texto === "" && !conEncabezado) {
        alert("⚠️ Por favor, escriba el contenido de la etiqueta o active el encabezado.");
        return;
    }

    const zpl = generarZPL() + `^XZ`; 
    const imgElement = document.getElementById('labelaryImage');
    const modal = document.getElementById('modalPreview');
    
    // Labelary API - Se mantiene fiel a la impresión real
    const url = `http://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/${encodeURIComponent(zpl)}`;
    
    imgElement.src = url;
    modal.classList.remove('hidden');
}

function cerrarPreview() {
    const modal = document.getElementById('modalPreview');
    const modalBox = document.querySelector('.preview-content');
    
    modal.classList.add('hidden');
    modalBox.classList.remove('landscape'); // Limpiamos la rotación
    document.getElementById('labelaryImage').src = ""; 
}

/* ==========================================================================
   IMPRESIÓN REAL
   ========================================================================== */
async function imprimir() {
    const ip = document.getElementById('printerIp').value;
    const copias = parseInt(document.getElementById('copias').value);
    const status = document.getElementById('status');

    if (ip === "" || copias > 10) {
        document.getElementById('modalContentPassword').classList.add('hidden');
        document.getElementById('modalContentAlerta').classList.remove('hidden');
        document.getElementById('mensajeAlerta').innerText = ip === "" ? "Seleccione impresora." : "Máximo 10 copias.";
        mostrarModal();
        return;
    }

    // Guardar en historial
    const textoPrincipal = document.getElementById('textoEtiqueta').value.toUpperCase().trim();
    const size = parseInt(document.getElementById('tamano').value);
    const orient = document.getElementById('orientacion').value;
    guardarEnHistorial({ ip, texto: textoPrincipal, tamano: size, orientacion: orient });
    
    // Si el sidebar está abierto, lo cerramos
    document.getElementById('sidebar').classList.remove('active');

    // Generar ZPL final con copias
    let zplFinal = generarZPL();
    zplFinal += `^PQ${copias}^XZ`;

    // UI Feedback
    status.style.display = "block";
    status.style.padding = "10px";
    status.innerText = "Enviando...";
    status.style.color = "var(--text-main)";

    try {
        await fetch(`http://${ip}/pstprnt`, { method: 'POST', mode: 'no-cors', body: zplFinal });
        status.innerText = "¡Enviado!";
        status.style.color = "green";
    } catch (e) {
        status.innerText = "Error conexión";
        status.style.color = "red";
    }
    
    setTimeout(() => { 
        status.style.display = "none"; 
        status.style.padding = "0"; 
    }, 3000);
}