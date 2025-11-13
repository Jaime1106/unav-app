// --- 1. ESTADO DE LA APLICACIÓN ---
let appState = {
    settings: {
        isVoiceActive: true,
        avoidStairs: true,
        prioritizeElevators: false,
        highContrastMode: false,
        useGPS: true,
        voiceCommands: true
    },
    quickDestinations: [
        // Estos se llenarán dinámicamente
    ],
    accessibilityOptions: [
        { key: 'isVoiceActive', label: 'Activar guía de voz automáticamente' },
        { key: 'avoidStairs', label: 'Evitar escaleras cuando sea posible' },
        { key: 'prioritizeElevators', label: 'Priorizar rutas con ascensor' },
        { key: 'highContrastMode', label: 'Modo alto contraste' },
        { key: 'useGPS', label: 'Usar GPS para ubicación en tiempo real' },
        { key: 'voiceCommands', label: 'Activar comandos por voz' }
    ],
    currentLocation: null,
    selectedDestination: null,
    map: null,
    gpsWatchId: null,
    isTracking: false,
    campusGraph: null,
    currentRoute: null,
    navigationActive: false,
    lastInstructionIndex: -1,
    isListening: false,
    manualMode: false,
    buildingData: null
};

// --- 2. DICCIONARIO DE COMANDOS DE VOZ MEJORADO ---
const voiceCommandsDictionary = {
    // Comandos de navegación con múltiples variantes
    navigate: [
        'navegar', 'ir', 'dirección', 'llevar', 'rumbo', 'vamos', 'vayamos', 'dirigir',
        'vamos a', 'ir a', 'navegar a', 'llevar a', 'dirigir a', 'rumbo a',
        'quiero ir', 'necesito ir', 'deseo ir', 'me lleva', 'llévame', 'muéstrame el camino a',
        'quiero llegar a', 'deseo llegar a', 'cómo llego a', 'ruta a', 'camino a'
    ],
    
    // Destinos rápidos
    destinations: {
        'biblioteca': ['biblioteca', 'libros', 'estudio', 'lectura', 'salón de estudio', 'zona de estudio'],
        'cafetería': ['cafetería', 'comer', 'almorzar', 'comida', 'almuerzo', 'restaurante', 'cena', 'refrigerio'],
        'parking': ['parking', 'estacionamiento', 'parqueadero', 'coche', 'carro', 'vehículo', 'auto', 'moto'],
        'entrada': ['entrada', 'entrar', 'principal', 'acceso', 'puerta', 'ingreso', 'acceso principal'],
        'coliseo': ['coliseo', 'auditorio', 'eventos', 'conciertos', 'presentaciones', 'actos'],
        'cancha': ['cancha', 'deportes', 'fútbol', 'baloncesto', 'deporte', 'ejercicio', 'deportiva'],
        'enfermería': ['enfermería', 'enfermeria', 'médico', 'doctor', 'salud', 'emergencia', 'clínica'],
        'creatio': ['creatio', 'laboratorio', 'lab', 'tecnología', 'innovación', 'creativo'],
        'multidiomas': ['multidiomas', 'idiomas', 'lenguas', 'inglés', 'francés', 'alemán', 'portugués'],
        'ced': ['ced', 'centro', 'desarrollo', 'emprendimiento', 'innovación empresarial'],
        'gimnasio': ['gimnasio', 'ejercicio', 'deporte', 'baile', 'danza', 'fitness', 'entrenamiento']
    },
    
    // Bloques académicos
    blocks: {
        'Bloque 1': ['bloque 1', 'bloque uno', 'edificio 1', 'edificio uno', 'bloque uno'],
        'Bloque 2': ['bloque 2', 'bloque dos', 'edificio 2', 'edificio dos', 'bloque dos'],
        'Bloque 4': ['bloque 4', 'bloque cuatro', 'edificio 4', 'edificio cuatro', 'bloque cuatro'],
        'Bloque 5': ['bloque 5', 'bloque cinco', 'edificio 5', 'edificio cinco', 'bloque cinco'],
        'Bloque 6': ['bloque 6', 'bloque seis', 'edificio 6', 'edificio seis', 'bloque seis'],
        'Bloque 7': ['bloque 7', 'bloque siete', 'edificio 7', 'edificio siete', 'bloque siete'],
        'Bloque 8': ['bloque 8', 'bloque ocho', 'edificio 8', 'edificio ocho', 'bloque ocho'],
        'Bloque 9': ['bloque 9', 'bloque nueve', 'edificio 9', 'edificio nueve', 'bloque nueve'],
        'Bloque 10': ['bloque 10', 'bloque diez', 'edificio 10', 'edificio diez', 'bloque diez'],
        'Bloque 11': ['bloque 11', 'bloque once', 'edificio 11', 'edificio once', 'bloque once'],
        'Bloque 12': ['bloque 12', 'bloque doce', 'edificio 12', 'edificio doce', 'bloque doce']
    },
    
    // Comandos de control
    control: {
        'detener': ['detener', 'parar', 'cancelar', 'terminar', 'stop', 'finalizar', 'acabar', 'basta'],
        'gps activar': ['activar gps', 'encender gps', 'iniciar gps', 'prender gps', 'conectar gps', 'usar gps'],
        'gps desactivar': ['desactivar gps', 'apagar gps', 'detener gps', 'desconectar gps', 'no usar gps'],
        'ubicación': ['dónde estoy', 'mi ubicación', 'ubicación actual', 'estoy aquí', 'localización', 'en dónde estoy'],
        'repetir': ['repetir instrucción', 'repite', 'otra vez', 'de nuevo', 'repítelo', 'qué dijo', 'no entendí'],
        'siguiente': ['siguiente instrucción', 'próxima instrucción', 'siguiente', 'continúa', 'adelante', 'sigue'],
        'puntos': ['puntos cercanos', 'puntos de interés', 'qué hay cerca', 'lugares cercanos', 'sitios cerca', 'qué hay alrededor'],
        'ayuda': ['ayuda', 'comandos', 'qué puedo decir', 'opciones', 'instrucciones', 'dime los comandos', 'qué comandos hay']
    },
    
    // Modo manual
    manual: {
        'manual activar': ['modo manual', 'ubicación manual', 'establecer ubicación', 'poner ubicación', 'marcar ubicación'],
        'manual desactivar': ['quitar ubicación', 'eliminar ubicación', 'limpiar ubicación', 'desactivar manual', 'salir manual', 'borrar ubicación']
    }
};

// --- 3. SISTEMA DE DESTINOS MEJORADO ---
const destinationsSystem = {
    // Categorías de destinos
    categories: [
        {
            id: 'entradas',
            name: '🚪 Entradas',
            icon: 'door-open',
            items: [
                { name: 'entrada Calle 58', displayName: 'Entrada Calle 58' },
                { name: 'entrada cul', displayName: 'Entrada CUL' }
            ]
        },
        {
            id: 'bloques',
            name: '🏫 Bloques Académicos',
            icon: 'building',
            items: [] // Se llenará dinámicamente
        },
        {
            id: 'servicios',
            name: '🏥 Servicios',
            icon: 'heart',
            items: [
                { name: 'Biblioteca CUC', displayName: 'Biblioteca' },
                { name: 'Central', displayName: 'Cafetería Central' },
                { name: 'Enfermeria', displayName: 'Enfermería' },
                { name: 'Creatio lab', displayName: 'Creatio Lab' },
                { name: 'Multidiomas', displayName: 'Centro de Idiomas' },
                { name: 'CED', displayName: 'CED' },
                { name: 'salones CUL', displayName: 'Salones CUL' }
            ]
        },
        {
            id: 'deportes',
            name: '⚽ Deportes',
            icon: 'dumbbell',
            items: [
                { name: 'Cancha multiple', displayName: 'Cancha Múltiple' },
                { name: 'Gimnasio y salon de baile', displayName: 'Gimnasio' },
                { name: 'Coliseo auditorio', displayName: 'Coliseo Auditorio' }
            ]
        },
        {
            id: 'parqueaderos',
            name: '🅿️ Parqueaderos',
            icon: 'car',
            items: [
                { name: 'Parqueaderos zona sur', displayName: 'Parqueadero Sur' },
                { name: 'Parqueaderos carros y motos Zona norte', displayName: 'Parqueadero Norte' },
                { name: 'Parqueadero carros y motos zona norte', displayName: 'Parqueadero Norte 2' }
            ]
        },
        {
            id: 'plazoletas',
            name: '🌳 Plazoletas',
            icon: 'square',
            items: [
                { name: 'Plazoleta Principal', displayName: 'Plazoleta Principal' },
                { name: 'Plazoleta coliseo', displayName: 'Plazoleta Coliseo' },
                { name: 'Plazoleta central', displayName: 'Plazoleta Central' },
                { name: 'Plazoleta bloque 10 y 11', displayName: 'Plazoleta Bloques 10-11' }
            ]
        },
        {
            id: 'servicios_aux',
            name: '🚻 Servicios Auxiliares',
            icon: 'wc',
            items: [
                { name: 'baños hombres cancha', displayName: 'Baños Cancha' },
                { name: 'Bloque 9 Baños', displayName: 'Baños Bloque 9' },
                { name: 'Baños de hombres central', displayName: 'Baños Central Hombres' },
                { name: 'Baños de mujeres central', displayName: 'Baños Central Mujeres' },
                { name: 'Baños multidiomas', displayName: 'Baños Multidiomas' },
                { name: 'Container de comida', displayName: 'Container Comida' },
                { name: 'Salones container', displayName: 'Salones Container' },
                { name: 'Containers', displayName: 'Containers' }
            ]
        }
    ],

    // Inicializar sistema de destinos
    init: function(buildingData) {
        this.extractBlocksFromData(buildingData);
        this.generateQuickDestinations();
    },

    // CORREGIDO - Extraer bloques de los datos del edificio SIN DUPLICADOS
    extractBlocksFromData: function(buildingData) {
        const blocksCategory = this.categories.find(cat => cat.id === 'bloques');
        if (!blocksCategory) return;

        blocksCategory.items = [];
        const uniqueBlocks = new Set();
        
        buildingData.features.forEach(feature => {
            const name = feature.properties.name;
            if (name && name.toLowerCase().includes('bloque')) {
                // Extraer número del bloque y crear nombre consistente
                const blockMatch = name.match(/bloque\s*(\d+)/i);
                let displayName = name;
                
                if (blockMatch) {
                    const blockNumber = blockMatch[1];
                    displayName = `Bloque ${blockNumber}`;
                    
                    // Evitar duplicados usando el número como clave
                    if (!uniqueBlocks.has(blockNumber)) {
                        uniqueBlocks.add(blockNumber);
                        
                        blocksCategory.items.push({
                            name: name,
                            displayName: displayName,
                            blockNumber: parseInt(blockNumber)
                        });
                    }
                } else {
                    // Para bloques sin número, usar el nombre completo
                    if (!uniqueBlocks.has(name)) {
                        uniqueBlocks.add(name);
                        blocksCategory.items.push({
                            name: name,
                            displayName: displayName
                        });
                    }
                }
            }
        });

        // Ordenar bloques numéricamente
        blocksCategory.items.sort((a, b) => {
            const numA = a.blockNumber || parseInt(a.displayName.match(/\d+/)) || 0;
            const numB = b.blockNumber || parseInt(b.displayName.match(/\d+/)) || 0;
            return numA - numB;
        });

        console.log('Bloques cargados sin duplicados:', blocksCategory.items);
    },

    // Generar destinos rápidos
    generateQuickDestinations: function() {
        appState.quickDestinations = [
            // Destinos principales
            { name: 'Biblioteca', icon: 'BookOpen', action: 'Biblioteca CUC', category: 'servicios' },
            { name: 'Cafetería', icon: 'Utensils', action: 'Central', category: 'servicios' },
            { name: 'Entrada', icon: 'DoorOpen', action: 'entrada Calle 58', category: 'entradas' },
            { name: 'Parking', icon: 'Car', action: 'Parqueaderos zona sur', category: 'parqueaderos' },
            
            // Destinos adicionales populares
            { name: 'Coliseo', icon: 'Users', action: 'Coliseo auditorio', category: 'deportes' },
            { name: 'Enfermería', icon: 'Heart', action: 'Enfermeria', category: 'servicios' },
            { name: 'Bloque 1', icon: 'Building', action: 'Bloque 1', category: 'bloques' },
            { name: 'Cancha', icon: 'Activity', action: 'Cancha multiple', category: 'deportes' }
        ];
    },

    // Obtener todos los destinos para búsqueda
    getAllDestinations: function() {
        const allDestinations = [];
        this.categories.forEach(category => {
            category.items.forEach(item => {
                allDestinations.push({
                    name: item.name,
                    displayName: item.displayName,
                    category: category.name,
                    icon: category.icon
                });
            });
        });
        return allDestinations;
    },

    // Buscar destino por nombre o alias
    findDestination: function(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const allDestinations = this.getAllDestinations();
        
        // Búsqueda exacta
        let destination = allDestinations.find(dest => 
            dest.name.toLowerCase() === term || 
            dest.displayName.toLowerCase() === term
        );
        
        if (destination) return destination;

        // Búsqueda parcial
        destination = allDestinations.find(dest => 
            dest.name.toLowerCase().includes(term) || 
            dest.displayName.toLowerCase().includes(term)
        );
        
        if (destination) return destination;

        // Búsqueda en categorías
        for (const [key, aliases] of Object.entries(voiceCommandsDictionary.destinations)) {
            if (aliases.some(alias => term.includes(alias))) {
                return allDestinations.find(dest => 
                    dest.displayName.toLowerCase().includes(key)
                );
            }
        }

        // Búsqueda en bloques
        for (const [block, aliases] of Object.entries(voiceCommandsDictionary.blocks)) {
            if (aliases.some(alias => term.includes(alias))) {
                return allDestinations.find(dest => 
                    dest.name.toLowerCase() === block.toLowerCase()
                );
            }
        }

        return null;
    }
};

// --- 4. LÓGICA DE VOZ (TTS) MEJORADA ---
const voiceGuide = {
    isSpeaking: false,
    lastInstruction: '',
    speechQueue: [],
    isProcessingQueue: false,
    
    // Cola de mensajes para evitar superposición
    speak: (text, priority = false) => {
        if (!appState.settings.isVoiceActive) return;
        
        // No repetir la misma instrucción inmediatamente
        if (text === voiceGuide.lastInstruction && !priority) return;

        // Limitar longitud del texto para evitar mensajes largos
        const maxLength = 200;
        const truncatedText = text.length > maxLength ? 
            text.substring(0, maxLength) + '...' : text;

        if ('speechSynthesis' in window) {
            // Cancelar solo si no es prioridad alta
            if (voiceGuide.isSpeaking && !priority) {
                window.speechSynthesis.cancel();
            }
            
            const utterance = new SpeechSynthesisUtterance(truncatedText);
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            utterance.volume = 1.0;
            utterance.pitch = 1.0;

            utterance.onstart = () => { 
                voiceGuide.isSpeaking = true; 
                voiceGuide.lastInstruction = truncatedText;
            };
            
            utterance.onend = () => { 
                voiceGuide.isSpeaking = false;
                voiceGuide.processNextInQueue();
            };
            
            utterance.onerror = (e) => { 
                console.error('Error TTS:', e); 
                voiceGuide.isSpeaking = false;
                voiceGuide.processNextInQueue();
            };

            if (priority || !voiceGuide.isSpeaking) {
                window.speechSynthesis.speak(utterance);
            } else {
                voiceGuide.addToQueue(utterance);
            }
        } else {
            console.warn("La API de Síntesis de Voz no es compatible.");
        }
    },
    
    // Sistema de cola para mensajes
    addToQueue: function(utterance) {
        this.speechQueue.push(utterance);
        if (!this.isProcessingQueue) {
            this.processNextInQueue();
        }
    },
    
    processNextInQueue: function() {
        if (this.speechQueue.length > 0 && !this.isSpeaking) {
            this.isProcessingQueue = true;
            const nextUtterance = this.speechQueue.shift();
            window.speechSynthesis.speak(nextUtterance);
        } else {
            this.isProcessingQueue = false;
        }
    },
    
    // Limpiar cola
    clearQueue: function() {
        this.speechQueue = [];
        this.isProcessingQueue = false;
    },
    
    // Función para detener la lectura
    cancel: () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            voiceGuide.isSpeaking = false;
            voiceGuide.clearQueue();
        }
    },
    
    // Función mejorada para instrucciones de navegación
    giveNavigationInstruction: function(instruction, distance = null) {
        let fullInstruction = instruction;
        if (instruction.type === 'relief_change') {
            return null; // No anunciar cambios de relieve
        }
        if (distance !== null && distance > 5) {
            fullInstruction += `. En aproximadamente ${Math.round(distance)} metros`;
        }
        this.speak(fullInstruction, true);
    },
    
    // Anunciar llegada a punto de interés
    announcePointOfInterest: function(pointType, pointName = '') {
        const messages = {
            'stairs': `Atención: escaleras ${pointName ? 'en ' + pointName : 'por delante'}. Tenga cuidado.`,
            'ramp': `Rampa disponible ${pointName ? 'en ' + pointName : ''}. Puede usarla si necesita.`,
            'ramp_start': `Inicio de rampa ${pointName ? 'en ' + pointName : ''}. Opción accesible disponible.`,
            'relief_change': `Cambio de relieve en el camino. Preste atención al suelo.`,
            'building_entrance': `Ha llegado a la entrada de ${pointName}.`
        };
        
        if (messages[pointType]) {
            this.speak(messages[pointType], true);
        }
    }
};

// --- 5. SISTEMA DE PUNTOS DE INTERÉS MEJORADO ---
const pointsSystem = {
    pointsData: null,
    activePoints: new Map(),
    announcedPoints: new Set(),
    pointsLayer: null,
    
    // Cargar puntos de interés
    loadPointsData: function() {
        fetch('map_points.geojson')
            .then(response => response.json())
            .then(data => {
                this.pointsData = data;
                this.displayPointsOnMap();
                console.log('Puntos de interés cargados:', data.features.length);
            })
            .catch(error => {
                console.error('Error cargando puntos de interés:', error);
            });
    },
    
    // Mostrar puntos en el mapa
    displayPointsOnMap: function() {
        if (!this.pointsData || !mapSystem.map) return;
        
        // Crear capa para puntos de interés
        this.pointsLayer = L.geoJSON(this.pointsData, {
            pointToLayer: function(feature, latlng) {
                const type = feature.properties.type;
                const icon = pointsSystem.getPointIcon(type);
                
                return L.marker(latlng, {
                    icon: icon,
                    zIndexOffset: 500
                });
            },
            onEachFeature: function(feature, layer) {
                const properties = feature.properties;
                const popupContent = `
                    <div class="p-2 max-w-xs">
                        <div class="flex items-center mb-2">
                            <div class="w-3 h-3 rounded-full ${pointsSystem.getPointColor(properties.type)} mr-2"></div>
                            <strong class="text-sm">${properties.name}</strong>
                        </div>
                        <p class="text-xs text-gray-600 mb-2">${properties.message}</p>
                        <div class="text-xs">
                            <span class="inline-block px-2 py-1 rounded ${pointsSystem.getPriorityBadge(properties.priority)}">
                                ${properties.priority === 'high' ? '⚠️ Alta prioridad' : 
                                  properties.priority === 'medium' ? '🔶 Media prioridad' : 'ℹ️ Informativo'}
                            </span>
                        </div>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(mapSystem.map);
    },
    
    // Obtener icono según tipo de punto
    getPointIcon: function(type) {
        const iconConfig = {
            'stairs': { color: '#ef4444', icon: '🔺' },
            'ramp': { color: '#10b981', icon: '🔄' },
            'ramp_start': { color: '#10b981', icon: '🔼' },
            'relief_change': { color: '#f59e0b', icon: '⚠️' }
        };
        
        const config = iconConfig[type] || { color: '#6b7280', icon: '📍' };
        
        return L.divIcon({
            className: `point-marker point-${type}`,
            html: `
                <div class="relative">
                    <div class="w-8 h-8 bg-white rounded-full border-2 border-${config.color.replace('#', '')} shadow-lg flex items-center justify-center text-sm">
                        ${config.icon}
                    </div>
                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-${config.color.replace('#', '')} rounded-full border-2 border-white"></div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    },
    
    // Obtener color según tipo
    getPointColor: function(type) {
        const colors = {
            'stairs': 'bg-red-500',
            'ramp': 'bg-green-500',
            'ramp_start': 'bg-green-500',
            'relief_change': 'bg-yellow-500'
        };
        return colors[type] || 'bg-gray-500';
    },
    
    // Obtener badge de prioridad
    getPriorityBadge: function(priority) {
        const badges = {
            'high': 'bg-red-100 text-red-800',
            'medium': 'bg-yellow-100 text-yellow-800',
            'info': 'bg-blue-100 text-blue-800'
        };
        return badges[priority] || 'bg-gray-100 text-gray-800';
    },
    
    // Verificar proximidad a puntos durante la navegación
    checkProximityToPoints: function(userLocation, route) {
        if (!this.pointsData) return;
        
        const proximityThreshold = 15; // metros
        
        this.pointsData.features.forEach((point, index) => {
            const pointId = `point-${index}`;
            
            // Si ya fue anunciado, no repetir
            if (this.announcedPoints.has(pointId)) return;
            
            const pointCoords = point.geometry.coordinates;
            const distance = routingSystem.calculateDistance(
                userLocation, 
                [pointCoords[1], pointCoords[0]]
            );
            
            if (distance <= proximityThreshold) {
                this.triggerPointAlert(point, distance);
                this.announcedPoints.add(pointId);
                
                // Resaltar punto en el mapa
                this.highlightPoint(point, index);
            }
        });
    },
    
    // Activar alerta de punto
    triggerPointAlert: function(point, distance) {
        const properties = point.properties;
        
        if (properties.audio_alert && appState.settings.isVoiceActive) {
            //voiceGuide.announcePointOfInterest(properties.type, properties.name);
        }
        
        // Mostrar notificación visual
        this.showPointNotification(properties);
        
        console.log(`🔔 Punto de interés: ${properties.name} (${Math.round(distance)}m)`);
    },
    
    // Mostrar notificación visual
    showPointNotification: function(properties) {
        // Crear notificación toast
        const notification = document.createElement('div');
        notification.className = `point-notification fixed top-4 right-4 p-4 rounded-lg shadow-lg border-l-4 z-[1000] max-w-sm animate-fade-in ${
            properties.priority === 'high' ? 'bg-red-50 border-red-500' :
            properties.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
            'bg-blue-50 border-blue-500'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <div class="w-6 h-6 rounded-full ${this.getPointColor(properties.type)} flex items-center justify-center text-white text-xs">
                        ${properties.priority === 'high' ? '⚠️' : 'ℹ️'}
                    </div>
                </div>
                <div class="ml-3">
                    <h4 class="text-sm font-medium ${
                        properties.priority === 'high' ? 'text-red-800' :
                        properties.priority === 'medium' ? 'text-yellow-800' :
                        'text-blue-800'
                    }">
                        ${properties.name}
                    </h4>
                    <p class="text-sm ${
                        properties.priority === 'high' ? 'text-red-600' :
                        properties.priority === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                    } mt-1">
                        ${properties.message}
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('animate-fade-out');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    },
    
    // Resaltar punto en el mapa
    highlightPoint: function(point, index) {
        if (!this.pointsLayer) return;
        
        const layers = this.pointsLayer.getLayers();
        if (layers[index]) {
            const layer = layers[index];
            
            // Animación de resaltado
            const marker = layer;
            marker.setZIndexOffset(1000);
            
            // Efecto de pulso
            const originalIcon = marker.options.icon;
            const highlightIcon = this.createHighlightIcon(point.properties.type);
            marker.setIcon(highlightIcon);
            
            setTimeout(() => {
                marker.setIcon(originalIcon);
                marker.setZIndexOffset(500);
            }, 3000);
            
            // Abrir popup automáticamente para puntos de alta prioridad
            if (point.properties.priority === 'high') {
                marker.openPopup();
            }
        }
    },
    
    // Crear icono resaltado
    createHighlightIcon: function(type) {
        const iconConfig = {
            'stairs': { color: '#dc2626', icon: '🔺' },
            'ramp': { color: '#059669', icon: '🔄' },
            'ramp_start': { color: '#059669', icon: '🔼' },
            'relief_change': { color: '#d97706', icon: '⚠️' }
        };
        
        const config = iconConfig[type] || { color: '#4b5563', icon: '📍' };
        
        return L.divIcon({
            className: `point-marker point-${type} highlighted`,
            html: `
                <div class="relative animate-pulse">
                    <div class="w-10 h-10 bg-white rounded-full border-4 border-${config.color.replace('#', '')} shadow-lg flex items-center justify-center text-lg">
                        ${config.icon}
                    </div>
                    <div class="absolute -top-1 -right-1 w-5 h-5 bg-${config.color.replace('#', '')} rounded-full border-2 border-white animate-ping"></div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    },
    
    // Reiniciar puntos anunciados (al iniciar nueva navegación)
    resetAnnouncedPoints: function() {
        this.announcedPoints.clear();
    },
    
    // Obtener puntos cercanos a una ruta
    getPointsNearRoute: function(routeCoordinates, maxDistance = 20) {
        if (!this.pointsData) return [];
        
        const nearbyPoints = [];
        
        this.pointsData.features.forEach(point => {
            const pointCoords = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
            
            // Verificar distancia a cualquier punto de la ruta
            let minDistance = Infinity;
            routeCoordinates.forEach(routePoint => {
                const distance = routingSystem.calculateDistance(routePoint, pointCoords);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            });
            
            if (minDistance <= maxDistance) {
                nearbyPoints.push({
                    point: point,
                    distance: minDistance
                });
            }
        });
        
        return nearbyPoints.sort((a, b) => a.distance - b.distance);
    }
};

// --- 6. SISTEMA DE GPS Y UBICACIÓN ---
const gpsService = {
    // Obtener ubicación actual una vez
    getCurrentLocation: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    resolve(location);
                },
                (error) => {
                    reject(this.handleGeolocationError(error));
                },
                options
            );
        });
    },

    // Iniciar seguimiento continuo de ubicación
    startTracking: function(onLocationUpdate) {
        if (!navigator.geolocation) {
            voiceGuide.speak("El GPS no está disponible en este dispositivo");
            return null;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                };
                
                onLocationUpdate(location);
            },
            (error) => {
                console.error('Error GPS:', error);
                voiceGuide.speak(this.handleGeolocationError(error).message);
            },
            options
        );

        return watchId;
    },

    // Detener seguimiento
    stopTracking: function(watchId) {
        if (watchId && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
        }
    },

    // Manejar errores de geolocalización
    handleGeolocationError: function(error) {
        let message = "Error de ubicación desconocido";
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = "Permiso de ubicación denegado. Por favor, activa el GPS en configuraciones.";
                break;
            case error.POSITION_UNAVAILABLE:
                message = "Información de ubicación no disponible.";
                break;
            case error.TIMEOUT:
                message = "Tiempo de espera agotado para obtener la ubicación.";
                break;
        }
        
        return new Error(message);
    },

    // Verificar si estamos dentro del campus (usando los bounds del GeoJSON)
    isInCampus: function(lat, lng, campusBounds) {
        if (!campusBounds) return true;
        
        return (
            lat >= campusBounds.getSouth() &&
            lat <= campusBounds.getNorth() &&
            lng >= campusBounds.getWest() && 
            lng <= campusBounds.getEast()
        );
    }
};

// --- 7. SISTEMA DE RUTAS MEJORADO CON DIJKSTRA ---
const routingSystem = {
    campusGraph: null,
    allRoutes: [],
    routePoints: {},
    buildingLocations: {},
    obstacleAreas: [],
    
    // Inicializar sistema de rutas
    init: function() {
        this.loadRouteNetwork();
        this.loadBuildingData();
    },
    
    // Cargar todas las rutas desde el GeoJSON
    loadRouteNetwork: function() {
        fetch('map_routes.geojson')
            .then(response => response.json())
            .then(data => {
                this.allRoutes = data.features;
                this.buildCompleteGraph();
                this.extractRoutePoints();
                console.log('Sistema de rutas cargado:', this.campusGraph);
                
                if(appState.settings.isVoiceActive) {
                    voiceGuide.speak("Sistema de navegación cargado con todas las rutas del campus");
                }
            })
            .catch(error => {
                console.error('Error cargando rutas:', error);
                voiceGuide.speak("Error al cargar las rutas de navegación");
            });
    },
    
    // Cargar datos de edificios
    loadBuildingData: function() {
        fetch('map.geojson')
            .then(response => response.json())
            .then(data => {
                data.features.forEach(building => {
                    const name = building.properties.name;
                    const center = this.getPolygonCenter(building.geometry.coordinates[0]);
                    this.buildingLocations[name] = center;
                });
                console.log('Edificios cargados:', this.buildingLocations);
            })
            .catch(error => {
                console.error('Error cargando edificios:', error);
            });
    },
    
    // Extraer puntos de interés de las rutas
    extractRoutePoints: function() {
        this.allRoutes.forEach(route => {
            const properties = route.properties;
            const routeName = Object.keys(properties)[0] || 'ruta_sin_nombre';
            this.routePoints[routeName] = [];
            
            Object.keys(properties).forEach(key => {
                if (properties[key] && properties[key].includes('escaleras')) {
                    this.routePoints[routeName].push({
                        type: 'stairs',
                        name: properties[key],
                        coordinates: route.geometry.coordinates[0]
                    });
                } else if (properties[key] && properties[key].includes('rampa')) {
                    this.routePoints[routeName].push({
                        type: 'ramp',
                        name: properties[key],
                        coordinates: route.geometry.coordinates[0]
                    });
                } else if (properties[key] && properties[key].includes('cambio de relieve')) {
                    this.routePoints[routeName].push({
                        type: 'relief_change',
                        name: properties[key],
                        coordinates: route.geometry.coordinates[0]
                    });
                }
            });
        });
    },
    
    // MEJORADO: Construir grafo evitando edificios
    buildCompleteGraph: function() {
        this.campusGraph = {
            nodes: [],
            edges: [],
            nodeMap: new Map(),
            obstacleNodes: new Set() // Nuevo: nodos cerca de obstáculos
        };
        
        let nodeId = 0;
        
        // Primero identificar áreas de edificios (obstáculos)
        this.identifyObstacleAreas();
        
        this.allRoutes.forEach(route => {
            const coordinates = route.geometry.coordinates;
            const routeName = Object.keys(route.properties)[0] || 'ruta_sin_nombre';
            const routeType = this.classifyRoute(route.properties);
            
            const routeNodes = [];
            coordinates.forEach((coord, index) => {
                const point = [coord[1], coord[0]];
                
                // Verificar si el punto está cerca de un obstáculo
                const isNearObstacle = this.isPointNearObstacle(point);
                
                const node = {
                    id: nodeId++,
                    lat: coord[1],
                    lng: coord[0],
                    coord: point,
                    route: routeName,
                    routeType: routeType,
                    isEndpoint: index === 0 || index === coordinates.length - 1,
                    isNearObstacle: isNearObstacle // Nuevo: marca nodos problemáticos
                };
                
                this.campusGraph.nodes.push(node);
                routeNodes.push(node);
                
                if (isNearObstacle) {
                    this.campusGraph.obstacleNodes.add(node.id);
                }
                
                const key = `${coord[1].toFixed(6)},${coord[0].toFixed(6)}`;
                if (!this.campusGraph.nodeMap.has(key)) {
                    this.campusGraph.nodeMap.set(key, []);
                }
                this.campusGraph.nodeMap.get(key).push(node);
            });
            
            // Crear conexiones entre nodos de la misma ruta
            for (let i = 1; i < routeNodes.length; i++) {
                const prevNode = routeNodes[i - 1];
                const currentNode = routeNodes[i];
                const distance = this.calculateDistance(prevNode.coord, currentNode.coord);
                
                // Penalizar segmentos cerca de obstáculos
                let cost = distance;
                if (prevNode.isNearObstacle || currentNode.isNearObstacle) {
                    cost *= 10; // Penalización AUMENTADA por estar cerca de obstáculos
                }
                
                this.campusGraph.edges.push({
                    from: prevNode.id,
                    to: currentNode.id,
                    distance: distance,
                    cost: cost, // Nuevo: costo ajustado
                    route: routeName,
                    routeType: routeType,
                    bidirectional: true
                });
                
                this.campusGraph.edges.push({
                    from: currentNode.id,
                    to: prevNode.id,
                    distance: distance,
                    cost: cost,
                    route: routeName,
                    routeType: routeType,
                    bidirectional: true
                });
            }
        });
        
        this.createIntersections();
    },
    
    // Identificar áreas de obstáculos (edificios)
    identifyObstacleAreas: function() {
        this.obstacleAreas = [];
        
        if (!appState.buildingData) {
            console.error("Datos de edificios no disponibles para identificar obstáculos.");
            return;
        }
        
        appState.buildingData.features.forEach(building => {
            if (building.properties.obstacle === true || 
                building.properties.routing === 'avoid') {
                
                const coordinates = building.geometry.coordinates[0];
                const obstacleArea = {
                    type: 'building',
                    name: building.properties.name,
                    polygon: coordinates.map(coord => [coord[1], coord[0]]),
                    bounds: this.calculatePolygonBounds(coordinates)
                };
                
                this.obstacleAreas.push(obstacleArea);
            }
        });

        console.log(`Áreas de obstáculos identificadas: ${this.obstacleAreas.length}`);
        if (this.obstacleAreas.length === 0) {
            console.warn("No se identificaron áreas de obstáculos. La evasión de edificios puede no funcionar.");
        }
    },
    
    // Calcular límites de polígono
    calculatePolygonBounds: function(coordinates) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        
        coordinates.forEach(coord => {
            const lat = coord[1];
            const lng = coord[0];
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
        });
        
        return { minLat, maxLat, minLng, maxLng };
    },
    
    // Verificar si un punto está cerca de un obstáculo
    isPointNearObstacle: function(point, threshold = 15) {
        for (const obstacle of this.obstacleAreas) {
            if (this.isPointInPolygon(point, obstacle.polygon)) {
                return true;
            }
            
            // Verificar proximidad al borde del polígono
            if (this.distanceToPolygon(point, obstacle.polygon) < threshold) {
                return true;
            }
        }
        return false;
    },
    
    // Verificar si punto está dentro de polígono
    isPointInPolygon: function(point, polygon) {
        const x = point[0], y = point[1];
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];
            
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    },
    
    // Calcular distancia a un polígono
    distanceToPolygon: function(point, polygon) {
        let minDistance = Infinity;
        
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const distance = this.pointToLineDistance(point, p1, p2);
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    },
    
    // Calcular distancia de punto a línea
    pointToLineDistance: function(point, lineStart, lineEnd) {
        const A = point[0] - lineStart[0];
        const B = point[1] - lineStart[1];
        const C = lineEnd[0] - lineStart[0];
        const D = lineEnd[1] - lineStart[1];

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = lineStart[0];
            yy = lineStart[1];
        } else if (param > 1) {
            xx = lineEnd[0];
            yy = lineEnd[1];
        } else {
            xx = lineStart[0] + param * C;
            yy = lineStart[1] + param * D;
        }

        const dx = point[0] - xx;
        const dy = point[1] - yy;
        
        return Math.sqrt(dx * dx + dy * dy) * 111320; // Convertir a metros
    },
    
    // Clasificar rutas por tipo
    classifyRoute: function(properties) {
        const propStr = JSON.stringify(properties).toLowerCase();
        if (propStr.includes('escaleras')) return 'stairs';
        if (propStr.includes('rampa')) return 'ramp';
        if (propStr.includes('cambio de relieve')) return 'relief_change';
        return 'normal';
    },
    
    // Crear conexiones entre rutas que se cruzan
    createIntersections: function() {
        const connectionDistance = 10;
        const connectedPairs = new Set();
        
        this.campusGraph.nodes.forEach((node1, index1) => {
            this.campusGraph.nodes.forEach((node2, index2) => {
                if (index1 >= index2) return;
                
                const distance = this.calculateDistance(node1.coord, node2.coord);
                const pairKey = `${Math.min(node1.id, node2.id)}-${Math.max(node1.id, node2.id)}`;
                
                if (distance <= connectionDistance && !connectedPairs.has(pairKey) && 
                    node1.route !== node2.route) {
                    
                    this.campusGraph.edges.push({
                        from: node1.id,
                        to: node2.id,
                        distance: distance,
                        cost: distance,
                        route: 'connection',
                        routeType: 'connection',
                        bidirectional: true
                    });
                    
                    this.campusGraph.edges.push({
                        from: node2.id,
                        to: node1.id,
                        distance: distance,
                        cost: distance,
                        route: 'connection',
                        routeType: 'connection',
                        bidirectional: true
                    });
                    
                    connectedPairs.add(pairKey);
                }
            });
        });
    },
    
    // ALGORITMO DE DIJKSTRA MEJORADO con evitación de obstáculos
    findPathInGraph: function(startId, endId) {
        if (startId === endId) return { path: [startId], totalDistance: 0 };
        
        const distances = {};
        const costs = {}; // Nuevo: costos considerando obstáculos
        const previous = {};
        const unvisited = new Set();
        const visited = new Set();
        
        this.campusGraph.nodes.forEach(node => {
            distances[node.id] = node.id === startId ? 0 : Infinity;
            costs[node.id] = node.id === startId ? 0 : Infinity; // Inicializar costos
            previous[node.id] = null;
            unvisited.add(node.id);
        });
        
        while (unvisited.size > 0) {
            let currentId = null;
            let minCost = Infinity;
            
            // Buscar nodo con menor costo (no solo distancia)
            unvisited.forEach(nodeId => {
                if (costs[nodeId] < minCost) {
                    minCost = costs[nodeId];
                    currentId = nodeId;
                }
            });
            
            if (currentId === null || minCost === Infinity) break;
            
            if (currentId === endId) {
                const path = this.reconstructPath(previous, startId, endId);
                return {
                    path: path,
                    totalDistance: distances[endId],
                    totalCost: costs[endId],
                    nodes: path.map(id => this.campusGraph.nodes[id])
                };
            }
            
            unvisited.delete(currentId);
            visited.add(currentId);
            
            const connections = this.campusGraph.edges.filter(edge => 
                edge.from === currentId && !visited.has(edge.to)
            );
            
            connections.forEach(edge => {
                let edgeCost = edge.cost; // Usar costo en lugar de distancia
                
                // Aplicar preferencias de accesibilidad
                if (appState.settings.avoidStairs && edge.routeType === 'stairs') {
                    edgeCost *= 5; // Alta penalización por escaleras
                }
                
                if (appState.settings.prioritizeElevators && edge.routeType === 'ramp') {
                    edgeCost *= 0.3; // Gran beneficio por rampas
                }
                
                // Penalizar nodos cerca de obstáculos
                if (this.campusGraph.obstacleNodes.has(edge.to)) {
                    edgeCost *= 10; // Penalización AUMENTADA
                }
                
                const alternativeCost = costs[currentId] + edgeCost;
                const alternativeDistance = distances[currentId] + edge.distance;
                
                if (alternativeCost < costs[edge.to]) {
                    costs[edge.to] = alternativeCost;
                    distances[edge.to] = alternativeDistance;
                    previous[edge.to] = currentId;
                }
            });
        }
        
        return null;
    },
    
    // Reconstruir camino
    reconstructPath: function(previous, startId, endId) {
        const path = [];
        let currentId = endId;
        
        while (currentId !== null) {
            path.unshift(currentId);
            currentId = previous[currentId];
        }
        
        return path[0] === startId ? path : null;
    },
    
    // Encontrar nodos cercanos a una ubicación
    findNearestNodes: function(location, maxDistance = 50) {
        const nearestNodes = [];
        
        this.campusGraph.nodes.forEach(node => {
            const distance = this.calculateDistance(location, node.coord);
            if (distance <= maxDistance) {
                nearestNodes.push({
                    node: node,
                    distance: distance
                });
            }
        });
        
        nearestNodes.sort((a, b) => a.distance - b.distance);
        return nearestNodes;
    },
    
    // Calcular ruta completa con instrucciones
    calculateRouteToDestination: function(startLocation, destinationLocation, destinationName = '') {
         voiceGuide.clearQueue();
        if (!this.campusGraph) {
            return this.calculateDirectRoute(startLocation, destinationLocation);
        }
        
        const startNodes = this.findNearestNodes(startLocation, 30);
        const endNodes = this.findNearestNodes(destinationLocation, 30);
        
        if (startNodes.length === 0 || endNodes.length === 0) {
            return this.calculateDirectRoute(startLocation, destinationLocation);
        }
        
        let bestRoute = null;
        let minDistance = Infinity;
        
        for (let i = 0; i < Math.min(3, startNodes.length); i++) {
            for (let j = 0; j < Math.min(3, endNodes.length); j++) {
                const startNode = startNodes[i].node;
                const endNode = endNodes[j].node;
                
                console.log(`Buscando ruta de ${startNode.id} a ${endNode.id}`);
                const routeResult = this.findPathInGraph(startNode.id, endNode.id);
                
                if (routeResult && routeResult.totalDistance < minDistance) {
                    minDistance = routeResult.totalDistance;
                    bestRoute = routeResult;
                }
            }
        }
        
        if (bestRoute) {
            return this.buildCompleteRoute(bestRoute, startLocation, destinationLocation, destinationName);
        } else {
            console.warn("No se encontró ruta con Dijkstra, usando ruta directa");
            return this.calculateDirectRoute(startLocation, destinationLocation);
        }
    },
    
    // Construir ruta completa con información de navegación
    buildCompleteRoute: function(routeResult, startLocation, destinationLocation, destinationName) {
        const routeNodes = routeResult.nodes;
        const routeCoordinates = [startLocation];
        const instructions = [];
        let totalDistance = 0;
        
        // Obtener puntos cercanos a la ruta completa
        const allRouteCoords = [startLocation];
        routeNodes.forEach(node => {
            allRouteCoords.push([node.lat, node.lng]);
        });
        allRouteCoords.push(destinationLocation);
        
        const nearbyPoints = pointsSystem.getPointsNearRoute(allRouteCoords, 15);
        
        for (let i = 0; i < routeNodes.length - 1; i++) {
            const currentNode = routeNodes[i];
            const nextNode = routeNodes[i + 1];
            const segmentDistance = this.calculateDistance(currentNode.coord, nextNode.coord);
            totalDistance += segmentDistance;
            
            if (i === 0) {
                instructions.push({
                    type: 'start',
                    text: `Comience dirigiéndose hacia la ruta ${currentNode.route}`,
                    distance: segmentDistance,
                    node: currentNode
                });
            }
            
            // Verificar si hay puntos de interés en este segmento
            const segmentPoints = nearbyPoints.filter(point => {
                const pointDistance = this.calculateDistance(currentNode.coord, [point.point.geometry.coordinates[1], point.point.geometry.coordinates[0]]);
                return pointDistance <= segmentDistance + 10;
            });
            
            // Agregar instrucciones para puntos de interés
            segmentPoints.forEach(pointInfo => {
                instructions.push({
                    type: pointInfo.point.properties.type,
                    text: pointInfo.point.properties.message,
                    distance: pointInfo.distance,
                    node: currentNode,
                    point: pointInfo.point
                });
            });
            
            if (currentNode.route !== nextNode.route) {
                instructions.push({
                    type: 'route_change',
                    text: `Cambie a la ruta ${nextNode.route}`,
                    distance: segmentDistance,
                    node: nextNode
                });
            }
            
            routeCoordinates.push([currentNode.lat, currentNode.lng]);
        }
        
        const lastNode = routeNodes[routeNodes.length - 1];
        routeCoordinates.push([lastNode.lat, lastNode.lng]);
        routeCoordinates.push(destinationLocation);
        
        instructions.push({
            type: 'arrival',
            text: `Ha llegado a su destino: ${destinationName}`,
            distance: 0,
            node: lastNode
        });
        
        return {
            coordinates: routeCoordinates,
            distance: totalDistance,
            type: 'dijkstra_optimized',
            usesMainPaths: true,
            pathLength: routeNodes.length,
            instructions: instructions,
            nodes: routeNodes,
            nearbyPoints: nearbyPoints
        };
    },
    
    // Ruta directa (fallback)
    calculateDirectRoute: function(start, end) {
        const distance = this.calculateDistance(start, end);
        return {
            coordinates: [start, end],
            distance: distance,
            type: 'direct',
            usesMainPaths: false,
            pathLength: 1,
            instructions: [{
                type: 'direct',
                text: `Diríjase directamente hacia su destino. Distancia: ${Math.round(distance)} metros.`,
                distance: distance
            }]
        };
    },
    
    // Calcular distancia entre dos puntos (Haversine)
    calculateDistance: function(point1, point2) {
        const R = 6371000;
        const dLat = (point2[0] - point1[0]) * Math.PI / 180;
        const dLon = (point2[1] - point1[1]) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },
    
    // Obtener centro de polígono
    getPolygonCenter: function(coordinates) {
        let sumLat = 0, sumLng = 0;
        coordinates.forEach(coord => {
            sumLng += coord[0];
            sumLat += coord[1];
        });
        return [sumLat / coordinates.length, sumLng / coordinates.length];
    }
};

// --- 8. SISTEMA DE NAVEGACIÓN EN TIEMPO REAL ---
const navigationSystem = {
    currentRoute: null,
    currentInstructionIndex: -1,
    isNavigating: false,
    lastUserLocation: null,
    lastInstruction: null,
    
    // Iniciar navegación
    startNavigation: function(route, destinationName) {
        if (!appState.currentLocation) {
            voiceGuide.speak("No se ha establecido su ubicación actual. Active el GPS o use el modo manual para establecer su posición.");
            return;
        }
        
        this.currentRoute = route;
        this.currentInstructionIndex = -1;
        this.isNavigating = true;
        appState.navigationActive = true;
        
        // Reiniciar puntos anunciados para nueva navegación
        pointsSystem.resetAnnouncedPoints();
        
        console.log('Iniciando navegación con instrucciones:', route.instructions);
        
        const locationSource = manualLocationSystem.isActive ? "ubicación manual" : "GPS";
        

        voiceGuide.speak(
            `Navegación iniciada desde ${locationSource}. ` +
            `Distancia total: ${Math.round(route.distance)} metros.`
        );
     
        
        setTimeout(() => {
            this.giveNextInstruction();
        }, 3000);
    },
    
    // Detener navegación
    stopNavigation: function() {
        this.isNavigating = false;
        appState.navigationActive = false;
        this.currentRoute = null;
        this.currentInstructionIndex = -1;
        voiceGuide.speak("Navegación finalizada.");
    },
    
    // Proporcionar siguiente instrucción
    giveNextInstruction: function() {
        if (!this.isNavigating || !this.currentRoute) return;
        
        this.currentInstructionIndex++;
        
        if (this.currentInstructionIndex < this.currentRoute.instructions.length) {
            const instruction = this.currentRoute.instructions[this.currentInstructionIndex];
            this.lastInstruction = instruction.text;
            console.log(instruction)
            voiceGuide.giveNavigationInstruction(instruction.text, instruction.distance);
            //TODO: las instrucciones n deberian funcinar asi, hay que revisarlo( manejarlo en funcion de distancia recorrida)
            if (instruction.distance > 0) {
                const timeToNext = (instruction.distance / 1.4) * 1000;
                setTimeout(() => {
                    this.giveNextInstruction();
                }, Math.min(timeToNext, 30000));
            }
        } else {
            this.stopNavigation();
        }
    },
    
    // Repetir última instrucción
    repeatLastInstruction: function() {
        if (this.lastInstruction && this.isNavigating) {
            voiceGuide.speak(this.lastInstruction, true);
        } else {
            voiceGuide.speak("No hay instrucciones recientes para repetir");
        }
    },
    
    // Actualizar posición del usuario durante navegación
    updateUserPosition: function(userLocation) {
        if (!this.isNavigating || !this.currentRoute) return;
        
        this.lastUserLocation = userLocation;
        
        // Verificar proximidad a puntos de interés
        pointsSystem.checkProximityToPoints(userLocation, this.currentRoute);
        
        this.checkRouteDeviation(userLocation);
    },
    
    // Verificar desviación de la ruta
    checkRouteDeviation: function(userLocation) {
        if (!this.currentRoute.nodes) return;
        
        let minDistance = Infinity;
        let nearestNode = null;
        
        this.currentRoute.nodes.forEach(node => {
            const distance = routingSystem.calculateDistance(userLocation, node.coord);
            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = node;
            }
        });
        
        if (minDistance > 20) {
            voiceGuide.speak("Parece que se ha desviado de la ruta. Recalculando...", true);
            this.recalculateRoute(userLocation);
        }
    },
    
    // Recalcular ruta desde posición actual
    recalculateRoute: function(userLocation) {
        if (!appState.selectedDestination || !this.currentRoute) return;
        
        const destinationName = appState.selectedDestination;
        const destinationLocation = routingSystem.buildingLocations[destinationName];
        
        if (destinationLocation) {
            const newRoute = routingSystem.calculateRouteToDestination(
                userLocation, 
                destinationLocation, 
                destinationName
            );
            
            if (newRoute) {
                this.startNavigation(newRoute, destinationName);
            }
        }
    }
};

// --- 9. SISTEMA DE RECONOCIMIENTO DE VOZ MEJORADO ---
const voiceRecognition = {
    recognition: null,
    isListening: false,
    finalTranscript: '',
    
    // Inicializar reconocimiento de voz
    init: function() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('El reconocimiento de voz no es compatible con este navegador');
            voiceGuide.speak("Lo siento, el reconocimiento de voz no está disponible en su navegador. Por favor, use Chrome o Edge.");
            return false;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'es-ES';
        this.recognition.maxAlternatives = 1;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            appState.isListening = true;
            this.updateVoiceButton(true);
            voiceGuide.speak("Escuchando...", true);
        };
        
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    this.finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            if (interimTranscript) {
                console.log('Texto intermedio:', interimTranscript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Error en reconocimiento de voz:', event.error);
            this.handleRecognitionError(event.error);
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            appState.isListening = false;
            this.updateVoiceButton(false);
            
            if (this.finalTranscript) {
                this.processCommand(this.finalTranscript);
            }
            
            this.finalTranscript = '';
        };
        
        return true;
    },
    
    // Iniciar escucha
    startListening: function() {
        if (!this.recognition || !appState.settings.voiceCommands) {
            voiceGuide.speak("Los comandos de voz no están activados. Active la opción en configuraciones.");
            return;
        }
        
        try {
            this.finalTranscript = '';
            this.recognition.start();
        } catch (error) {
            console.error('Error al iniciar reconocimiento:', error);
            voiceGuide.speak("Error al iniciar el reconocimiento de voz. Intente nuevamente.");
        }
    },
    
    // Detener escucha
    stopListening: function() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    },
    
    // Procesar comando de voz MEJORADO
    processCommand: function(transcript) {
        const command = transcript.toLowerCase().trim();
        console.log('Comando recibido:', command);
        
        voiceGuide.speak(`Entendí: ${command}`);
        
        // Verificar comandos de modo manual primero
        if (manualLocationSystem.handleVoiceCommand(command)) {
            return;
        }
        
        // Verificar comandos de navegación
        if (this.isNavigationCommand(command)) {
            this.processNavigationCommand(command);
            return;
        }
        
        // Verificar otros comandos
        if (this.isControlCommand(command, 'detener')) {
            voiceGuide.speak("Deteniendo navegación");
            mapSystem.stopNavigation();
        }
        else if (this.isControlCommand(command, 'gps activar')) {
            voiceGuide.speak("Activando GPS");
            if (!appState.isTracking) {
                mapSystem.startGPSTracking();
            }
        }
        else if (this.isControlCommand(command, 'gps desactivar')) {
            voiceGuide.speak("Desactivando GPS");
            if (appState.isTracking) {
                mapSystem.stopGPSTracking();
            }
        }
        else if (this.isControlCommand(command, 'ubicación')) {
            this.speakCurrentLocation();
        }
        else if (this.isControlCommand(command, 'repetir')) {
            voiceGuide.speak("Repitiendo última instrucción");
            navigationSystem.repeatLastInstruction();
        }
        else if (this.isControlCommand(command, 'siguiente')) {
            voiceGuide.speak("Avanzando a siguiente instrucción");
            navigationSystem.giveNextInstruction();
        }
        else if (this.isControlCommand(command, 'puntos')) {
            this.showNearbyPoints();
        }
        else if (this.isControlCommand(command, 'ayuda')) {
            this.showVoiceHelp();
        }
        else {
            voiceGuide.speak("No entendí el comando. Diga 'ayuda' para conocer los comandos disponibles.");
        }
    },
    
    // Verificar si es comando de navegación
    isNavigationCommand: function(command) {
        return voiceCommandsDictionary.navigate.some(navCommand => 
            command.includes(navCommand)
        );
    },
    
    // Verificar si es comando de control
    isControlCommand: function(command, controlType) {
        return voiceCommandsDictionary.control[controlType].some(controlCommand => 
            command.includes(controlCommand)
        );
    },
    
    // Procesar comandos de navegación MEJORADO
    processNavigationCommand: function(command) {
        // Extraer el destino del comando
        let destinationName = this.extractDestinationFromCommand(command);
        
        if (destinationName) {
            voiceGuide.speak(`Navegando hacia ${destinationName}`);
            startNavigation(destinationName);
        } else {
            voiceGuide.speak("Por favor, especifique a dónde desea navegar. Por ejemplo: 'Navegar a la biblioteca' o 'Vamos al bloque 5'");
        }
    },
    
    // Extraer destino del comando MEJORADO
    extractDestinationFromCommand: function(command) {
        // Remover palabras de navegación para aislar el destino
        let cleanCommand = command;
        voiceCommandsDictionary.navigate.forEach(navWord => {
            cleanCommand = cleanCommand.replace(navWord, '').trim();
        });
        
        // Buscar en destinos específicos
        for (const [key, aliases] of Object.entries(voiceCommandsDictionary.destinations)) {
            if (aliases.some(alias => cleanCommand.includes(alias))) {
                const destination = destinationsSystem.findDestination(key);
                return destination ? destination.name : null;
            }
        }
        
        // Buscar en bloques
        for (const [block, aliases] of Object.entries(voiceCommandsDictionary.blocks)) {
            if (aliases.some(alias => cleanCommand.includes(alias))) {
                return block;
            }
        }
        
        // Búsqueda general en todos los destinos
        const allDestinations = destinationsSystem.getAllDestinations();
        for (const dest of allDestinations) {
            if (cleanCommand.includes(dest.name.toLowerCase()) || 
                cleanCommand.includes(dest.displayName.toLowerCase())) {
                return dest.name;
            }
        }
        
        // Si no se encuentra, intentar con el comando completo
        const destination = destinationsSystem.findDestination(cleanCommand);
        return destination ? destination.name : null;
    },
    
    // Mostrar puntos cercanos
    showNearbyPoints: function() {
        if (!appState.currentLocation) {
            voiceGuide.speak("No se ha detectado su ubicación actual.");
            return;
        }
        
        if (!pointsSystem.pointsData) {
            voiceGuide.speak("Los puntos de interés no están cargados aún.");
            return;
        }
        
        const nearbyPoints = pointsSystem.getPointsNearRoute([appState.currentLocation], 30);
        
        if (nearbyPoints.length === 0) {
            voiceGuide.speak("No hay puntos de interés cercanos a su ubicación actual.");
        } else {
            const pointsInfo = nearbyPoints.slice(0, 3).map(point => 
                `${point.point.properties.name} a ${Math.round(point.distance)} metros`
            ).join(', ');
            
            voiceGuide.speak(`Puntos cercanos: ${pointsInfo}`);
        }
    },
    
    // Manejar errores de reconocimiento
    handleRecognitionError: function(error) {
        let errorMessage = "Error en el reconocimiento de voz";
        
        switch(error) {
            case 'no-speech':
                errorMessage = "No se detectó voz. Intente nuevamente.";
                break;
            case 'audio-capture':
                errorMessage = "No se pudo acceder al micrófono. Verifique los permisos.";
                break;
            case 'not-allowed':
                errorMessage = "Permiso de micrófono denegado. Active los permisos en su navegador.";
                break;
            case 'network':
                errorMessage = "Error de red en el reconocimiento de voz.";
                break;
            default:
                errorMessage = `Error de reconocimiento: ${error}`;
        }
        
        voiceGuide.speak(errorMessage);
    },
    
    // Hablar ubicación actual
    speakCurrentLocation: function() {
        if (!appState.currentLocation) {
            voiceGuide.speak("No se ha detectado su ubicación actual. Active el GPS o use el modo manual.");
            return;
        }
        
        if (appState.navigationActive && appState.selectedDestination) {
            const distance = routingSystem.calculateDistance(
                appState.currentLocation, 
                routingSystem.buildingLocations[appState.selectedDestination]
            );
            voiceGuide.speak(`Se encuentra a ${Math.round(distance)} metros de ${appState.selectedDestination}`);
        } else {
            voiceGuide.speak("Ubicación actual detectada. Diga a dónde desea navegar.");
        }
    },
    
    // Mostrar ayuda de comandos
    showVoiceHelp: function() {
        const helpText = `
            Comandos disponibles:
            - Navegar a [destino]: Para ir a cualquier lugar del campus
            - Biblioteca, Cafetería, Parking, Entrada: Destinos rápidos
            - Modo manual: Activar ubicación manual
            - Detener: Cancelar navegación actual
            - Activar GPS o Desactivar GPS: Controlar el GPS
            - Dónde estoy: Conocer ubicación actual
            - Repetir instrucción: Escuchar la última instrucción
            - Siguiente instrucción: Avanzar a la próxima instrucción
            - Puntos cercanos: Conocer puntos de interés cercanos
            - Ayuda: Escuchar esta lista de comandos

            Ejemplos de comandos naturales:
            - "Vamos a la biblioteca"
            - "Llévame al bloque 5" 
            - "Necesito ir a enfermería"
            - "Cómo llego a la cafetería"
            - "Quiero ir al coliseo"
        `;
        
        voiceGuide.speak(helpText);
    },
    
    // Actualizar botón de voz en la interfaz
    updateVoiceButton: function(isListening) {
        let voiceButton = document.getElementById('voice-command-button');
        if (!voiceButton) {
            this.createVoiceButton();
            voiceButton = document.getElementById('voice-command-button');
        }
        
        if (isListening) {
            voiceButton.className = 'ml-2 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors animate-pulse';
            voiceButton.innerHTML = '<i data-lucide="mic" class="w-4 h-4"></i>';
            voiceButton.title = 'Escuchando... Click para detener';
        } else {
            voiceButton.className = 'ml-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors';
            voiceButton.innerHTML = '<i data-lucide="mic" class="w-4 h-4"></i>';
            voiceButton.title = 'Comando de voz - Click para hablar';
        }
        
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    },
    
    // Crear botón de comando de voz
    createVoiceButton: function() {
        const mapTitle = document.getElementById('map-title');
        if (!mapTitle) return;
        
        const voiceButton = document.createElement('button');
        voiceButton.id = 'voice-command-button';
        voiceButton.className = 'ml-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors';
        voiceButton.innerHTML = '<i data-lucide="mic" class="w-4 h-4"></i>';
        voiceButton.title = 'Comando de voz - Click para hablar';
        voiceButton.setAttribute('aria-label', 'Activar comando de voz');
        
        const gpsButton = document.getElementById('gps-toggle-button');
        if (gpsButton && gpsButton.parentNode) {
            gpsButton.parentNode.insertBefore(voiceButton, gpsButton.nextSibling);
        } else {
            mapTitle.parentElement.appendChild(voiceButton);
        }
        
        voiceButton.addEventListener('click', () => {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        });
        
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    },
    
    // Activar/desactivar comandos de voz
    toggleVoiceCommands: function(enable) {
        appState.settings.voiceCommands = enable;
        if (enable && !this.recognition) {
            this.init();
        }
    }
};

// --- 10. SISTEMA DE UBICACIÓN MANUAL ---
const manualLocationSystem = {
    isActive: true,
    manualMarker: null,
    manualInstruction: null,
    
    // Activar/desactivar modo manual
    toggleManualMode: function() {
        this.isActive = !this.isActive;
        appState.manualMode = this.isActive;
        
        if (this.isActive) {
            this.activateManualMode();
        } else {
            this.deactivateManualMode();
        }
        
        this.updateManualButton();
        return this.isActive;
    },
    
    // Activar modo manual
    activateManualMode: function() {
        voiceGuide.speak("Modo manual activado. Haga click en el mapa para establecer su ubicación actual.");
        
        mapSystem.map.getContainer().style.cursor = 'crosshair';
        
        if (!this.manualInstruction) {
            this.manualInstruction = L.control({position: 'topright'});
            this.manualInstruction.onAdd = function() {
                const div = L.DomUtil.create('div', 'manual-instruction');
                div.innerHTML = `
                    <div class="bg-blue-600 text-white p-3 rounded-lg shadow-lg">
                        <strong>📍 Modo Manual Activo</strong><br>
                        Haga click en el mapa para establecer su ubicación
                    </div>
                `;
                return div;
            };
            this.manualInstruction.addTo(mapSystem.map);
        }
        
        if (this.manualMarker) {
            mapSystem.map.removeLayer(this.manualMarker);
        }
    },
    
    // Desactivar modo manual
    deactivateManualMode: function() {
        voiceGuide.speak("Modo manual desactivado.");
        
        mapSystem.map.getContainer().style.cursor = '';
        
        if (this.manualInstruction) {
            mapSystem.map.removeControl(this.manualInstruction);
            this.manualInstruction = null;
        }
        
        if (this.manualMarker) {
            mapSystem.map.removeLayer(this.manualMarker);
            this.manualMarker = null;
        }
    },
    
    // Establecer ubicación manual
    setManualLocation: function(latLng) {
        if (!this.isActive) return;
        
        const manualLocation = {
            lat: latLng.lat,
            lng: latLng.lng,
            accuracy: 5,
            timestamp: Date.now(),
            source: 'manual'
        };
        
        appState.currentLocation = [manualLocation.lat, manualLocation.lng];
        
        if (this.manualMarker) {
            this.manualMarker.setLatLng(latLng);
        } else {
            this.manualMarker = L.marker(latLng, {
                icon: L.divIcon({
                    className: 'manual-location-marker',
                    html: `
                        <div class="relative">
                            <div class="w-8 h-8 bg-purple-600 border-3 border-white rounded-full shadow-lg animate-pulse"></div>
                            <div class="absolute -top-2 -right-2 bg-purple-800 text-white text-xs px-1 rounded">M</div>
                        </div>
                    `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                }),
                zIndexOffset: 1000
            }).addTo(mapSystem.map)
            .bindPopup(`
                <div class="p-2">
                    <b>📍 Ubicación Manual</b><br>
                    <small>Establecida por el usuario</small><br>
                    <button onclick="manualLocationSystem.clearManualLocation()" 
                            class="mt-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
                        Eliminar
                    </button>
                </div>
            `)
            .openPopup();
        }
        
        mapSystem.updateUserLocation(manualLocation);
        
        voiceGuide.speak(`Ubicación manual establecida. Ahora está en el mapa.`);
        
        if (appState.selectedDestination && mapSystem.markers.end) {
            const destination = mapSystem.markers.end.getLatLng();
            mapSystem.calculateRoute([manualLocation.lat, manualLocation.lng], destination);
        }
    },
    
    // Limpiar ubicación manual
    clearManualLocation: function() {
        if (this.manualMarker) {
            mapSystem.map.removeLayer(this.manualMarker);
            this.manualMarker = null;
        }
        
        appState.currentLocation = null;
        
        if (mapSystem.markers.start) {
            mapSystem.map.removeLayer(mapSystem.markers.start);
            mapSystem.markers.start = null;
        }
        
        if (mapSystem.markers.accuracy) {
            mapSystem.map.removeLayer(mapSystem.markers.accuracy);
            mapSystem.markers.accuracy = null;
        }
        
        voiceGuide.speak("Ubicación manual eliminada.");
    },
    
    // Crear botón de modo manual
    createManualButton: function() {
        const mapTitle = document.getElementById('map-title');
        if (!mapTitle) return;
        
        const manualButton = document.createElement('button');
        manualButton.id = 'manual-location-button';
        manualButton.className = 'ml-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors';
        manualButton.innerHTML = '<i data-lucide="map-pin" class="w-4 h-4"></i>';
        manualButton.title = 'Ubicación manual - Click para activar';
        manualButton.setAttribute('aria-label', 'Activar ubicación manual');
        
        const voiceButton = document.getElementById('voice-command-button');
        if (voiceButton && voiceButton.parentNode) {
            voiceButton.parentNode.insertBefore(manualButton, voiceButton.nextSibling);
        } else {
            const gpsButton = document.getElementById('gps-toggle-button');
            if (gpsButton && gpsButton.parentNode) {
                gpsButton.parentNode.insertBefore(manualButton, gpsButton.nextSibling);
            } else {
                mapTitle.parentElement.appendChild(manualButton);
            }
        }
        
        manualButton.addEventListener('click', () => {
            this.toggleManualMode();
        });
        
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
        
        return manualButton;
    },
    
    // Actualizar apariencia del botón manual
    updateManualButton: function() {
        const manualButton = document.getElementById('manual-location-button');
        if (!manualButton) return;
        
        if (this.isActive) {
            manualButton.className = 'ml-2 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors animate-pulse';
            manualButton.innerHTML = '<i data-lucide="map-pin" class="w-4 h-4"></i>';
            manualButton.title = 'Modo manual activo - Click para desactivar';
        } else {
            manualButton.className = 'ml-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors';
            manualButton.innerHTML = '<i data-lucide="map-pin" class="w-4 h-4"></i>';
            manualButton.title = 'Ubicación manual - Click para activar';
        }
        
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    },
    
    // Comando de voz para modo manual
    handleVoiceCommand: function(command) {
        const lowerCommand = command.toLowerCase();
        
        if (voiceCommandsDictionary.manual['manual activar'].some(cmd => lowerCommand.includes(cmd))) {
            this.toggleManualMode();
            return true;
        }
        else if (voiceCommandsDictionary.manual['manual desactivar'].some(cmd => lowerCommand.includes(cmd))) {
            if (this.isActive) {
                this.toggleManualMode();
            }
            return true;
        }
        else if (voiceCommandsDictionary.control['detener'].some(cmd => lowerCommand.includes(cmd)) && lowerCommand.includes('ubicación')) {
            this.clearManualLocation();
            return true;
        }
        
        return false;
    }
};

// --- 11. SISTEMA DE MAPAS ACTUALIZADO ---
const mapSystem = {
    map: null,
    campusData: null,
    routesData: null,
    campusBounds: null,
    markers: {
        start: null,
        end: null,
        accuracy: null
    },
    routeLayer: null,
    mainRouteLayer: null,
    userLocationLayer: null,
    pointsLayer: null,

    // Inicializar el mapa
    initMap: function() {
        this.map = L.map('campus-map').setView([10.9948, -74.7909], 17);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 20
        }).addTo(this.map);

        this.loadCampusGeoJSON();
        
        // Inicializar sistema de puntos
        pointsSystem.loadPointsData();
        
        if (appState.settings.useGPS) {
            this.initGPS();
        }
        
        routingSystem.init();
        manualLocationSystem.createManualButton();
        this.setupManualClick();
    },

    // Configurar evento de click para modo manual
    setupManualClick: function() {
        this.map.on('click', function(e) {
            if (manualLocationSystem.isActive) {
                manualLocationSystem.setManualLocation(e.latlng);
            }
            else if (!appState.isTracking) {
                const useManual = confirm('¿Desea establecer esta ubicación como su posición actual?');
                if (useManual) {
                    manualLocationSystem.setManualLocation(e.latlng);
                }
            }
        });
    },

    // Cargar y mostrar el GeoJSON del campus
    loadCampusGeoJSON: function() {
        fetch('map.geojson')
            .then(response => response.json())
            .then(data => {
                this.campusData = data;
                this.displayCampusMap(data);
                this.campusBounds = this.getCampusBounds(data);
                
                this.loadAndDisplayRoutes();
                
                if(appState.settings.isVoiceActive) {
                    voiceGuide.speak("Mapa del campus cargado correctamente");
                }
            })
            .catch(error => {
                console.error('Error cargando GeoJSON:', error);
                voiceGuide.speak("Error al cargar el mapa del campus");
            });
    },

    // Cargar y mostrar las rutas principales
    loadAndDisplayRoutes: function() {
        fetch('map_routes.geojson')
            .then(response => response.json())
            .then(data => {
                this.routesData = data;
                this.displayMainRoutes(data);
            })
            .catch(error => {
                console.error('Error cargando rutas:', error);
            });
    },

    // Mostrar rutas principales en el mapa
    displayMainRoutes: function(routesData) {
        if (this.mainRouteLayer) {
            this.map.removeLayer(this.mainRouteLayer);
        }

        this.mainRouteLayer = L.geoJSON(routesData, {
            style: {
                color: '#10b981',
                weight: 6,
                opacity: 0.7,
                dashArray: '0',
                lineCap: 'round'
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<b>🛣️ Ruta Principal del Campus</b><br>Sigue esta ruta para navegación óptima con Dijkstra');
            }
        }).addTo(this.map);
    },

    // Mostrar edificios del campus
    displayCampusMap: function(geojsonData) {
        const buildingLayer = L.geoJSON(geojsonData, {
            style: function(feature) {
                const isSelected = appState.selectedDestination === feature.properties.name;
                return {
                    fillColor: isSelected ? '#ef4444' : '#3b82f6',
                    color: isSelected ? '#dc2626' : '#1d4ed8',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.4
                };
            },
            onEachFeature: function(feature, layer) {
                const name = feature.properties.name;
                layer.bindPopup(`
                    <div class="p-2">
                        <h3 class="font-bold text-lg">${name}</h3>
                        <button onclick="mapSystem.setDestination('${name}')" 
                                class="mt-2 bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition-colors">
                            Navegar aquí
                        </button>
                    </div>
                `);
                
                layer.on('click', function() {
                    mapSystem.setDestination(name);
                });
            }
        }).addTo(this.map);

        this.campusBounds = buildingLayer.getBounds();
        this.map.fitBounds(buildingLayer.getBounds());
    },

    // Inicializar GPS
    initGPS: function() {
        if (appState.settings.useGPS) {
            this.startGPSTracking();
        }
    },

    // Iniciar seguimiento GPS
    startGPSTracking: function() {
        voiceGuide.speak("Iniciando seguimiento GPS...");
        
        appState.gpsWatchId = gpsService.startTracking((location) => {
            this.updateUserLocation(location);
        });
        
        appState.isTracking = true;
        this.updateGPSButton(true);
    },

    // Detener seguimiento GPS
    stopGPSTracking: function() {
        if (appState.gpsWatchId) {
            gpsService.stopTracking(appState.gpsWatchId);
            appState.gpsWatchId = null;
            appState.isTracking = false;
            this.updateGPSButton(false);
            voiceGuide.speak("Seguimiento GPS detenido");
        }
    },

    // Actualizar ubicación del usuario
    updateUserLocation: function(location) {
        const newLocation = [location.lat, location.lng];
        const wasOutsideCampus = appState.currentLocation && 
                                !gpsService.isInCampus(appState.currentLocation[0], appState.currentLocation[1], this.campusBounds);
        
        appState.currentLocation = newLocation;

        if (!manualLocationSystem.isActive || location.source !== 'manual') {
            if (this.markers.start) {
                this.markers.start.setLatLng(newLocation);
            } else {
                this.markers.start = L.marker(newLocation, {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div class="w-6 h-6 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })
                }).addTo(this.map)
                .bindPopup('<b>📍 Tu ubicación actual</b><br>GPS activo')
                .openPopup();
            }

            if (location.source !== 'manual' && this.markers.accuracy) {
                this.map.removeLayer(this.markers.accuracy);
            }
            
            if (location.source !== 'manual') {
                this.markers.accuracy = L.circle(newLocation, {
                    radius: location.accuracy,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    weight: 1
                }).addTo(this.map);
            }
        }

        if ((!this.markers.start && !manualLocationSystem.manualMarker) || wasOutsideCampus) {
            this.map.setView(newLocation, 18);
            
            if (gpsService.isInCampus(location.lat, location.lng, this.campusBounds)) {
                voiceGuide.speak("Ubicación dentro del campus detectada");
            } else {
                voiceGuide.speak("Estás fuera del área del campus. Acércate para comenzar la navegación.");
            }
        }

        if (appState.selectedDestination && this.markers.end) {
            this.calculateRoute(newLocation, this.markers.end.getLatLng());
        }

        if (appState.navigationActive) {
            navigationSystem.updateUserPosition(newLocation);
        }

        if (location.source !== 'manual') {
            this.provideRouteProximityFeedback(newLocation);
        }
    },

    // Proporcionar feedback sobre proximidad a rutas
    provideRouteProximityFeedback: function(location) {
        // Esta función puede expandirse para dar feedback sobre rutas principales
        if (Math.random() < 0.1) {
            // Ocasionalmente dar feedback sobre la ubicación
        }
    },

    // Actualizar botón de GPS
    updateGPSButton: function(isActive) {
        let gpsButton = document.getElementById('gps-toggle-button');
        if (!gpsButton) {
            const mapTitle = document.getElementById('map-title');
            gpsButton = document.createElement('button');
            gpsButton.id = 'gps-toggle-button';
            gpsButton.className = 'ml-auto bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors';
            gpsButton.innerHTML = '<i data-lucide="navigation" class="w-4 h-4"></i>';
            gpsButton.title = isActive ? 'Detener GPS' : 'Activar GPS';
            gpsButton.setAttribute('aria-label', isActive ? 'Detener seguimiento GPS' : 'Activar seguimiento GPS');
            
            mapTitle.parentElement.appendChild(gpsButton);
            
            gpsButton.addEventListener('click', () => {
                if (appState.isTracking) {
                    this.stopGPSTracking();
                } else {
                    this.startGPSTracking();
                }
            });
            
            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }
        }

        gpsButton.className = isActive 
            ? 'ml-auto bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors animate-pulse'
            : 'ml-auto bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors';
        
        gpsButton.title = isActive ? 'GPS Activo - Click para detener' : 'GPS Inactivo - Click para activar';
        gpsButton.setAttribute('aria-label', isActive ? 'GPS activo. Click para detener' : 'GPS inactivo. Click para activar');
    },

    // Obtener límites del campus
    getCampusBounds: function(geojsonData) {
        const bounds = L.geoJSON(geojsonData).getBounds();
        return bounds;
    },

    // Establecer destino
    setDestination: function(destinationName) {
        appState.selectedDestination = destinationName;
        
        const building = this.campusData.features.find(feature => 
            feature.properties.name === destinationName
        );

        if (building) {
            const center = this.getPolygonCenter(building.geometry.coordinates[0]);
            
            if (this.markers.end) {
                this.map.removeLayer(this.markers.end);
            }

            this.markers.end = L.marker(center, {
                icon: L.divIcon({
                    className: 'destination-marker',
                    html: '<div class="w-6 h-6 bg-red-600 border-2 border-white rounded-full shadow-lg animate-pulse"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            })
            .addTo(this.map)
            .bindPopup(`<b>🎯 Destino:</b> ${destinationName}`)
            .openPopup();

            if (appState.currentLocation) {
                this.calculateRoute(appState.currentLocation, center);
            }

            const routeInfo = "Calculando ruta óptima con Dijkstra...";
                
            voiceGuide.speak(`Destino establecido: ${destinationName}. ${appState.currentLocation ? {routeInfo} : 'Active el GPS o use el modo manual para establecer su ubicación.'}`);
            
            if (!appState.isTracking && appState.settings.useGPS) {
                this.startGPSTracking();
            }
        }
    },

    // Calcular y mostrar ruta
    calculateRoute: function(start, end) {
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        const route = routingSystem.calculateRouteToDestination(start, end, appState.selectedDestination);
        
        this.routeLayer = L.polyline(route.coordinates, {
            color: '#ef4444',
            weight: 4,
            opacity: 0.8,
            dashArray: route.usesMainPaths ? '0' : '10, 10',
            lineCap: 'round'
        }).addTo(this.map);

        navigationSystem.startNavigation(route, appState.selectedDestination);

        this.map.fitBounds(this.routeLayer.getBounds());
    },

    // Detener navegación
    stopNavigation: function() {
        navigationSystem.stopNavigation();
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
    },

    // Obtener centro de polígono
    getPolygonCenter: function(coordinates) {
        let sumLat = 0, sumLng = 0;
        coordinates.forEach(coord => {
            sumLng += coord[0];
            sumLat += coord[1];
        });
        return [sumLat / coordinates.length, sumLng / coordinates.length];
    },

    // Buscar ubicación por nombre
    findLocationByName: function(name) {
        if (!this.campusData) return null;
        return this.campusData.features.find(feature => 
            feature.properties.name.toLowerCase().includes(name.toLowerCase())
        );
    }
};

// --- 12. FUNCIONES DE RENDERIZADO MEJORADAS ---

/**
 * Dibuja los botones de acceso rápido en el DOM con categorías
 */
function renderQuickAccessButtons() {
    const container = document.getElementById('quick-access-buttons');
    if (!container) return;

    const highContrast = appState.settings.highContrastMode;

    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            ${appState.quickDestinations.map(dest => {
                const iconColor = highContrast ? 'text-yellow-500' : 'text-red-600';
                const buttonClasses = highContrast 
                    ? 'bg-gray-800 border-yellow-500 text-yellow-300 hover:bg-gray-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300';
                
                return `
                    <button 
                        data-action="${dest.action}"
                        class="quick-access-btn flex items-center justify-center p-3 sm:p-4 border rounded-xl shadow-md transition-all text-sm font-semibold w-full h-16 sm:h-20 text-center ${buttonClasses} hover:scale-105 transform transition-transform"
                        aria-label="Acceso rápido a ${dest.name}"
                    >
                        <div class="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                            <i data-lucide="${dest.icon}" class="w-4 h-4 sm:w-5 sm:h-5 ${iconColor}"></i>
                            <span class="text-xs sm:text-sm">${dest.name}</span>
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
        
        <!-- Botón para ver todos los destinos -->
        <div class="mt-4 sm:mt-6">
            <button 
                id="show-all-destinations"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                onclick="showAllDestinationsModal()"
            >
                <i data-lucide="search" class="w-4 h-4"></i>
                Ver todos los destinos
            </button>
        </div>
    `;
    
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

/**
 * Muestra modal con todos los destinos organizados por categorías
 */
function showAllDestinationsModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div class="p-4 sm:p-6 border-b border-gray-200">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg sm:text-xl font-bold text-gray-900">Todos los Destinos</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="mt-2 relative">
                    <input 
                        type="text" 
                        id="destination-search"
                        placeholder="Buscar destino..."
                        class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                    <i data-lucide="search" class="absolute right-3 top-3 w-4 h-4 text-gray-400"></i>
                </div>
            </div>
            
            <div class="overflow-y-auto max-h-[60vh] p-4 sm:p-6 destinations-scroll">
                <div id="destinations-container">
                    ${renderDestinationsByCategory()}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Inicializar iconos
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
    
    // Configurar búsqueda
    const searchInput = document.getElementById('destination-search');
    searchInput.addEventListener('input', function(e) {
        filterDestinations(e.target.value);
    });
    
    // Cerrar modal al hacer click fuera
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Renderiza destinos por categoría SIN DUPLICADOS
 */
function renderDestinationsByCategory() {
    return destinationsSystem.categories.map(category => {
        // Filtrar items únicos por nombre
        const uniqueItems = [];
        const seenNames = new Set();
        
        category.items.forEach(item => {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                uniqueItems.push(item);
            }
        });
        
        return `
        <div class="mb-6">
            <div class="flex items-center gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
                <i data-lucide="${category.icon}" class="w-5 h-5 text-blue-600"></i>
                <h4 class="font-semibold text-gray-900">${category.name}</h4>
                <span class="ml-auto text-sm text-gray-500 bg-white px-2 py-1 rounded">
                    ${uniqueItems.length}
                </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                ${uniqueItems.map(item => `
                    <button 
                        onclick="selectDestinationFromModal('${item.name}')"
                        class="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors w-full"
                    >
                        <div class="font-medium text-gray-900 text-sm">${item.displayName}</div>
                        <div class="text-xs text-gray-500 mt-1">${category.name.replace(/[🚪🏫🏥⚽🅿️🌳🚻]/g, '')}</div>
                    </button>
                `).join('')}
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Filtrar destinos en el modal
 */
function filterDestinations(searchTerm) {
    const container = document.getElementById('destinations-container');
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
        container.innerHTML = renderDestinationsByCategory();
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
        return;
    }
    
    const allDestinations = destinationsSystem.getAllDestinations();
    const filtered = allDestinations.filter(dest => 
        dest.name.toLowerCase().includes(term) ||
        dest.displayName.toLowerCase().includes(term) ||
        dest.category.toLowerCase().includes(term)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i data-lucide="search-x" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
                <p class="text-gray-500">No se encontraron destinos</p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="font-semibold text-gray-900 mb-3">Resultados de búsqueda (${filtered.length})</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    ${filtered.map(dest => `
                        <button 
                            onclick="selectDestinationFromModal('${dest.name}')"
                            class="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors w-full"
                        >
                            <div class="font-medium text-gray-900 text-sm">${dest.displayName}</div>
                            <div class="text-xs text-gray-500 mt-1">${dest.category}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

/**
 * Seleccionar destino desde el modal
 */
function selectDestinationFromModal(destinationName) {
    document.querySelector('.fixed').remove();
    startNavigation(destinationName);
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

    body.classList.toggle('high-contrast-mode', highContrast);
    body.classList.toggle('bg-gray-100', !highContrast);

    const hcClass = highContrast ? 'bg-gray-900 border-yellow-500' : 'bg-white border-gray-100';
    const hcHeader = highContrast ? 'bg-gray-900 border-b-2 border-yellow-500' : 'bg-red-700';
    const searchInputClasses = highContrast 
        ? "bg-gray-800 text-yellow-300 border-yellow-500 placeholder-yellow-600 focus:ring-yellow-500 focus:border-yellow-500"
        : "border-gray-300 text-gray-900 focus:ring-red-500 focus:border-red-500";
    
    header.className = `shadow-xl p-4 sm:p-5 sticky top-0 z-50 transition-colors duration-300 ${hcHeader}`;
    card.className = `rounded-xl shadow-2xl p-6 sm:p-8 border transition-all duration-300 ${hcClass}`;
    searchInput.className = `w-full p-3 pl-10 border rounded-xl focus:ring-2 transition-shadow ${searchInputClasses}`;

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

    document.getElementById('accessibility-title').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('accessibility-title').classList.toggle('text-gray-800', !highContrast);
    
    document.getElementById('accessibility-icon').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('accessibility-icon').classList.toggle('text-red-600', !highContrast);

    document.getElementById('map-title').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('map-title').classList.toggle('text-gray-800', !highContrast);
    
    document.getElementById('map-icon').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('map-icon').classList.toggle('text-red-600', !highContrast);
    
    renderQuickAccessButtons();
    renderAccessibilityOptions();
}

/**
 * Función central que actualiza la UI llamando a todas las funciones de renderizado.
 */
function updateUI() {
    applyHighContrastStyles();
}

// --- 13. MANEJO DE EVENTOS ---

/**
 * Alterna el estado de una opción de accesibilidad y actualiza la UI.
 */
function toggleAccessibilityOption(key) {
    voiceGuide.cancel();
    
    appState.settings[key] = !appState.settings[key];

    if (key === 'highContrastMode') {
        updateUI();
    } else if (key === 'useGPS') {
        if (appState.settings.useGPS && !appState.isTracking) {
            mapSystem.startGPSTracking();
        } else if (!appState.settings.useGPS && appState.isTracking) {
            mapSystem.stopGPSTracking();
        }
    } else if (key === 'voiceCommands') {
        voiceRecognition.toggleVoiceCommands(appState.settings.voiceCommands);
        if (appState.settings.voiceCommands) {
            voiceGuide.speak("Comandos de voz activados. Diga 'ayuda' para conocer los comandos disponibles.");
        } else {
            voiceGuide.speak("Comandos de voz desactivados.");
        }
    } else {
        renderAccessibilityOptions();
    }
    
    if (appState.settings.isVoiceActive) {
        const option = appState.accessibilityOptions.find(o => o.key === key);
        if (option) {
            const status = appState.settings[key] ? 'activada' : 'desactivada';
            voiceGuide.speak(`${option.label} ${status}.`);
        }
    }
}

/**
 * Inicia la navegación hacia un destino
 */
function startNavigation(destination) {
    voiceGuide.speak(`Buscando ${destination} en el mapa...`);
    
    mapSystem.stopNavigation();
    
    const location = mapSystem.findLocationByName(destination);
    
    if (location) {
        const locationName = location.properties.name;
        mapSystem.setDestination(locationName);
        
        if (!appState.isTracking && appState.settings.useGPS) {
            mapSystem.startGPSTracking();
        }
    } else {
        voiceGuide.speak(`No se encontró ${destination}. Por favor, intenta con otro nombre.`);
    }
}

// --- 14. INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    
    // Cargar datos del edificio primero para inicializar destinos
    fetch('map.geojson')
        .then(response => response.json())
        .then(data => {
            appState.buildingData = data;
            destinationsSystem.init(data);
            renderQuickAccessButtons();
            
            // Inicializar mapa después de cargar destinos
            mapSystem.initMap();
        })
        .catch(error => {
            console.error('Error cargando datos de edificios:', error);
            mapSystem.initMap();
        });
    
    if (voiceRecognition.init()) {
        console.log('Reconocimiento de voz inicializado correctamente');
        voiceRecognition.createVoiceButton();
    } else {
        console.warn('Reconocimiento de voz no disponible');
    }
    
    setTimeout(() => {
        if(appState.settings.isVoiceActive) {
            const welcomeMessage = `
                Bienvenido a UniNav. Sistema de navegación accesible cargado. 
                Puede usar comandos de voz como 'Vamos a la biblioteca', 'Llévame al bloque 5' o 'Necesito ir a enfermería'.
                Diga 'modo manual' para activar la ubicación manual o 'ayuda' para más comandos.
            `;
            voiceGuide.speak(welcomeMessage);
        }
    }, 2000);
    
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.code === 'Space') {
            event.preventDefault();
            voiceRecognition.startListening();
        }
        
        if (event.code === 'Escape') {
            if (voiceRecognition.isListening) {
                voiceRecognition.stopListening();
            } else if (appState.navigationActive) {
                mapSystem.stopNavigation();
            }
        }
    });
    
    document.getElementById('quick-access-buttons')?.addEventListener('click', (event) => {
        const button = event.target.closest('.quick-access-btn');
        if (button) {
            const destination = button.dataset.action;
            startNavigation(destination);
        }
    });

    document.getElementById('accessibility-options')?.addEventListener('click', (event) => {
        const optionDiv = event.target.closest('.accessibility-option');
        if (optionDiv) {
            const key = optionDiv.dataset.key;
            toggleAccessibilityOption(key);
        }
    });

    const searchInput = document.getElementById('search-input');
    const navigateButton = document.getElementById('navigate-button');
    
    if (searchInput && navigateButton) {
        searchInput.addEventListener('input', (e) => {
            const hasText = e.target.value.trim().length > 0;
            navigateButton.classList.toggle('opacity-0', !hasText);
            navigateButton.classList.toggle('pointer-events-none', !hasText);
            navigateButton.classList.toggle('opacity-100', hasText);
        });

        navigateButton.addEventListener('click', () => {
            const destination = searchInput.value.trim();
            if (destination) {
                startNavigation(destination);
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const destination = searchInput.value.trim();
                if (destination) {
                    startNavigation(destination);
                }
            }
        });
    }

    // Función de depuración para verificar bloques
    function debugBlocks() {
        const blocksCategory = destinationsSystem.categories.find(cat => cat.id === 'bloques');
        if (blocksCategory) {
            console.log('📊 DEBUG - Bloques cargados:');
            blocksCategory.items.forEach((block, index) => {
                console.log(`${index + 1}. ${block.name} -> ${block.displayName}`);
            });
            console.log(`Total: ${blocksCategory.items.length} bloques únicos`);
        }
    }

    // Llamar después de cargar los datos
    setTimeout(debugBlocks, 3000);

    window.testDijkstra = testDijkstra;
    window.voiceRecognition = voiceRecognition;
    window.manualLocationSystem = manualLocationSystem;
    window.showAllDestinationsModal = showAllDestinationsModal;
    window.selectDestinationFromModal = selectDestinationFromModal;

    window.setManualLocation = function(lat, lng) {
        manualLocationSystem.toggleManualMode();
        setTimeout(() => {
            manualLocationSystem.setManualLocation({ lat: lat, lng: lng });
        }, 100);
    };
});

// --- 15. ESTILOS CSS ---
const appStyles = `
    .manual-location-marker {
        z-index: 1000;
    }
    
    .manual-instruction {
        animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .manual-location-marker .animate-pulse {
        animation: manualPulse 2s infinite;
    }
    
    @keyframes manualPulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    .voice-listening {
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    
    #voice-command-button.listening {
        background-color: #10b981 !important;
        animation: pulse 1.5s infinite;
    }

    /* Estilos para puntos de interés */
    .point-marker {
        z-index: 500;
    }
    
    .point-marker.highlighted {
        z-index: 1000;
    }
    
    .point-notification {
        animation: slideInRight 0.3s ease-out;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .animate-fade-in {
        animation: fadeIn 0.3s ease-in;
    }
    
    .animate-fade-out {
        animation: fadeOut 0.3s ease-out;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    /* Colores para los puntos */
    .border-red-500 { border-color: #ef4444; }
    .border-green-500 { border-color: #10b981; }
    .border-yellow-500 { border-color: #f59e0b; }
    .border-blue-500 { border-color: #3b82f6; }
    
    .bg-red-50 { background-color: #fef2f2; }
    .bg-yellow-50 { background-color: #fefce8; }
    .bg-blue-50 { background-color: #eff6ff; }
    
    .text-red-800 { color: #991b1b; }
    .text-yellow-800 { color: #92400e; }
    .text-blue-800 { color: #1e40af; }
    
    .text-red-600 { color: #dc2626; }
    .text-yellow-600 { color: #d97706; }
    .text-blue-600 { color: #2563eb; }
    
    .bg-red-500 { background-color: #ef4444; }
    .bg-green-500 { background-color: #10b981; }
    .bg-yellow-500 { background-color: #f59e0b; }
    .bg-blue-500 { background-color: #3b82f6; }
    
    .bg-red-100 { background-color: #fee2e2; }
    .bg-yellow-100 { background-color: #fef3c7; }
    .bg-blue-100 { background-color: #dbeafe; }

    /* Estilos para el modal de destinos */
    .destination-modal {
        animation: slideUp 0.3s ease-out;
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Mejoras responsive */
    @media (max-width: 640px) {
        .quick-access-btn {
            padding: 12px 8px;
        }
        
        .destination-grid {
            grid-template-columns: 1fr;
        }
    }
    
    @media (min-width: 641px) and (max-width: 1024px) {
        .destination-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    
    /* Efectos hover mejorados */
    .quick-access-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    /* Scroll personalizado */
    .destinations-scroll::-webkit-scrollbar {
        width: 6px;
    }
    
    .destinations-scroll::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .destinations-scroll::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    .destinations-scroll::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = appStyles;
document.head.appendChild(styleSheet);
