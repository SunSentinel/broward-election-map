// Initialize Map
const map = L.map('map', { zoomControl: false }).setView([26.1224, -80.2800], 10); 

// Add zoom control to top right
L.control.zoom({ position: 'topright' }).addTo(map);

// Add Carto basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2cv5_1_a7200e47d8bf0ea75d99f6fc', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

let geojsonLayer;
let currentMetric = 'Senate_Margin_Pct';
let electionData = {};

// Candidate Data Dictionary
const candidates = {
    'Senate_Margin_Pct': { 
        rep: 'Ashley Moody<br>(REP)', dem: 'Angie Nixon<br>(DEM)',
        repFull: 'Ashley Moody', demFull: 'Angie Nixon',
        repPctCol: 'Senate_Rep_Pct', demPctCol: 'Senate_Dem_Pct'
    },
    'Gov_Margin_Pct': { 
        rep: 'Byron Donalds<br>(REP)', dem: 'David Jolly<br>(DEM)',
        repFull: 'Byron Donalds', demFull: 'David Jolly',
        repPctCol: 'Gov_Donalds_Pct', demPctCol: 'Gov_Jolly_Pct'
    }
};

// 6-Bin Color Scale
function getColor(d) {
    if (d === undefined || d === null) return 'transparent';
    return d > 15  ? '#b2182b' :  
           d > 0   ? '#ef8a62' :  
           d > -15 ? '#92c5de' :   
           d > -30 ? '#4393c3' :   
           d > -45 ? '#2166ac' :   
                     '#053061';    
}

// Draw the two-column legend
function updateLegend() {
    let repName = candidates[currentMetric].rep;
    let demName = candidates[currentMetric].dem;
    
    let legendHTML = `
        <div style="margin-top: 15px; font-weight: bold; font-size: 13px; color: #333; border-top: 1px solid #ddd; padding-top: 12px;">Margin of victory</div>
        <div class="legend-columns" style="margin-top: 10px;">
            <div class="legend-col">
                <div class="legend-title rep-title">${repName}</div>
                <div><span style="background:#b2182b"></span> &gt; 15%</div>
                <div><span style="background:#ef8a62"></span> 0 to 15%</div>
            </div>
            <div class="legend-col">
                <div class="legend-title dem-title">${demName}</div>
                <div><span style="background:#92c5de"></span> 0 to 15%</div>
                <div><span style="background:#4393c3"></span> 15 to 30%</div>
                <div><span style="background:#2166ac"></span> 30 to 45%</div>
                <div><span style="background:#053061"></span> &gt; 45%</div>
            </div>
        </div>
    `;
    document.getElementById('legend-content').innerHTML = legendHTML;
}

// DataWrapper-style Tooltip Generator
function generateTooltipHTML(displayCity, data, metric) {
    if (!data || data[metric] === undefined || data[metric] === null) {
        return `<span style="font-size: 15px; line-height: 1.6;">
                  <span style="display: block; font-size: 20px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px;">
                    ${displayCity}
                  </span>
                  No election data mapped for this city.
                </span>`;
    }

    let margin = data[metric];
    let repName = candidates[metric].repFull;
    let demName = candidates[metric].demFull;
    
    let repPct = data[candidates[metric].repPctCol];
    let demPct = data[candidates[metric].demPctCol];

    // Determine winner for the top line
    let winnerName = margin > 0 ? repName : (margin < 0 ? demName : "Tie");
    let winnerColor = margin > 0 ? '#d73027' : (margin < 0 ? '#4575b4' : '#333');
    
    // Checkmarks spacing hack (&ensp; keeps the names aligned if there is no checkmark)
    let repCheck = margin > 0 ? '✔' : '&ensp;';
    let demCheck = margin < 0 ? '✔' : '&ensp;';

    // Formatted strings
    let winText = margin === 0 ? 
        `The race was an exact <b>tie</b>.` : 
        `<b style="color: ${winnerColor};">${winnerName}</b> won by ${Math.abs(margin).toFixed(1)} percentage points.`;

    let repString = repPct !== null ? `${repPct.toFixed(1)}%` : 'N/A';
    let demString = demPct !== null ? `${demPct.toFixed(1)}%` : 'N/A';

    return `
    <span style="font-size: 15px; line-height: 1.6;">
        <span style="display: block; font-size: 20px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px;">
            ${displayCity}
        </span>
        ${winText}
        <br><br>
        <span style="color: #d73027; font-weight: bold; font-size: 16px;">${repCheck}</span> <b>${repName}:</b> ${repString}
        <br>
        <span style="color: #4575b4; font-weight: bold; font-size: 16px;">${demCheck}</span> <b>${demName}:</b> ${demString}
    </span>
    `;
}

function normalizeCityName(name) {
    if (!name) return "";
    let cleanName = name.trim().toUpperCase();
    if (cleanName === 'FT LAUDERDALE' || cleanName === 'FORT LAUDERDALE') return 'FORT LAUDERDALE';
    if (cleanName.includes('LAUD') && cleanName.includes('SEA')) return 'LAUDERDALE-BY-THE-SEA';
    if (cleanName === 'WILTON MANORS/ LAZY LAKE' || cleanName === 'WILTON MANORS') return 'WILTON MANORS';
    return cleanName;
}

function getDisplayCityName(rawName) {
    let cleanName = rawName.toUpperCase().trim();
    if (cleanName.includes('LAUD') && cleanName.includes('SEA')) return 'Lauderdale-by-the-Sea'; 
    if (cleanName === 'FT LAUDERDALE' || cleanName === 'FORT LAUDERDALE') return 'Fort Lauderdale';
    if (cleanName === 'WILTON MANORS/ LAZY LAKE' || cleanName === 'WILTON MANORS') return 'Wilton Manors';
    return rawName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.substring(1)).join(' ');
}

function style(feature) {
    let geojsonCity = feature.properties.CITYNAME || "Unknown";
    let matchName = normalizeCityName(geojsonCity);
    let margin = electionData[matchName] ? electionData[matchName][currentMetric] : null;
    
    return {
        fillColor: getColor(margin),
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85
    };
}

Promise.all([
    fetch('broward-cities.geojson').then(r => r.json()),
    fetch('City_Aggregated_Map_Data_with_Pcts.csv').then(r => r.text()) 
]).then(([geojsonData, csvText]) => {
    
    updateLegend();

    Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            
            results.data.forEach(row => {
                if(row.City) {
                    let matchName = normalizeCityName(row.City);
                    electionData[matchName] = row; 
                }
            });

            geojsonLayer = L.geoJson(geojsonData, {
                filter: function(feature) {
                    let rawName = feature.properties.CITYNAME || "Unknown";
                    if (rawName.toUpperCase().trim() === 'BMSD' || rawName.toUpperCase().trim() === 'BDSM') return false; 
                    let matchName = normalizeCityName(rawName);
                    return electionData[matchName] !== undefined;
                },
                style: style,
                onEachFeature: function (feature, layer) {
                    let rawName = feature.properties.CITYNAME || "Unknown";
                    let matchName = normalizeCityName(rawName);
                    let data = electionData[matchName];
                    let displayCity = getDisplayCityName(rawName);

                    let tooltipContent = generateTooltipHTML(displayCity, data, currentMetric);
                    layer.bindTooltip(tooltipContent);
                    
                    layer.on({
                        mouseover: function(e) {
                            var target = e.target;
                            target.setStyle({ weight: 3, color: '#333' });
                            target.bringToFront();
                        },
                        mouseout: function(e) {
                            geojsonLayer.resetStyle(e.target);
                        }
                    });
                }
            }).addTo(map);
        }
    });
}).catch(error => console.error("Error loading map data:", error));

document.getElementById('toggle-senate').addEventListener('click', function() {
    currentMetric = 'Senate_Margin_Pct';
    this.classList.add('active');
    document.getElementById('toggle-gov').classList.remove('active');
    
    updateLegend();
    updateMap();
});

document.getElementById('toggle-gov').addEventListener('click', function() {
    currentMetric = 'Gov_Margin_Pct';
    this.classList.add('active');
    document.getElementById('toggle-senate').classList.remove('active');
    
    updateLegend();
    updateMap();
});

function updateMap() {
    if (!geojsonLayer) return;
    
    geojsonLayer.eachLayer(function (layer) {
        layer.setStyle(style(layer.feature));
        
        let rawName = layer.feature.properties.CITYNAME || "Unknown";
        let matchName = normalizeCityName(rawName);
        let data = electionData[matchName];
        let displayCity = getDisplayCityName(rawName);
        
        if (data) {
            let tooltipContent = generateTooltipHTML(displayCity, data, currentMetric);
            layer.setTooltipContent(tooltipContent);
        }
    });
}