import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Link, useNavigate } from 'react-router-dom';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const TERMINALS = {
  "north": ["CR-Fitchburg", "CR-Lowell", "CR-Haverhill", "CR-Newburyport"],
  "sstat": ["CR-Fairmount", "CR-Worcester", "CR-Franklin", "CR-Providence", "CR-Kingston", "CR-Needham", "CR-Greenbush", "CR-NewBedford", "CR-Foxboro"]
};

const LINE_TO_PREFIX_MAP = {
  "CR-Fairmount": ["DB"],
  "CR-NewBedford": ["NBM", "FRS", "MM", "brntn", "qnctr", "jfk"],
  "CR-Fitchburg": ["FR", "portr", "north"],
  "CR-Worcester": ["WML", "bbsta"],
  "CR-Franklin": ["FB", "forhl", "rugg"],
  "CR-Foxboro": ["FS"],
  "CR-Greenbush": ["GRB"],
  "CR-Haverhill": ["WR", "ogmnl", "mlmnl"],
  "CR-Kingston": ["KB", "PB", "brntn", "qnctr", "jfk"],
  "CR-Lowell": ["NHRML"],
  "CR-Needham": ["NB", "forhl", "rugg"],
  "CR-Newburyport": ["GB", "ER", "wondl", "chels"],
  "CR-Providence": ["NEC", "bbsta"],
  "Common-Stations": ["sstat", "north"]
};

const getStationPrefix = (stationId) => {
  if (!stationId) return "";

  // Handle special cases for stations without dashes
  if (!stationId.includes("-")) {
    return stationId;
  }

  const parts = stationId.split("-");
  if (parts.length < 2) return "";

  return parts[1];
};

const decodePolyline = (encoded) => {
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
};

const flattenRouteLines = (routeData) => {
  if (!routeData || typeof routeData !== 'object') return [];

  const flattenedRoutes = [];

  Object.keys(routeData).forEach(routeKey => {
    if (Array.isArray(routeData[routeKey])) {
      flattenedRoutes.push(...routeData[routeKey]);
    }
  });

  return flattenedRoutes;
};

const TripPlannerPage = ({ setDepartures }) => {
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedLineId, setSelectedLineId] = useState('');
  const [startStation, setStartStation] = useState('');
  const [stopStation, setStopStation] = useState('');
  const [isStopStationSelected, setIsStopStationSelected] = useState(false);
  const [stations, setStations] = useState([]);
  const [lines, setLines] = useState([]);
  const massachusettsBounds = [[41.237964, -73.508142], [43.222, -69.928393]];
  const [routeLines, setRouteLines] = useState([]);
  const [stationsForStopDropdown, setStationsForStopDropdown] = useState([]);
  const navigate = useNavigate();
  const stationMap = {
    "North Station": "place-north",
    "South Station": "place-sstat"
};



  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_BASE_URL = 'http://localhost:8081';
        const response = await axios.get(`${API_BASE_URL}/mbtaStops/getAll`);
        if (Array.isArray(response.data)) {
          setStations(response.data);
        } else {
          setStations([]);
        }

        const routesResponse = await axios.get(`${API_BASE_URL}/mbtaShapes/getAll`);
        const flattenedRoutes = flattenRouteLines(routesResponse.data);
        console.log("Route data structure:", flattenedRoutes[0]);
        if (flattenedRoutes.length > 0) {
          setRouteLines(flattenedRoutes);
        } else {
          setRouteLines([]);
        }

        const linesResponse = await axios.get(`${API_BASE_URL}/mbtaLines/getAll`);
        if (Array.isArray(linesResponse.data)) {
          setLines(linesResponse.data);
          console.log("Lines data:", linesResponse.data);
        } else {
          setLines([]);
        }

      } catch (error) {
        console.error('Error fetching stations:', error);
        setStations([]);
        setRouteLines([]);
        setLines([]);
      }


    };

    fetchData();
  }, []);

  useEffect(() => {
  const fetchDepartures = async () => {
    const stopId = stationMap[startStation]
    try {
        const response = await axios.get("http://localhost:8081/mbtaDepartures/getAll", {
          
            params: {origin: stopId, line: selectedLineId}
        });

        if (Array.isArray(response.data)) {
            setDepartures(response.data); // Updates state in App.js
            console.log("Fetched departures:", response.data);
        }
    } catch (error) {
        console.error("Error fetching departures:", error);
    }
};


  if (startStation) {
    console.log(startStation)
    console.log(selectedLineId)
      fetchDepartures();
  }
}, [startStation]);



  useEffect(() => {
    if (!selectedLineId || !startStation) {
      setStationsForStopDropdown([]);
      return;
    }

    const validPrefixes = LINE_TO_PREFIX_MAP[selectedLineId] || [];

    const stationsOnLine = stations.filter(station => {
      if (!station._id) return false;

      const stationIdLower = station._id.toLowerCase();

      if (stationIdLower.includes("north") && TERMINALS["north"].includes(selectedLineId)) return true;
      if (stationIdLower.includes("sstat") && TERMINALS["sstat"].includes(selectedLineId)) return true;

      const prefix = getStationPrefix(station._id);
      return validPrefixes.includes(prefix);
    });

    const filteredForStop = stationsOnLine.filter(station => station.stationName !== startStation);

    setStationsForStopDropdown(filteredForStop);
    setStopStation('');
    setIsStopStationSelected(false);
  }, [selectedLineId, startStation, stations]);

  const handleLineSelection = (e) => {
    const lineName = e.target.value;
    setSelectedLine(lineName);

    setStartStation('');
    setStopStation('');
    setIsStopStationSelected(false);
    setSelectedLineId('');
    setStationsForStopDropdown([]);

    const selectedLineObj = lines.find(line => line.lineName === lineName);
    if (selectedLineObj) {
      const lineId = selectedLineObj._id;
      setSelectedLineId(lineId);

      let determinedStartStationName = '';
      if (TERMINALS.north.includes(lineId)) {
        const northStationObj = stations.find(s => s._id && s._id.toLowerCase().includes('north'));
        if (northStationObj) {
          determinedStartStationName = northStationObj.stationName;
        } else {
          console.error("Could not find North Station data!");
        }
      } else if (TERMINALS.sstat.includes(lineId)) {
        const southStationObj = stations.find(s => s._id && s._id.toLowerCase().includes('sstat'));
        if (southStationObj) {
          determinedStartStationName = southStationObj.stationName;
        } else {
          console.error("Could not find South Station data!");
        }
      } else {
        console.warn(`Line ${lineId} not found in North or South terminal lists.`);
      }
      setStartStation(determinedStartStationName);
    } else {
      console.log("No line object found for name:", lineName);
    }
  };

  const handleStopSelection = (e) => {
    const selectedStop = e.target.value;
    setStopStation(selectedStop);
    checkStopStationSelected(selectedStop); // Check if a stop station is now selected
  };

  const checkStopStationSelected = (start, stop) => {
    setIsStopStationSelected(selectedLine !== '' && startStation !== '' && stop !== '');
  };

  const sortedStationsForStop = [...stationsForStopDropdown].sort((a, b) =>
    a.stationName.localeCompare(b.stationName)
  );

  const sortedLines = [...lines].sort((a, b) =>
    a.lineName.localeCompare(b.lineName)
  );

  const isRouteOnSelectedLine = (route) => {
    // Check if the route matches the selected line ID
    return (
      (route.routeId === selectedLineId) ||
      (selectedLineId && route._id && route._id.includes(selectedLineId))
    );
  };


  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white shadow-md py-4">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold text-center text-gray-800">Trip Planner</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-96 bg-gray-100 p-6 overflow-y-auto shadow-lg">

          {/* Select Line */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2 text-gray-700">Line</h2>
            <div className="relative">
              <select
                value={selectedLine}
                onChange={handleLineSelection}
                className="w-full p-3 border border-gray-300 rounded text-lg appearance-none"
              >
                <option value="">Select a Commuter Rail Line</option>
                {sortedLines.map(line => (
                  <option key={line._id} value={line.lineName}>
                    {line.lineName}
                  </option>
                ))}

              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            {!selectedLine && (
              <p className="text-red-700 mt-2 text-lg">
                Please select a line first
              </p>
            )}
          </div>

          {/* Display Start Station (Replaces Start Dropdown) */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2 text-gray-700">Start Station</h2>
            <div className="w-full p-3 border border-gray-200 bg-gray-200 rounded text-lg text-gray-600 min-h-[50px]">
              {startStation ? startStation : (selectedLine ? 'Determining...' : 'Select line above')}
            </div>
          </div>

          {/* Select Stop */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2 text-gray-700">Destination</h2>
            <div className="relative">
              <select
                value={stopStation}
                onChange={handleStopSelection}
                className="w-full p-3 border border-gray-300 rounded text-lg appearance-none"
                disabled={!selectedLine || !startStation || sortedStationsForStop.length === 0}
              >
                <option value="">
                  {startStation ? 'Select a destination' : 'Select line first'}
                </option>
                {sortedStationsForStop.map(station => (
                  <option key={station._id} value={station.stationName}>
                    {station.stationName}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>

            {selectedLine && startStation && !isStopStationSelected && (
              <p className="text-red-700 mt-2 text-lg">
                Please select a stop station.
              </p>
            )}
          </div>
        </div>

        {/* Right Panel - Map and Station Info */}
        <div className="flex-1 flex flex-col relative">

          {/* Map Section */}
          <div className="flex-1 relative">
            <MapContainer
              center={[42.360082, -71.058880]} // Boston coordinates
              zoom={13}
              minZoom={9}  // 🔽 Set minimum zoom level
              maxZoom={11}  // 🔼 Set maximum zoom level
              maxBounds={massachusettsBounds}
              maxBoundsViscosity={1.0}
              style={{ height: "100%", width: "100%" }}
            >


              <Pane name="unselectedLinesPane" style={{ zIndex: 440 }} />
              <Pane name="inactiveStationMarkersPane" style={{ zIndex: 450 }} />
              <Pane name="selectedLinePane" style={{ zIndex: 500 }} />
              <Pane name="activeStationMarkersPane" style={{ zIndex: 600 }} />

              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CartoDB</a>'
              />


              {/* Render polylines for routes */}
              {routeLines
                .filter(route => route._id && route._id.startsWith('canonical-'))
                .map(route => {
                  const decodedCoordinates = decodePolyline(route.polyline);
                  return (
                    <Polyline
                      key={`${route._id}-unselected`} // Ensure unique key
                      positions={decodedCoordinates}
                      pane="unselectedLinesPane"
                      pathOptions={{
                        color: '#DAB1DA', // Color for unselected lines
                        weight: 2.5,      // Weight for unselected lines
                        opacity: 1,     // Opacity for unselected lines
                        interactive: false
                      }}
                    />
                  );
                })}

              {routeLines
                .filter(route => route._id && route._id.startsWith('canonical-') && isRouteOnSelectedLine(route))
                .map(route => {
                  const decodedCoordinates = decodePolyline(route.polyline);
                  return (
                    <Polyline
                      key={`${route._id}-selected`} // Ensure unique key
                      positions={decodedCoordinates}
                      pane="selectedLinePane"
                      pathOptions={{
                        color: '#80276C', // Color for selected line
                        weight: 5,        // Weight for selected line
                        opacity: 1,     // Opacity for selected line
                        interactive: false
                      }}
                    />
                  );
                })}

              {stations.map(station => {
                if (station.latitude != null && station.longitude != null) {
                  let calculatedIsOnSelectedLine = false;
                  if (selectedLineId && station._id) { const stationIdLower = station._id.toLowerCase(); const isNorthTerminalMatch = stationIdLower.includes("north") && TERMINALS["north"].includes(selectedLineId); const isSouthTerminalMatch = stationIdLower.includes("sstat") && TERMINALS["sstat"].includes(selectedLineId); const stationPrefix = getStationPrefix(station._id); const validPrefixes = LINE_TO_PREFIX_MAP[selectedLineId] || []; const isPrefixMatch = validPrefixes.includes(stationPrefix); calculatedIsOnSelectedLine = isNorthTerminalMatch || isSouthTerminalMatch || isPrefixMatch; }
                  const isStationOnSelectedLine = calculatedIsOnSelectedLine;


                  const isCurrentlyStartStation = station.stationName === startStation;
                  const isCurrentlyStopStation = station.stationName === stopStation;

                  const markerPaneName = (isCurrentlyStartStation || isCurrentlyStopStation || isStationOnSelectedLine)
                    ? "activeStationMarkersPane"
                    : "inactiveStationMarkersPane";

                  let fillColor, strokeColor, opacity, radius, interactive;

                  if (isCurrentlyStopStation) {
                    // Stop station styling
                    fillColor = '#FFFFFF';
                    strokeColor = '#000000';
                    opacity = 1;
                    radius = 7;
                    interactive = true;
                  } else if (isStationOnSelectedLine) {
                    // Station on selected line styling
                    fillColor = '#80276C'; // Purple
                    strokeColor = '#80276C';
                    opacity = 1;
                    radius = 7;
                    interactive = true;
                  } else if (selectedLineId) {
                    // Inactive stations styling (when a line is selected)
                    fillColor = '#DAB1DA';
                    strokeColor = '#DAB1DA';
                    opacity = 1;
                    radius = 2;
                    interactive = false; // Not interactive
                  } else {
                    // Default styling when no line is selected
                    fillColor = '#DAB1DA'; // Default purple
                    strokeColor = '#DAB1DA';
                    opacity = 1;
                    radius = 3;
                    interactive = true;
                  }

                  return (
                    <CircleMarker
                      key={station._id}
                      center={[station.latitude, station.longitude]}
                      radius={radius}
                      pathOptions={{
                        pane: markerPaneName,
                        fillColor: fillColor,
                        color: strokeColor,
                        fillOpacity: opacity,
                        opacity: opacity,
                      }}
                      eventHandlers={{
                        click: (e) => {
                          // Prevent click events for inactive stations
                          if (!interactive) {
                            e.originalEvent.stopPropagation();
                            e.originalEvent.preventDefault();
                          }
                        }
                      }}
                    >
                      {interactive && (
                        <Popup>
                          <div style={{ width: '200px' }}>
                            <h3 className="font-bold text-lg mb-1">{station.stationName}</h3>
                            {/* Add this image block */}
                            {station.imageUrl && (
                              <img
                                src={station.imageUrl}
                                alt={station.stationName}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  marginBottom: '0.5rem',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                }}
                              />
                            )}
                          </div>
                        </Popup>
                      )}
                    </CircleMarker>
                  );
                } else {
                  return null;
                }
              })}

            </MapContainer>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-gray-200 p-4 flex justify-end">
        <Link to="/tripSummaryPage">
          <button
            className="bg-gray-700 hover:bg-gray-900 text-white font-bold py-2 px-8 rounded text-xl"
            disabled={!isStopStationSelected}
          >
            Next
          </button>
        </Link>
      </div>
    </div>
  );
};

export default TripPlannerPage;