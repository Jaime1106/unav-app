// js/app.js - SISTEMA COMPLETO CON GPS Y RUTAS REALES

// --- 1. ESTADO DE LA APLICACIÓN ---
let appState = {
    settings: {
        isVoiceActive: true,
        avoidStairs: true,
        prioritizeElevators: false,
        highContrastMode: false,
        useGPS: true
    },
    quickDestinations: [
        { name: 'Biblioteca', icon: 'BookOpen', action: 'Biblioteca CUC' },
        { name: 'Cafetería', icon: 'Utensils', action: 'Container de comida' },
        { name: 'Parking', icon: 'Car', action: 'Parqueaderos zona sur' },
        { name: 'Entrada', icon: 'Send', action: 'entrada cl. 58' },
    ],
    accessibilityOptions: [
        { key: 'isVoiceActive', label: 'Activar guía de voz automáticamente' },
        { key: 'avoidStairs', label: 'Evitar escaleras cuando sea posible' },
        { key: 'prioritizeElevators', label: 'Priorizar rutas con ascensor' },
        { key: 'highContrastMode', label: 'Modo alto contraste' },
        { key: 'useGPS', label: 'Usar GPS para ubicación en tiempo real' }
    ],
    currentLocation: null,
    selectedDestination: null,
    map: null,
    gpsWatchId: null,
    isTracking: false,
    campusGraph: null
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

// --- 3. SISTEMA DE GPS Y UBICACIÓN ---
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
        if (!campusBounds) return true; // Si no hay bounds, asumimos que está en campus
        
        return (
            lat >= campusBounds.getSouth() &&
            lat <= campusBounds.getNorth() &&
            lng >= campusBounds.getWest() && 
            lng <= campusBounds.getEast()
        );
    }
};

// --- 4. SISTEMA DE RUTAS MEJORADO ---
const routingSystem = {
    campusGraph: null,
    mainRoute: null,
    
    // Inicializar sistema de rutas
    init: function() {
        this.loadRouteNetwork();
    },
    
    // Cargar la red de rutas desde el GeoJSON
    loadRouteNetwork: function() {
        fetch('map_routes.geojson')
            .then(response => response.json())
            .then(data => {
                this.mainRoute = data.features[0];
                this.buildGraphFromRoute();
                console.log('Sistema de rutas cargado:', this.campusGraph);
                
                if(appState.settings.isVoiceActive) {
                    voiceGuide.speak("Red de rutas del campus cargada correctamente");
                }
            })
            .catch(error => {
                console.error('Error cargando rutas:', error);
                // No hablar aquí para no molestar si las rutas no son críticas
            });
    },
    
    // Construir grafo de navegación desde la ruta principal
    buildGraphFromRoute: function() {
        this.campusGraph = {
            nodes: [],
            edges: []
        };
        
        const coordinates = this.mainRoute.geometry.coordinates;
        
        // Crear nodos para cada punto de la ruta
        coordinates.forEach((coord, index) => {
            this.campusGraph.nodes.push({
                id: index,
                lat: coord[1],
                lng: coord[0],
                coord: [coord[1], coord[0]]
            });
            
            // Crear aristas entre puntos consecutivos
            if (index > 0) {
                const prevNode = this.campusGraph.nodes[index - 1];
                const currentNode = this.campusGraph.nodes[index];
                const distance = this.calculateDistance(prevNode.coord, currentNode.coord);
                
                this.campusGraph.edges.push({
                    from: index - 1,
                    to: index,
                    distance: distance,
                    bidirectional: true
                });
            }
        });
    },
    
    // Encontrar el punto más cercano en la ruta a una ubicación dada
    findNearestRoutePoint: function(location) {
        if (!this.campusGraph) return null;
        
        let nearestNode = null;
        let minDistance = Infinity;
        
        this.campusGraph.nodes.forEach(node => {
            const distance = this.calculateDistance(location, node.coord);
            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = node;
            }
        });
        
        return nearestNode;
    },
    
    // Calcular ruta desde ubicación actual hasta destino
    calculateRouteToDestination: function(startLocation, destinationLocation) {
        if (!this.campusGraph) {
            return this.calculateDirectRoute(startLocation, destinationLocation);
        }
        
        // Encontrar puntos más cercanos en la ruta
        const startNode = this.findNearestRoutePoint(startLocation);
        const endNode = this.findNearestRoutePoint(destinationLocation);
        
        if (!startNode || !endNode) {
            return this.calculateDirectRoute(startLocation, destinationLocation);
        }
        
        // Calcular ruta a través de la red de caminos
        const routePath = this.findPathInGraph(startNode.id, endNode.id);
        
        if (routePath && routePath.length > 0) {
            return this.buildRouteFromPath(routePath, startLocation, destinationLocation);
        } else {
            return this.calculateDirectRoute(startLocation, destinationLocation);
        }
    },
    
    // Encontrar camino en el grafo (BFS simple)
    findPathInGraph: function(startId, endId) {
        const visited = new Set();
        const queue = [{ id: startId, path: [startId] }];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.id === endId) {
                return current.path;
            }
            
            if (!visited.has(current.id)) {
                visited.add(current.id);
                
                // Encontrar conexiones desde este nodo
                const connections = this.campusGraph.edges.filter(edge => 
                    edge.from === current.id || edge.to === current.id
                );
                
                connections.forEach(edge => {
                    const nextId = edge.from === current.id ? edge.to : edge.from;
                    if (!visited.has(nextId)) {
                        queue.push({
                            id: nextId,
                            path: [...current.path, nextId]
                        });
                    }
                });
            }
        }
        
        return null;
    },
    
    // Construir ruta completa desde el camino encontrado
    buildRouteFromPath: function(path, startLocation, destinationLocation) {
        const routeCoordinates = [startLocation];
        
        // Añadir puntos de la ruta principal
        path.forEach(nodeId => {
            const node = this.campusGraph.nodes[nodeId];
            routeCoordinates.push([node.lat, node.lng]);
        });
        
        routeCoordinates.push(destinationLocation);
        
        return {
            coordinates: routeCoordinates,
            distance: this.calculateRouteDistance(routeCoordinates),
            type: 'campus_route',
            usesMainPaths: true
        };
    },
    
    // Ruta directa (fallback)
    calculateDirectRoute: function(start, end) {
        return {
            coordinates: [start, end],
            distance: this.calculateDistance(start, end),
            type: 'direct',
            usesMainPaths: false
        };
    },
    
    // Calcular distancia total de una ruta
    calculateRouteDistance: function(routeCoordinates) {
        let totalDistance = 0;
        for (let i = 1; i < routeCoordinates.length; i++) {
            totalDistance += this.calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        }
        return totalDistance;
    },
    
    // Calcular distancia entre dos puntos (Haversine)
    calculateDistance: function(point1, point2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (point2[0] - point1[0]) * Math.PI / 180;
        const dLon = (point2[1] - point1[1]) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },
    
    // Verificar si un punto está cerca de la ruta principal
    isNearMainRoute: function(location, maxDistance = 50) {
        if (!this.campusGraph) return false;
        
        const nearestNode = this.findNearestRoutePoint(location);
        if (!nearestNode) return false;
        
        const distance = this.calculateDistance(location, nearestNode.coord);
        return distance <= maxDistance;
    }
};

// --- 5. SISTEMA DE MAPAS ACTUALIZADO CON RUTAS ---
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

    // Inicializar el mapa
    initMap: function() {
        this.map = L.map('campus-map').setView([10.9948, -74.7909], 17);
        
        // Capa base de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 20
        }).addTo(this.map);

        // Cargar datos del campus
        this.loadCampusGeoJSON();
        
        // Iniciar GPS automáticamente
        this.initGPS();
        
        // Iniciar sistema de rutas
        routingSystem.init();
    },

    // Cargar y mostrar el GeoJSON del campus
    loadCampusGeoJSON: function() {
        fetch('map.geojson')
            .then(response => response.json())
            .then(data => {
                this.campusData = data;
                this.displayCampusMap(data);
                this.campusBounds = this.getCampusBounds(data);
                
                // Cargar y mostrar rutas principales
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
                layer.bindPopup('<b>🛣️ Ruta Principal del Campus</b><br>Sigue esta ruta para navegación óptima');
            }
        }).addTo(this.map);
    },

    // Mostrar edificios del campus
    displayCampusMap: function(geojsonData) {
        const buildingLayer = L.geoJSON(geojsonData, {
            style: function(feature) {
                const isSelected = appState.selectedDestination === Object.keys(feature.properties)[0];
                return {
                    fillColor: isSelected ? '#ef4444' : '#3b82f6',
                    color: isSelected ? '#dc2626' : '#1d4ed8',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.4
                };
            },
            onEachFeature: function(feature, layer) {
                const name = Object.keys(feature.properties)[0] || 'Edificio';
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

        // Actualizar o crear marcador de ubicación
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

        // Actualizar círculo de precisión
        if (this.markers.accuracy) {
            this.map.removeLayer(this.markers.accuracy);
        }
        
        this.markers.accuracy = L.circle(newLocation, {
            radius: location.accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(this.map);

        // Centrar mapa en ubicación si es la primera vez o si estaba fuera del campus
        if (!this.markers.start || wasOutsideCampus) {
            this.map.setView(newLocation, 18);
            
            if (gpsService.isInCampus(location.lat, location.lng, this.campusBounds)) {
                voiceGuide.speak("Ubicación dentro del campus detectada");
            } else {
                voiceGuide.speak("Estás fuera del área del campus. Acércate para comenzar la navegación.");
            }
        }

        // Recalcular ruta si hay destino
        if (appState.selectedDestination && this.markers.end) {
            this.calculateRoute(newLocation, this.markers.end.getLatLng());
        }

        // Feedback de proximidad a rutas
        this.provideRouteProximityFeedback(newLocation);
    },

    // Proporcionar feedback sobre proximidad a rutas
    provideRouteProximityFeedback: function(location) {
        if (routingSystem.isNearMainRoute(location, 20)) {
            // Usuario está en ruta principal
            if (Math.random() < 0.1) { // Solo hablar ocasionalmente para no molestar
                voiceGuide.speak("Estás en la ruta principal del campus");
            }
        } else if (routingSystem.isNearMainRoute(location, 50)) {
            // Usuario cerca de ruta principal
            if (Math.random() < 0.05) {
                voiceGuide.speak("Ruta principal cercana, dirígete hacia la línea verde en el mapa");
            }
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
            Object.keys(feature.properties)[0] === destinationName
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

            const routeInfo = routingSystem.isNearMainRoute(center) ? 
                "Ubicado en ruta principal. " : 
                "Dirígete hacia la ruta principal verde. ";
                
            voiceGuide.speak(`Destino establecido: ${destinationName}. ${routeInfo} ${appState.currentLocation ? 'Calculando ruta...' : 'Activando GPS...'}`);
            
            if (!appState.isTracking && appState.settings.useGPS) {
                this.startGPSTracking();
            }
        }
    },

    // Calcular y mostrar ruta
    calculateRoute: function(start, end) {
        // Limpiar ruta anterior
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        // Calcular ruta usando el sistema de rutas
        const route = routingSystem.calculateRouteToDestination(start, end);
        
        // Mostrar ruta en el mapa
        this.routeLayer = L.polyline(route.coordinates, {
            color: '#ef4444',
            weight: 4,
            opacity: 0.8,
            dashArray: route.usesMainPaths ? '0' : '10, 10',
            lineCap: 'round'
        }).addTo(this.map);

        // Información de la ruta
        const time = Math.round(route.distance / 1.4);
        const routeType = route.usesMainPaths ? 
            "Ruta optimizada por caminos principales. " : 
            "Ruta directa. Sigue con precaución. ";

        voiceGuide.speak(`${routeType} Distancia: ${Math.round(route.distance)} metros. Tiempo estimado: ${time} segundos. Sigue la línea roja.`);

        // Ajustar vista para mostrar ruta completa
        this.map.fitBounds(this.routeLayer.getBounds());
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
            Object.keys(feature.properties)[0].toLowerCase().includes(name.toLowerCase())
        );
    }
};

// --- 6. FUNCIONES DE RENDERIZADO Y ACTUALIZACIÓN ---

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
    header.className = `shadow-xl p-4 sm:p-5 sticky top-0 z-50 transition-colors duration-300 ${hcHeader}`;
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

    // Sección del Mapa
    document.getElementById('map-title').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('map-title').classList.toggle('text-gray-800', !highContrast);
    
    document.getElementById('map-icon').classList.toggle('text-yellow-300', highContrast);
    document.getElementById('map-icon').classList.toggle('text-red-600', !highContrast);
    
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

// --- 7. MANEJO DE EVENTOS ---

/**
 * Alterna el estado de una opción de accesibilidad y actualiza la UI.
 */
function toggleAccessibilityOption(key) {
    voiceGuide.cancel();
    
    appState.settings[key] = !appState.settings[key];

    // Si se activa/desactiva el modo de Alto Contraste, debemos llamar a updateUI
    if (key === 'highContrastMode') {
        updateUI();
    } else if (key === 'useGPS') {
        if (appState.settings.useGPS && !appState.isTracking) {
            mapSystem.startGPSTracking();
        } else if (!appState.settings.useGPS && appState.isTracking) {
            mapSystem.stopGPSTracking();
        }
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
 * Inicia la navegación hacia un destino
 */
function startNavigation(destination) {
    voiceGuide.speak(`Buscando ${destination} en el mapa...`);
    
    // Buscar el destino en el GeoJSON
    const location = mapSystem.findLocationByName(destination);
    
    if (location) {
        const locationName = Object.keys(location.properties)[0];
        mapSystem.setDestination(locationName);
        
        // Asegurar que el GPS esté activo
        if (!appState.isTracking && appState.settings.useGPS) {
            mapSystem.startGPSTracking();
        }
    } else {
        voiceGuide.speak(`No se encontró ${destination}. Por favor, intenta con otro nombre.`);
    }
}

// --- 8. INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar la UI y estilos
    updateUI();
    
    // Inicializar el mapa
    mapSystem.initMap();
    
    // Mensaje de bienvenida inicial
    setTimeout(() => {
        if(appState.settings.isVoiceActive) {
            voiceGuide.speak("Bienvenido a UniNav. Mapa del campus cargado. Activando GPS para encontrar tu ubicación...");
        }
    }, 2000); 

    // 8.1. Listener para los botones de acceso rápido (Delegación)
    document.getElementById('quick-access-buttons')?.addEventListener('click', (event) => {
        const button = event.target.closest('.quick-access-btn');
        if (button) {
            const destination = button.dataset.action;
            startNavigation(destination);
        }
    });

    // 8.2. Listener para las opciones de accesibilidad (Delegación)
    document.getElementById('accessibility-options')?.addEventListener('click', (event) => {
        const optionDiv = event.target.closest('.accessibility-option');
        if (optionDiv) {
            const key = optionDiv.dataset.key;
            toggleAccessibilityOption(key);
        }
    });

    // 8.3. Listener para el campo de búsqueda y botón de navegación
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

    // 8.4. Permitir al usuario hacer click en el mapa para establecer ubicación manual
    mapSystem.map.on('click', function(e) {
        if (!appState.isTracking) {
            const manualLocation = {
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                accuracy: 10,
                timestamp: Date.now()
            };
            mapSystem.updateUserLocation(manualLocation);
            voiceGuide.speak("Ubicación establecida manualmente");
        }
    });
});