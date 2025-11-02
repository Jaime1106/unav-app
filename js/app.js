// js/app.js - SISTEMA COMPLETO CON GPS, RUTAS REALES, DIJKSTRA, VOZ Y MODO MANUAL

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
        { name: 'Biblioteca', icon: 'BookOpen', action: 'Biblioteca CUC' },
        { name: 'Cafetería', icon: 'Utensils', action: 'Central' },
        { name: 'Parking', icon: 'Car', action: 'Parqueaderos zona sur' },
        { name: 'Entrada', icon: 'Send', action: 'entrada cl. 58' },
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
    manualMode: false
};

// --- 2. LÓGICA DE VOZ (TTS) MEJORADA ---
const voiceGuide = {
    isSpeaking: false,
    lastInstruction: '',
    
    // Función para iniciar la lectura de un texto
    speak: (text, priority = false) => {
        // Solo hablar si la guía está activa
        if (!appState.settings.isVoiceActive) return;
        
        // No repetir la misma instrucción inmediatamente
        if (text === voiceGuide.lastInstruction && !priority) return;

        if ('speechSynthesis' in window) {
            if (voiceGuide.isSpeaking && !priority) {
                window.speechSynthesis.cancel();
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            utterance.volume = 1.0;

            utterance.onstart = () => { 
                voiceGuide.isSpeaking = true; 
                voiceGuide.lastInstruction = text;
            };
            utterance.onend = () => { 
                voiceGuide.isSpeaking = false; 
            };
            utterance.onerror = (e) => { 
                console.error('Error TTS:', e); 
                voiceGuide.isSpeaking = false;
            };

            if (priority) {
                window.speechSynthesis.speak(utterance);
            } else {
                window.speechSynthesis.cancel();
                setTimeout(() => {
                    window.speechSynthesis.speak(utterance);
                }, 100);
            }
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
    },
    
    // Instrucciones de navegación específicas
    giveNavigationInstruction: function(instruction, distance = null) {
        let fullInstruction = instruction;
        if (distance !== null) {
            fullInstruction += `. En aproximadamente ${Math.round(distance)} metros`;
        }
        this.speak(fullInstruction, true);
    },
    
    // Anunciar llegada a punto de interés
    announcePointOfInterest: function(pointType, pointName = '') {
        const messages = {
            'stairs': `Atención: escaleras ${pointName ? 'en ' + pointName : 'por delante'}. Tenga cuidado.`,
            'ramp': `Rampa disponible ${pointName ? 'en ' + pointName : ''}. Puede usarla si necesita.`,
            'relief_change': `Cambio de relieve en el camino. Preste atención al suelo.`,
            'building_entrance': `Ha llegado a la entrada de ${pointName}.`
        };
        
        if (messages[pointType]) {
            this.speak(messages[pointType], true);
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
        if (!campusBounds) return true;
        
        return (
            lat >= campusBounds.getSouth() &&
            lat <= campusBounds.getNorth() &&
            lng >= campusBounds.getWest() && 
            lng <= campusBounds.getEast()
        );
    }
};

// --- 4. SISTEMA DE RUTAS MEJORADO CON DIJKSTRA ---
const routingSystem = {
    campusGraph: null,
    allRoutes: [],
    routePoints: {},
    buildingLocations: {},
    
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
                    const name = Object.keys(building.properties)[0];
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
    
    // Construir grafo completo con todas las rutas
    buildCompleteGraph: function() {
        this.campusGraph = {
            nodes: [],
            edges: [],
            nodeMap: new Map()
        };
        
        let nodeId = 0;
        
        this.allRoutes.forEach(route => {
            const coordinates = route.geometry.coordinates;
            const routeName = Object.keys(route.properties)[0] || 'ruta_sin_nombre';
            const routeType = this.classifyRoute(route.properties);
            
            const routeNodes = [];
            coordinates.forEach((coord, index) => {
                const node = {
                    id: nodeId++,
                    lat: coord[1],
                    lng: coord[0],
                    coord: [coord[1], coord[0]],
                    route: routeName,
                    routeType: routeType,
                    isEndpoint: index === 0 || index === coordinates.length - 1
                };
                
                this.campusGraph.nodes.push(node);
                routeNodes.push(node);
                
                const key = `${coord[1].toFixed(6)},${coord[0].toFixed(6)}`;
                if (!this.campusGraph.nodeMap.has(key)) {
                    this.campusGraph.nodeMap.set(key, []);
                }
                this.campusGraph.nodeMap.get(key).push(node);
            });
            
            for (let i = 1; i < routeNodes.length; i++) {
                const prevNode = routeNodes[i - 1];
                const currentNode = routeNodes[i];
                const distance = this.calculateDistance(prevNode.coord, currentNode.coord);
                
                this.campusGraph.edges.push({
                    from: prevNode.id,
                    to: currentNode.id,
                    distance: distance,
                    route: routeName,
                    routeType: routeType,
                    bidirectional: true
                });
                
                this.campusGraph.edges.push({
                    from: currentNode.id,
                    to: prevNode.id,
                    distance: distance,
                    route: routeName,
                    routeType: routeType,
                    bidirectional: true
                });
            }
        });
        
        this.createIntersections();
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
                        route: 'connection',
                        routeType: 'connection',
                        bidirectional: true
                    });
                    
                    this.campusGraph.edges.push({
                        from: node2.id,
                        to: node1.id,
                        distance: distance,
                        route: 'connection',
                        routeType: 'connection',
                        bidirectional: true
                    });
                    
                    connectedPairs.add(pairKey);
                }
            });
        });
    },
    
    // ALGORITMO DE DIJKSTRA MEJORADO
    findPathInGraph: function(startId, endId) {
        if (startId === endId) return { path: [startId], totalDistance: 0 };
        
        const distances = {};
        const previous = {};
        const unvisited = new Set();
        const visited = new Set();
        
        this.campusGraph.nodes.forEach(node => {
            distances[node.id] = node.id === startId ? 0 : Infinity;
            previous[node.id] = null;
            unvisited.add(node.id);
        });
        
        while (unvisited.size > 0) {
            let currentId = null;
            let minDistance = Infinity;
            
            unvisited.forEach(nodeId => {
                if (distances[nodeId] < minDistance) {
                    minDistance = distances[nodeId];
                    currentId = nodeId;
                }
            });
            
            if (currentId === null || minDistance === Infinity) break;
            
            if (currentId === endId) {
                const path = this.reconstructPath(previous, startId, endId);
                return {
                    path: path,
                    totalDistance: distances[endId],
                    nodes: path.map(id => this.campusGraph.nodes[id])
                };
            }
            
            unvisited.delete(currentId);
            visited.add(currentId);
            
            const connections = this.campusGraph.edges.filter(edge => 
                edge.from === currentId && !visited.has(edge.to)
            );
            
            connections.forEach(edge => {
                let edgeCost = edge.distance;
                
                if (appState.settings.avoidStairs && edge.routeType === 'stairs') {
                    edgeCost *= 5;
                }
                
                if (appState.settings.prioritizeElevators && edge.routeType === 'ramp') {
                    edgeCost *= 0.5;
                }
                
                const alternativeDistance = distances[currentId] + edgeCost;
                
                if (alternativeDistance < distances[edge.to]) {
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
            
            if (currentNode.route !== nextNode.route) {
                instructions.push({
                    type: 'route_change',
                    text: `Cambie a la ruta ${nextNode.route}`,
                    distance: segmentDistance,
                    node: nextNode
                });
            }
            
            const pointsOfInterest = this.getPointsOfInterestNearNode(nextNode, 10);
            pointsOfInterest.forEach(point => {
                instructions.push({
                    type: point.type,
                    text: this.getPointInstruction(point),
                    distance: segmentDistance,
                    node: nextNode,
                    point: point
                });
            });
            
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
            nodes: routeNodes
        };
    },
    
    // Obtener puntos de interés cerca de un nodo
    getPointsOfInterestNearNode: function(node, maxDistance) {
        const points = [];
        
        Object.keys(this.routePoints).forEach(routeName => {
            this.routePoints[routeName].forEach(point => {
                const distance = this.calculateDistance(node.coord, point.coordinates);
                if (distance <= maxDistance) {
                    points.push(point);
                }
            });
        });
        
        return points;
    },
    
    // Generar instrucción para punto de interés
    getPointInstruction: function(point) {
        switch(point.type) {
            case 'stairs':
                return `Atención: escaleras por delante. Tenga cuidado.`;
            case 'ramp':
                return `Rampa disponible. Puede usarla si necesita.`;
            case 'relief_change':
                return `Cambio de relieve en el camino. Preste atención al suelo.`;
            default:
                return `Punto de interés: ${point.name}`;
        }
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

// --- 5. SISTEMA DE NAVEGACIÓN EN TIEMPO REAL ---
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
        
        console.log('Iniciando navegación con instrucciones:', route.instructions);
        
        const locationSource = manualLocationSystem.isActive ? "ubicación manual" : "GPS";
        voiceGuide.speak(`Navegación iniciada desde ${locationSource}. ${route.instructions.length} instrucciones hasta ${destinationName}. Distancia total: ${Math.round(route.distance)} metros.`);
        
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
            voiceGuide.giveNavigationInstruction(instruction.text, instruction.distance);
            
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
        this.checkProximityToPoints(userLocation);
        this.checkRouteDeviation(userLocation);
    },
    
    // Verificar proximidad a puntos de interés
    checkProximityToPoints: function(userLocation) {
        if (!this.currentRoute.instructions) return;
        
        const currentInstruction = this.currentRoute.instructions[this.currentInstructionIndex];
        if (currentInstruction && currentInstruction.point) {
            const distanceToPoint = routingSystem.calculateDistance(userLocation, currentInstruction.point.coordinates);
            
            if (distanceToPoint <= 15) {
                voiceGuide.announcePointOfInterest(currentInstruction.point.type, currentInstruction.point.name);
            }
        }
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

// --- 6. SISTEMA DE RECONOCIMIENTO DE VOZ ---
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
    
    // Procesar comando de voz
    processCommand: function(transcript) {
        const command = transcript.toLowerCase().trim();
        console.log('Comando recibido:', command);
        
        voiceGuide.speak(`Entendí: ${command}`);
        
        if (manualLocationSystem.handleVoiceCommand(command)) {
            return;
        }
        
        if (this.containsAny(command, ['navegar', 'ir', 'dirección', 'llevar', 'rumbo'])) {
            this.processNavigationCommand(command);
        }
        else if (this.containsAny(command, ['biblioteca', 'libros', 'estudio'])) {
            voiceGuide.speak("Navegando hacia la biblioteca");
            startNavigation('Biblioteca CUC');
        }
        else if (this.containsAny(command, ['cafetería', 'comer', 'almorzar', 'comida'])) {
            voiceGuide.speak("Navegando hacia la cafetería");
            startNavigation('Central');
        }
        else if (this.containsAny(command, ['parking', 'estacionamiento', 'parqueadero', 'coche', 'carro'])) {
            voiceGuide.speak("Navegando hacia el parqueadero");
            startNavigation('Parqueaderos zona sur');
        }
        else if (this.containsAny(command, ['entrada', 'entrar', 'principal', 'acceso'])) {
            voiceGuide.speak("Navegando hacia la entrada principal");
            startNavigation('entrada cl. 58');
        }
        else if (this.containsAny(command, ['detener', 'parar', 'cancelar', 'terminar navegación'])) {
            voiceGuide.speak("Deteniendo navegación");
            mapSystem.stopNavigation();
        }
        else if (this.containsAny(command, ['activar gps', 'encender gps', 'iniciar gps'])) {
            voiceGuide.speak("Activando GPS");
            if (!appState.isTracking) {
                mapSystem.startGPSTracking();
            }
        }
        else if (this.containsAny(command, ['desactivar gps', 'apagar gps', 'detener gps'])) {
            voiceGuide.speak("Desactivando GPS");
            if (appState.isTracking) {
                mapSystem.stopGPSTracking();
            }
        }
        else if (this.containsAny(command, ['dónde estoy', 'mi ubicación', 'ubicación actual'])) {
            this.speakCurrentLocation();
        }
        else if (this.containsAny(command, ['repetir instrucción', 'repite', 'otra vez'])) {
            voiceGuide.speak("Repitiendo última instrucción");
            navigationSystem.repeatLastInstruction();
        }
        else if (this.containsAny(command, ['siguiente instrucción', 'próxima instrucción'])) {
            voiceGuide.speak("Avanzando a siguiente instrucción");
            navigationSystem.giveNextInstruction();
        }
        else if (this.containsAny(command, ['ayuda', 'comandos', 'qué puedo decir'])) {
            this.showVoiceHelp();
        }
        else {
            voiceGuide.speak("No entendí el comando. Diga 'ayuda' para conocer los comandos disponibles.");
        }
    },
    
    // Procesar comandos de navegación complejos
    processNavigationCommand: function(command) {
        const destinations = {
            'bloque 1': 'Bloque 1',
            'bloque 2': 'Bloque 2',
            'bloque 4': 'bloque 4',
            'bloque 5': 'Bloque 5',
            'bloque 6': 'Bloque 6',
            'bloque 7': 'Bloque 7',
            'bloque 8': 'bloque 8',
            'bloque 9': 'Bloque 9',
            'bloque 10': 'Bloque 10',
            'bloque 11': 'Bloque 11',
            'bloque 12': 'Bloque 12',
            'coliseo': 'Coliseo auditorio',
            'auditorio': 'Coliseo auditorio',
            'cancha': 'Cancha multiple',
            'enfermería': 'Enfermeria',
            'enfermeria': 'Enfermeria',
            'creatio': 'Creatio lab',
            'laboratorio': 'Creatio lab',
            'multidiomas': 'Multidiomas',
            'ced': 'CED',
            'salones': 'salones CUL',
            'container': 'Container de comida',
            'gimnasio': 'Gimnasio y salon de baile',
            'baños': 'Baños de hombres central',
            'baño': 'Baños de hombres central'
        };
        
        let foundDestination = null;
        
        for (const [keyword, destination] of Object.entries(destinations)) {
            if (command.includes(keyword)) {
                foundDestination = destination;
                break;
            }
        }
        
        if (foundDestination) {
            voiceGuide.speak(`Navegando hacia ${foundDestination}`);
            startNavigation(foundDestination);
        } else {
            const navigationWords = ['navegar', 'ir', 'dirección', 'llevar', 'rumbo', 'a', 'hacia', 'hasta'];
            const words = command.split(' ');
            const destinationWords = words.filter(word => !navigationWords.includes(word));
            
            if (destinationWords.length > 0) {
                const potentialDestination = destinationWords.join(' ');
                voiceGuide.speak(`Buscando ${potentialDestination}`);
                startNavigation(potentialDestination);
            } else {
                voiceGuide.speak("Por favor, especifique a dónde desea navegar. Por ejemplo: 'Navegar a la biblioteca'");
            }
        }
    },
    
    // Verificar si el texto contiene alguna de las palabras
    containsAny: function(text, words) {
        return words.some(word => text.includes(word));
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
            - Ayuda: Escuchar esta lista de comandos
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

// --- 7. SISTEMA DE UBICACIÓN MANUAL ---
const manualLocationSystem = {
    isActive: false,
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
        
        if (this.containsAny(lowerCommand, ['modo manual', 'ubicación manual', 'establecer ubicación', 'poner ubicación'])) {
            this.toggleManualMode();
            return true;
        }
        else if (this.containsAny(lowerCommand, ['quitar ubicación', 'eliminar ubicación', 'limpiar ubicación'])) {
            this.clearManualLocation();
            return true;
        }
        else if (this.containsAny(lowerCommand, ['desactivar manual', 'salir manual'])) {
            if (this.isActive) {
                this.toggleManualMode();
            }
            return true;
        }
        
        return false;
    },
    
    // Verificar si el texto contiene alguna de las palabras
    containsAny: function(text, words) {
        return words.some(word => text.includes(word));
    }
};

// --- 8. SISTEMA DE MAPAS ACTUALIZADO ---
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
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 20
        }).addTo(this.map);

        this.loadCampusGeoJSON();
        
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
        if (routingSystem.isNearMainRoute(location, 20)) {
            if (Math.random() < 0.1) {
                voiceGuide.speak("Estás en la ruta principal del campus");
            }
        } else if (routingSystem.isNearMainRoute(location, 50)) {
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
                
            voiceGuide.speak(`Destino establecido: ${destinationName}. ${routeInfo} ${appState.currentLocation ? 'Calculando ruta óptima con Dijkstra...' : 'Active el GPS o use el modo manual para establecer su ubicación.'}`);
            
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
            Object.keys(feature.properties)[0].toLowerCase().includes(name.toLowerCase())
        );
    }
};

// --- 9. FUNCIONES DE RENDERIZADO Y ACTUALIZACIÓN ---

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

// --- 10. MANEJO DE EVENTOS ---

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
        const locationName = Object.keys(location.properties)[0];
        mapSystem.setDestination(locationName);
        
        if (!appState.isTracking && appState.settings.useGPS) {
            mapSystem.startGPSTracking();
        }
    } else {
        voiceGuide.speak(`No se encontró ${destination}. Por favor, intenta con otro nombre.`);
    }
}

// --- 11. FUNCIONES DE DEBUGGING ---

/**
 * Función de prueba para verificar que Dijkstra esté funcionando
 */
function testDijkstra() {
    if (!routingSystem.campusGraph) {
        console.log("Grafo no cargado aún");
        return;
    }
    
    const graphInfo = routingSystem.getGraphInfo();
    console.log("Información del grafo:", graphInfo);
    
    const startNode = routingSystem.campusGraph.nodes[0];
    const endNode = routingSystem.campusGraph.nodes[Math.min(30, routingSystem.campusGraph.nodes.length - 1)];
    
    if (startNode && endNode) {
        console.log(`Probando Dijkstra del nodo ${startNode.id} al ${endNode.id}`);
        const path = routingSystem.findPathInGraph(startNode.id, endNode.id);
        console.log("Camino encontrado:", path);
        
        if (path) {
            const distance = routingSystem.calculateRouteDistance(path.map(id => routingSystem.campusGraph.nodes[id].coord));
            console.log(`Distancia total: ${Math.round(distance)} metros`);
        }
    }
}

// --- 12. INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    
    mapSystem.initMap();
    
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
                Puede usar comandos de voz para navegar o establecer su ubicación manualmente.
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

    window.testDijkstra = testDijkstra;
    window.voiceRecognition = voiceRecognition;
    window.manualLocationSystem = manualLocationSystem;

    window.setManualLocation = function(lat, lng) {
        manualLocationSystem.toggleManualMode();
        setTimeout(() => {
            manualLocationSystem.setManualLocation({ lat: lat, lng: lng });
        }, 100);
    };
});

// --- 13. ESTILOS CSS ---
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
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = appStyles;
document.head.appendChild(styleSheet);