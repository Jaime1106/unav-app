// js/app.js

// --- 1. ESTADO DE LA APLICACIÓN ---
let appState = {
    settings: {
        isVoiceActive: true,
        avoidStairs: true,
        prioritizeElevators: false,
        highContrastMode: false,
    },
    quickDestinations: [
        { name: 'Biblioteca', icon: 'BookOpen', action: 'Biblioteca' },
        { name: 'Cafetería', icon: 'Utensils', action: 'Cafetería' },
        { name: 'Parking', icon: 'Car', action: 'Parking' },
        { name: 'Entrada', icon: 'Send', action: 'Entrada Principal' },
    ],
    accessibilityOptions: [
        { key: 'isVoiceActive', label: 'Activar guía de voz automáticamente' },
        { key: 'avoidStairs', label: 'Evitar escaleras cuando sea posible' },
        { key: 'prioritizeElevators', label: 'Priorizar rutas con ascensor' },
        { key: 'highContrastMode', label: 'Modo alto contraste' },
    ]
};

// --- 2. LÓGICA DE VOZ (TTS) ---
const voiceGuide = {
    isSpeaking: false,
    // Función para iniciar la lectura de un texto
    speak: (text) => {
        // Solo hablar si la guía está activa y no hay otro discurso en curso
        if (!appState.settings.isVoiceActive || voiceGuide.isSpeaking) return;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1.0; 

            utterance.onstart = () => { voiceGuide.isSpeaking = true; };
            utterance.onend = () => { voiceGuide.isSpeaking = false; };
            utterance.onerror = (e) => { 
                console.error('Error TTS:', e); 
                voiceGuide.isSpeaking = false;
            };

            window.speechSynthesis.speak(utterance);
        } else {
            console.warn("La API de Síntesis de Voz no es compatible.");
        }
    },
    // Función para detener la lectura
    cancel: () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            voiceGuide.isSpeaking = false;
        }
    }
};

// --- 3. FUNCIONES DE RENDERIZADO Y ACTUALIZACIÓN ---

/**
 * Dibuja los botones de acceso rápido en el DOM.
 */
function renderQuickAccessButtons() {
    const container = document.getElementById('quick-access-buttons');
    if (!container) return;

    const highContrast = appState.settings.highContrastMode;

    container.innerHTML = appState.quickDestinations.map(dest => {
        const iconColor = highContrast ? 'text-yellow-500' : 'text-red-600';
        const buttonClasses = highContrast 
            ? 'bg-gray-800 border-yellow-500 text-yellow-300 hover:bg-gray-700'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300';
        
        // El icono se inserta usando la clase de Lucide
        return `
            <button 
                data-action="${dest.action}"
                class="quick-access-btn flex items-center justify-center p-3 sm:p-4 border rounded-xl shadow-md transition-all text-sm font-semibold w-full h-16 sm:h-20 text-center ${buttonClasses}"
                aria-label="Acceso rápido a ${dest.name}"
            >
                <div class="flex flex-col sm:flex-row items-center">
                    <i data-lucide="${dest.icon}" class="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-0 sm:mr-2 ${iconColor}"></i>
                    <span>${dest.name}</span>
                </div>
            </button>
        `;
    }).join('');
    // Necesario para que Lucide convierta las etiquetas <i> en SVG
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

/**
 * Dibuja la sección de configuración de accesibilidad en el DOM.
 */
function renderAccessibilityOptions() {
    const container = document.getElementById('accessibility-options');
    if (!container) return;
    
    const highContrast = appState.settings.highContrastMode;

    container.innerHTML = appState.accessibilityOptions.map(option => {
        const checked = appState.settings[option.key];
        
        // Clases condicionales para el checkbox
        const checkboxClasses = checked 
            ? highContrast ? 'bg-yellow-300 border-yellow-300' : 'bg-red-700 border-red-700'
            : highContrast ? 'bg-gray-800 border-gray-500' : 'bg-white border-gray-400';
        
        const itemClasses = highContrast 
            ? (checked ? 'border-yellow-300 bg-gray-700' : 'border-gray-500 bg-gray-800')
            : (checked ? 'bg-red-50 border-red-200 shadow-sm' : 'hover:bg-gray-50 border-gray-100');
        
        const labelClasses = highContrast ? 'text-yellow-300' : 'text-gray-700';
        const checkmarkColor = highContrast ? 'text-black' : 'text-white';

        return `
            <div 
                data-key="${option.key}" 
                class="accessibility-option flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${itemClasses}"
                tabindex="0"
                role="checkbox"
                aria-checked="${checked}"
                aria-label="${option.label}"
            >
                <span class="font-medium text-sm sm:text-base ${labelClasses}">${option.label}</span>
                <div class="w-5 h-5 flex items-center justify-center rounded-sm border-2 transition-colors ${checkboxClasses}">
                    ${checked ? `<i data-lucide="x" class="w-4 h-4 font-bold stroke-[3] ${checkmarkColor}"></i>` : ''}
                </div>
            </div>
        `;
    }).join('');
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

/**
 * Aplica los estilos y clases de Tailwind basados en el estado de Alto Contraste.
 */
function applyHighContrastStyles() {
    const highContrast = appState.settings.highContrastMode;
    const body = document.body;
    const card = document.getElementById('main-card');
    const header = document.getElementById('header');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const navButton = document.getElementById('navigate-button');

    // Body Background (usa la clase CSS en el body)
    body.classList.toggle('high-contrast-mode', highContrast);
    body.classList.toggle('bg-gray-100', !highContrast);

    // Clases condicionales de Tailwind
    const hcClass = highContrast ? 'bg-gray-900 border-yellow-500' : 'bg-white border-gray-100';
    const hcHeader = highContrast ? 'bg-gray-900 border-b-2 border-yellow-500' : 'bg-red-700';
    const searchInputClasses = highContrast 
        ? "bg-gray-800 text-yellow-300 border-yellow-500 placeholder-yellow-600 focus:ring-yellow-500 focus:border-yellow-500"
        : "border-gray-300 text-gray-900 focus:ring-red-500 focus:border-red-500";
    
    // Aplicar clases a elementos principales
    header.className = `shadow-xl p-4 sm:p-5 sticky top-0 z-10 transition-colors duration-300 ${hcHeader}`;
    card.className = `rounded-xl shadow-2xl p-6 sm:p-8 border transition-all duration-300 ${hcClass}`;
    searchInput.className = `w-full p-3 pl-10 border rounded-xl focus:ring-2 transition-shadow ${searchInputClasses}`;

    // Toggle de clases específicas para textos e iconos
    document.getElementById('header-title').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('header-title').classList.toggle('text-white', !highContrast);

    document.getElementById('header-subtitle').classList.toggle('text-yellow-100', highContrast);
    document.getElementById('header-subtitle').classList.toggle('text-red-100', !highContrast);
    
    document.getElementById('header-icon').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('header-icon').classList.toggle('text-white', !highContrast);

    document.getElementById('main-title').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('main-title').classList.toggle('text-gray-900', !highContrast);
    
    document.getElementById('main-description').classList.toggle('text-yellow-400', highContrast);
    document.getElementById('main-description').classList.toggle('text-gray-500', !highContrast);

    searchIcon.classList.toggle('text-yellow-500', highContrast);
    searchIcon.classList.toggle('text-gray-400', !highContrast);
    
    navButton.classList.toggle('bg-yellow-500', highContrast);
    navButton.classList.toggle('hover:bg-yellow-600', highContrast);
    navButton.classList.toggle('text-black', highContrast);
    navButton.classList.toggle('bg-red-600', !highContrast);
    navButton.classList.toggle('hover:bg-red-700', !highContrast);
    navButton.classList.toggle('text-white', !highContrast);

    // Sección de Accesibilidad
    document.getElementById('accessibility-title').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('accessibility-title').classList.toggle('text-gray-800', !highContrast);
    
    document.getElementById('accessibility-icon').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('accessibility-icon').classList.toggle('text-red-600', !highContrast);
    
    // Re-renderizar elementos internos que dependen del estado HC
    renderQuickAccessButtons();
    renderAccessibilityOptions();
}

/**
 * Función central que actualiza la UI llamando a todas las funciones de renderizado.
 */
function updateUI() {
    applyHighContrastStyles();
}

// --- 4. MANEJO DE EVENTOS ---

/**
 * Alterna el estado de una opción de accesibilidad y actualiza la UI.
 */
function toggleAccessibilityOption(key) {
    voiceGuide.cancel();
    
    appState.settings[key] = !appState.settings[key];

    // Si se activa/desactiva el modo de Alto Contraste, debemos llamar a updateUI
    if (key === 'highContrastMode') {
        updateUI();
    } else {
        // Para otras opciones, solo re-renderizamos las opciones de accesibilidad
        renderAccessibilityOptions();
    }
    
    // Feedback de voz
    if (appState.settings.isVoiceActive) {
        const option = appState.accessibilityOptions.find(o => o.key === key);
        if (option) {
            const status = appState.settings[key] ? 'activada' : 'desactivada';
            voiceGuide.speak(`${option.label} ${status}.`);
        }
    }
}

/**
 * Simula el inicio de la navegación y proporciona feedback de voz.
 */
function startNavigation(destination) {
    // Lógica de navegación simulada
    voiceGuide.speak(`Iniciando navegación a ${destination}. Por favor, busque un punto de partida.`);
}

// --- 5. INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar la UI y estilos
    updateUI();
    
    // Mensaje de bienvenida inicial
    setTimeout(() => {
        if(appState.settings.isVoiceActive) {
            voiceGuide.speak("Bienvenido a UniNav, tu guía de navegación universitaria.");
        }
    }, 1000); 

    // 5.1. Listener para los botones de acceso rápido (Delegación)
    document.getElementById('quick-access-buttons')?.addEventListener('click', (event) => {
        const button = event.target.closest('.quick-access-btn');
        if (button) {
            const destination = button.dataset.action;
            startNavigation(destination);
        }
    });

    // 5.2. Listener para las opciones de accesibilidad (Delegación)
    document.getElementById('accessibility-options')?.addEventListener('click', (event) => {
        const optionDiv = event.target.closest('.accessibility-option');
        if (optionDiv) {
            const key = optionDiv.dataset.key;
            toggleAccessibilityOption(key);
        }
    });

    // 5.3. Listener para el campo de búsqueda y botón de navegación
    const searchInput = document.getElementById('search-input');
    const navigateButton = document.getElementById('navigate-button');
    
    if (searchInput && navigateButton) {
        searchInput.addEventListener('input', (e) => {
            const hasText = e.target.value.trim().length > 0;
            // Mostrar/Ocultar el botón de navegación con animación
            navigateButton.classList.toggle('opacity-0', !hasText);
            navigateButton.classList.toggle('pointer-events-none', !hasText);
            navigateButton.classList.toggle('opacity-100', hasText);
        });

        // Listener para el botón de navegación (al buscar)
        navigateButton.addEventListener('click', () => {
            const destination = searchInput.value.trim();
            if (destination) {
                startNavigation(destination);
            }
        });
        
        // Permitir navegación al presionar Enter en el input de búsqueda
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita el submit de formulario si existiera
                const destination = searchInput.value.trim();
                if (destination) {
                    startNavigation(destination);
                }
            }
        });
    }
});
