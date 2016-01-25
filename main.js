/*jslint browser: true*/
/*global Tangram, gui */

map = (function () {
    'use strict';

    /*** URL parsing ***/

    // convert tile coordinates to lat-lng
    // from http://gis.stackexchange.com/questions/17278/calculate-lat-lon-bounds-for-individual-tile-generated-from-gdal2tiles
    function tile2long(x,z) { return (x/Math.pow(2,z)*360-180); }
    function tile2lat(y,z) {
        var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
        return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
    }

    // leaflet-style URL hash pattern:
    // #[zoom],[lat],[lng]
    var map_start_location = [37.7926, -122.4003, 15]; // San Francisco
    var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');

    if (url_hash.length == 3) {
        if (url_hash[1] > 180) { // parse hash as tile coordinates
            // example: http://localhost:9001/#15/5242/12663
            // add .5 to coords to center tile on screen
            map_start_location = [tile2lat(parseFloat(url_hash[2]) + .5, url_hash[0]), tile2long(parseFloat(url_hash[1]) + .5, url_hash[0]), url_hash[0]];
        }
        else { // parse hash as lat/lng coordinates
            map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        }
        // convert from strings
        map_start_location = map_start_location.map(Number);
    }

    /*** Map ***/

    var map = L.map('map',
        { maxZoom: 20 }
    );
        
    var layer = Tangram.leafletLayer({
        scene: 'eraser-map.yaml',
        attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    // setView expects format ([lat, long], zoom)
    map.setView(map_start_location.slice(0, 3), map_start_location[2]);

    var hash = new L.Hash(map);
    
	function long2tile(lon,zoom) { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }
	function lat2tile(lat,zoom)  { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }    

    /***** Render loop *****/
	
	function addGUI () {
		// Link to edit in OSM - hold 'e' and click
		function onMapClick(e) {
			if (key.shift) {
				var url = 'https://www.openstreetmap.org/edit?';

				if (scene.selection.feature && scene.selection.feature.id) {
					url += 'way=' + scene.selection.feature.id;
				}

				if (scene.center) {
					url += '#map=' + scene.baseZoom(scene.zoom) + '/' + scene.center.lat + '/' + scene.center.lng;
				}

				window.open(url, '_blank');
			}

 			if (key.command) {
				var url = 'http://vector.mapzen.com/osm/all/' + scene.tile_zoom + '/' + long2tile(e.latlng.lng,scene.tile_zoom)  + '/' + lat2tile(e.latlng.lat,scene.tile_zoom) + '.topojson?api_key=vector-tiles-HqUVidw';
				window.open(url, '_blank');
				//console.log( e );
			}
		}

		map.on('click', onMapClick);		
	}

	
     // Feature selection
    function initFeatureSelection () {
        // Selection info shown on hover
        var selection_info = document.createElement('div');
        selection_info.setAttribute('class', 'label');
        selection_info.style.display = 'block';

        // Show selected feature on hover
        map.getContainer().addEventListener('mousemove', function (event) {
            var pixel = { x: event.clientX, y: event.clientY };

            scene.getFeatureAt(pixel).then(function(selection) {
                if (!selection) {
                    return;
                }
                var feature = selection.feature;
                if (feature != null) {
                    // console.log("selection map: " + JSON.stringify(feature));

                    var label = '';
                    if (feature.properties.name != null) {
                        label = feature.properties.name;
                    }

                    if (label != '') {
                        selection_info.style.left = (pixel.x + 5) + 'px';
                        selection_info.style.top = (pixel.y + 15) + 'px';
                        selection_info.innerHTML = '<span class="labelInner">' + label + '</span>';
                        map.getContainer().appendChild(selection_info);
                    }
                    else if (selection_info.parentNode != null) {
                        selection_info.parentNode.removeChild(selection_info);
                    }
                }
                else if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            });

            // Don't show labels while panning
            if (scene.panning == true) {
                if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            }
        });
        
        // Show selected feature on hover
        map.getContainer().addEventListener('click', function (event) {
            var pixel = { x: event.clientX, y: event.clientY };

			scene.getFeatureAt(pixel).then(function(selection) {    
				if (!selection) {
					return;
				}
				var feature = selection.feature;
				if (feature != null) {
					// console.log("selection map: " + JSON.stringify(feature));

					var label = '';
					if (feature.properties != null) {
						// console.log(feature.properties);
						var obj = JSON.parse(JSON.stringify(feature.properties));
						for (var x in feature.properties) {
							var val = feature.properties[x]
							label += "<span class='labelLine' key="+x+" value="+val+" onclick='setValuesFromSpan(this)'>"+x+" : "+val+"</span><br>"
						}
					}

					if (label != '') {
						selection_info.style.left = (pixel.x + 5) + 'px';
						selection_info.style.top = (pixel.y + 15) + 'px';
						selection_info.innerHTML = '<span class="labelInner">' + label + '</span>';
						map.getContainer().appendChild(selection_info);
					}
					else if (selection_info.parentNode != null) {
						selection_info.parentNode.removeChild(selection_info);
					}
				}
				else if (selection_info.parentNode != null) {
					selection_info.parentNode.removeChild(selection_info);
				}
			});
			
            // Don't show labels while panning
            if (scene.panning == true) {
                if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            }
        });
        
    }

    window.addEventListener('load', function () {
        // Scene initialized
        layer.on('init', function() {
	        addGUI();
        	initFeatureSelection();
        });
        layer.addTo(map);
    });
    
    return map;

}());
