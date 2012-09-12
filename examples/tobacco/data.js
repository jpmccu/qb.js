rdf_type = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
CHSI = 'http://logd.tw.rpi.edu/source/data-gov/dataset/2159/vocab/enhancement/1/';
DATACUBE = 'http://logd.tw.rpi.edu/source/data-gov/datacube/';
RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
RO = 'http://www.obofoundry.org/ro/ro.owl#';
SCALE = 'http://bmkeg.isi.edu/ooevv/edu.isi.bmkeg.ooevv.model.scale.';
SIO = "http://semanticscience.org/resource/";
PROV = "http://www.w3.org/ns/prov#";
DC = "http://purl.org/dc/terms/";
VOID = "http://rdfs.org/ns/void#";
rdfs_label = RDFS+'label';

Array.prototype.contains = function(obj) {
    return this.indexOf(obj) > -1;
};

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

function sort_by(field, reverse, primer){
   
   function key(x) {
       if (field == null) return primer ? primer(x) : x;
       else return primer ? primer(x[field]) : x[field];
   };

   return function (a,b) {
       var A = key(a), B = key(b);
       return (A < B ? -1 : (A > B ? 1 : 0)) * [1,-1][+!!reverse];                  
   }
}

function unique(x) {
    var sorted = x.filter(function(d) {return d != null}).sort(sort_by(null,false,null));
    //console.log(sorted);
    var result = [];
    var last = null;
    for (var i=0;i<sorted.length;i++) {
        if (i == 0 || sorted[i] != last) {
            result.push(sorted[i]);
        }
        last = sorted[i];
    }
    return result;
}

String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        var regexp = new RegExp('\\{'+i+'\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};

var attrModifiedWorks = false;
var listener = function(){ attrModifiedWorks = true; };
document.documentElement.addEventListener("DOMAttrModified", listener, false);
document.documentElement.setAttribute("___TEST___", true);
document.documentElement.removeAttribute("___TEST___", true);
document.documentElement.removeEventListener("DOMAttrModified", listener, false);

if (!attrModifiedWorks) {
    HTMLElement.prototype.__setAttribute = HTMLElement.prototype.setAttribute
    HTMLElement.prototype.setAttribute = function(attrName, newVal) {
        var prevVal = this.getAttribute(attrName);
        this.__setAttribute(attrName, newVal);
        newVal = this.getAttribute(attrName);
        if (newVal != prevVal) {
            var evt = document.createEvent("MutationEvent");
            evt.initMutationEvent(
                "DOMAttrModified",
                true,
                false,
                this,
                prevVal || "",
                newVal || "",
                attrName,
                (prevVal == null) ? evt.ADDITION : evt.MODIFICATION
            );
            this.dispatchEvent(evt);
        }
    }
}

var shortcuts = {
    "label":RDFS+"label",
    "type":RDF+"type",
    "partOf":DC+"partOf",
    "hasPart":DC+"hasPart"
};

function Graph() {
    //this.endpoint = endpoint;
}
Graph.prototype.getResource = function(uri) {
    var result = this[uri];
    if (result == null) {
        result = {uri: uri};
        this[uri] = result;
    }
    return result;
};
Graph.prototype.byClass = function(c) {
    var graph = this;
    return d3.keys(graph).filter(function(k) {
        if (k == "getResource"|| k=="byClass") return false;
        var d = graph[k];
        if (d[rdf_type] == null) return false;
        return d[rdf_type].some(function(element) {
            return element.uri == c;
        });
    }).map(function(k) {
        return graph[k];
    });
};
Graph.prototype.add = function(data) {
    var result = {}
    var graph = this;
    d3.keys(data).forEach(function(uri) {
        var subject = graph.getResource(uri);
        result[uri] = subject;
        d3.keys(data[uri]).forEach(function(predicate) {
            subject[predicate] = data[uri][predicate].map(function(obj) {
                if (obj.type == "literal") {
                    return obj.value;
                } else {
                    return graph.getResource(obj.value);
                }
            })
        })
        d3.keys(shortcuts).forEach(function(shortcut) {
            subject[shortcut] = subject[shortcuts[shortcut]];
        });
    });
    return result;
};
Graph.prototype.addVIE = function(entities) {
    var graph = this;
    entities.forEach(function (e) {
	var subject = graph.getResource(e["@subject"]);
	d3.keys(e.attributes).forEach(function(predicate) {
	    if (predicate == "__proto__") return;
	    if (predicate == "@subject") return;
	    if (predicate == "@type") {
		subject[RDF+"type"] = [graph.getResource(e.get("@type").toString())];
	    } else {
		var objects = [];
		//console.log(predicate);
		//console.log(e.get(predicate));
		e.get(predicate).forEach(function(v) {
		    //console.log(v);
     		    if (v['@subject'] != null) {
			objects.push(graph.getResource(v.getSubject()));
     		    } else objects.push(v);
     		});
		subject[predicate] = objects;
	    }
	});
        d3.keys(shortcuts).forEach(function(shortcut) {
	    subject[shortcut] = subject[shortcuts[shortcut]];
        });
    });
};
Graph.prototype.sparqlConstruct = function(query,endpoint, callback) {
    var encodedQuery = encodeURIComponent(query);
    var url = endpoint+"?query="+encodedQuery+"&output=rdfjson";
    //console.log(url);
    d3.json(url, callback);
}

Graph.prototype.sparqlSelect = function(query, endpoint, callback) {
    var encodedQuery = encodeURIComponent(query);
    var url = endpoint+"?query="+encodedQuery+"&output=sparqljson";
    d3.json(url, callback);
}

var dces = [];

$(document).ready(function() {
    v = new VIE();
    v.use(new v.RdfaService());
    
    var entities = null
    v.load({element: jQuery('body')}).from('rdfa').execute().success(function(ents) {
	entities = ents.map(function(entity) {
	    return entity;
	});
	entities.forEach(function(entity) {
	    if (entity.isof("http://semanticscience.org/resource/statistical-graph")) {
		dces.push(new DataCubeExplorer(entity, entities));
	    }
	})
    });
});

function DataCubeExplorer(e,entities) {
    this.graph = new Graph();
    //console.log(entities);
    //console.log(e.toJSONLD());
    //this.graph.add(e.toJSONLD());
    this.graph.addVIE(entities);
    this.entity = this.graph.getResource(e.getSubject());
    //console.log(this.entity.uri);
    this.element = d3.select(e.getSubject());
    this.state = this.element.select("span#config");
    this.addSkeleton();
    this.years = [];
    this.maxYear = -1;
    this.xMeasures = [];
    this.yMeasures = [];
    this.load();
}

DataCubeExplorer.prototype.addSkeleton = function() {
    var tr = this.element.append("table").append("tr");
    var measures = tr.append("td")
	.style("width","300px")
	.style("vertical-align","top");
    measures.append("h2").text("Measures");
    this.picker = measures.append("form").append("div");
    var contentBody = tr.append("td").style("vertical-align","top");
    //contentBody.append("p").text("Select two or more measures.");
    this.chart = contentBody.append("span");
    this.yearSlider = contentBody.append("div");
}

DataCubeExplorer.prototype.load = function() {
    this.loadCategories();
    this.loadYears();
}

DataCubeExplorer.prototype.loadCategories = function() {
    query = "PREFIX datacube: <http://logd.tw.rpi.edu/source/data-gov/datacube/>\
PREFIX dcterms: <http://purl.org/dc/terms/>\
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
construct {\
    ?category a datacube:Category;\
              rdfs:label ?label;\
              dcterms:partOf <{0}>.\
} where {\
    graph <{0}> {\
        ?category a datacube:Category;\
                  dcterms:identifier ?label.\
    }\
}";
    var dce = this;
    var datasets = this.entity[PROV+"wasDerivedFrom"];
    //console.log(datasets);
    //console.log(this.entity);
    datasets.forEach(function(dataset) {
	var endpoint = dataset[VOID+"sparqlEndpoint"][0].uri;
        dce.graph.sparqlConstruct(query.format(dataset.uri),endpoint,function(json) {
	    dce.graph.add(json);
	    var categories = dce.graph.byClass(DATACUBE+'Category');
	    dce.makePicker(categories);
        });
    });
}
DataCubeExplorer.prototype.getMeasures = function(category, callback) {
    query = "PREFIX ro:      <http://www.obofoundry.org/ro/ro.owl#> \
PREFIX dcterms: <http://purl.org/dc/terms/> \
PREFIX datacube: <http://logd.tw.rpi.edu/source/data-gov/datacube/> \
PREFIX qb: <http://purl.org/linked-data/cube#> \
construct { \
  ?measure dcterms:partOf <{0}>; \
           rdfs:label ?label; \
           a ?type. \
  <{0}> dcterms:hasPart ?measure. \
} where { \
  ?measure ro:part_of <{0}>; \
           a datacube:Measure; \
           rdfs:label ?label; \
           a ?type. \
  [ qb:measureType ?measure; \
    a datacube:SingularValue] \
}";
    var dce = this;
    var endpoint = category.partOf[0][VOID+"sparqlEndpoint"][0].uri;
    this.graph.sparqlConstruct(query.format(category.uri),endpoint,function(json) {
        dce.graph.add(json);
        dce.updateMeasures(category);
    });
}

DataCubeExplorer.prototype.loadYears = function() {
    query = "PREFIX datacube: <http://logd.tw.rpi.edu/source/data-gov/datacube/> \
PREFIX prov: <http://www.w3.org/ns/prov-o/> \
select distinct ?year \
WHERE { \
  GRAPH <{0}> { \
    [ a datacube:SingularValue; prov:startedAt ?year] \
  } \
} ORDER BY ?year";
    var dce = this;
    this.entity[PROV+"wasDerivedFrom"].forEach(function(dataset) {
	var endpoint = dataset[VOID+"sparqlEndpoint"][0].uri;
	//console.log(endpoint);
	dce.graph.sparqlSelect(query.format(dataset.uri),endpoint, function(json) {
            json.results.bindings.forEach(function(row) {
		if (!dce.years.contains(row.year.value)) dce.years.push(row.year.value);
            });
            dce.makeSlider();
	});
    });
}

DataCubeExplorer.prototype.getData = function(measures, callback) {
    var sparqlQuery = 'PREFIX datacube: <http://logd.tw.rpi.edu/source/data-gov/datacube/>\
PREFIX qb: <http://purl.org/linked-data/cube#> \
PREFIX prov: <http://www.w3.org/ns/prov-o/> \
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \
PREFIX frbr: <http://purl.org/vocab/frbr/core#> \
\
select distinct ?datum ?loc ?value ?year ?nextYear WHERE { \
    ?datum qb:measureType <{0}>; \
           prov:location ?loc; \
           prov:startedAt ?year; \
           rdf:value ?value. \
    OPTIONAL { \
        ?next frbr:successorOf ?datum; \
                 prov:startedAt ?nextYear. \
    } \
}';

    var dce = this;
    measures.forEach(function(measure) {
	var endpoint = measure.partOf[0].partOf[0][VOID+"sparqlEndpoint"][0].uri;

        dce.graph.sparqlSelect(sparqlQuery.format(measure.uri),endpoint,function(json) {
            json.results.bindings.forEach(function(entry) {
                value = parseFloat(entry.value.value);
                if (value < 0) {
                    return;
                }
                var loc = dce.graph.getResource(entry.loc.value);
                if (loc[measure.uri] == null) {
                    loc[measure.uri] = {};
                }
                var startYear = entry.year.value;
                var nextYear = dce.maxYear;
                if (entry.nextYear != null && entry.nextYear.value != null)
                    nextYear = entry.nextYear.value - 1;
                for (var i=startYear; i <= nextYear; i++)
                    loc[measure.uri][i] = value;
                if (measure.data == null) {
                    measure.data = [];
                }
                measure.data[loc.uri] = loc;
            });
            callback();
        });
    });
}

DataCubeExplorer.prototype.getYear = function() {
    return this.currentYear;
}

$.fn.extend({
    sliderLabels: function(left,right) {
        var $this = $(this); 
        var $sliderdiv= $this.next("div.ui-slider");
        $sliderdiv
        .css({'font-weight': 'normal'}); 
        $sliderdiv
		.prepend('<span class="ui-slider-inner-label"  style="position: absolute; left:0px; top:20px;">'+left+ '</span>')
        .append('<span class="ui-slider-inner-label" style="position: absolute; right:0px; top:20px;">'+right+ '</span>');         
    }
});

DataCubeExplorer.prototype.makeSlider = function() {
    //console.log(this.years);
    var years = this.years.map(function(d) {
	return parseInt(d);
    });
    this.maxYear = d3.max(years);
    this.minYear = d3.min(years);
    this.currentYear = this.maxYear;
    //console.log(this.maxYear);
    var dce = this;
    $(this.yearSlider[0]).slider({
	animate: true,
	max: this.maxYear,
	min: this.minYear,
	value: this.currentYear,
        slide: function(event, ui) {
	    dce.currentYear = ui.value;
            var xChecked = $(dce.picker[0]).find("input.xPick:checked");
            var xMeasures = $.makeArray(xChecked.map(function() {
                return this.__data__;
            }));
            var yChecked = $(dce.picker[0]).find("input.yPick:checked");
            var yMeasures = $.makeArray(yChecked.map(function() {
                return this.__data__;
            }));
	    console.log(xMeasures);
	    console.log(yMeasures);
	    console.log(dce.getYear());
            dce.makeScatterPlotMatrix(xMeasures, yMeasures, dce.getYear());
            var delay = function() {
		$(dce.yearSlider[0]).parent().find("span.location")
		    .html($(dce.yearSlider[0]).slider('value')).position({
			my: 'center top',
			at: 'center bottom',
			of: $(dce.yearSlider[0]).find('a'),
			offset: "0, -40"
		});
            };
            
            // wait for the ui.handle to set its position
            setTimeout(delay, 50);
	},
    });
    $(this.yearSlider[0]).prepend('<span class="ui-slider-inner-label"  style="position: absolute; left:0px; top:20px;">'+this.minYear+ '</span>')
        .append('<span class="ui-slider-inner-label" style="position: absolute; right:0px; top:20px;">'+this.maxYear+ '</span>')
	.append('<span class="location ui-slider-inner-label" style="text-align: center; width: 50px"</span>');
    $(this.yearSlider[0]).parent().find("span.location")
	.html($(this.yearSlider[0]).slider('value')).position({
	    my: 'center top',
	    at: 'center bottom',
	    of: $(this.yearSlider[0]).find('a'),
	    offset: "0, -40"
	});
}

DataCubeExplorer.prototype.getLocations = function(measures) {
    locs = {};
    measures.forEach(function(measure) {
        d3.keys(measure.data).forEach(function(uri) {
            locs[uri] = measure.data[uri];
        });
    });
    return locs;
}

DataCubeExplorer.prototype.updateMeasures = function(category) {
    category.measures = category.hasPart;
    var panel = this.picker.select("#"+category.panelID);
    panel = panel.append("table");
    var header = panel.append("tr");
    header.append("th").text("X");
    header.append("th").text("Y");
    header.append("th").text("Measure");
    var tbody = panel.append("tbody");
    var dce = this;
    var measures = tbody.selectAll("tr").data(category.measures)
        .enter().append("tr");
    function selectionChanged(d) {
	var element = this;
	console.log(this);
	console.log(this.checked);
	console.log(d3.select(this).attr("class"));
        fn = function() {
	    //var modList = yMeasures;
	    //if (this.attr("class") == 'xPick') modList = xMeasures;
	    //if (element.checked) modList.push(d);
	    //else modList.remove(modList.indexOf(d));
            var xChecked = $(dce.picker[0]).find("input.xPick:checked");
            var xMeasures = $.makeArray(xChecked.map(function() {
                return this.__data__;
            }));
            var yChecked = $(dce.picker[0]).find("input.yPick:checked");
            var yMeasures = $.makeArray(yChecked.map(function() {
                return this.__data__;
            }));
            dce.makeScatterPlotMatrix(xMeasures, yMeasures, dce.getYear());
        }
        if (d.data == null) {
            dce.getData([d], fn);
        } else {
            fn();
        }
    }
    measures.append("td").attr("align","center")
        .append("input").attr("type","checkbox").attr("class","xPick")
        .on("click",selectionChanged);
    measures.append("td").attr("align","center")
        .append("input").attr("type","checkbox").attr("class","yPick")
        .on("click",selectionChanged);
    measures.append("td")
        .text(function(d) {
            return d[RDFS+"label"][0];
        });
}

DataCubeExplorer.prototype.makePicker = function(categories) {
    var picker = this.picker;
    var panels = picker.selectAll("span").data(categories).enter().append("div");
    var dce = this;
    panels.append("h3")
        .text(function(d) {
            return d.label[0];
        });
    panels.append("div")
        .attr("id",function(d) {
            d.panelID =  d.label[0].replace(/[ \/\(\)]/g,"_");
            return d.panelID;
        })
    $(picker[0])
        .addClass("ui-accordion ui-accordion-icons ui-widget ui-helper-reset")
        .find("div")
        .find("h3")
        .addClass("ui-accordion-header ui-helper-reset ui-state-default ui-corner-top ui-corner-bottom")
        .hover(function() { $(this).toggleClass("ui-state-hover"); })
        .prepend('<span class="ui-icon ui-icon-triangle-1-e"></span>')
        .click(function() {
            //console.log(this.__data__);
            var category = this.__data__;
            if (category.measures == null) {
                category.measures = dce.getMeasures(category);
            }
            $(this)
                .toggleClass("ui-accordion-header-active ui-state-active ui-state-default ui-corner-bottom")
                .find("> .ui-icon").toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s").end()
                .next().toggleClass("ui-accordion-content-active").slideToggle();
            return false;
        })
        .next()
        .addClass("ui-accordion-content  ui-helper-reset ui-widget-content ui-corner-bottom")
        .hide();

}

DataCubeExplorer.prototype.makeScatterPlotMatrix = function(xMeasures, yMeasures, year) {
    // Size parameters.
    var size = 150.0,
    padding = 20.0,
    n = xMeasures.length;
    m = yMeasures.length;
    var measures = xMeasures.concat(yMeasures);
    
    var numericMeasures = this.graph.byClass(SCALE+'NumericScale');
    //console.log(numericMeasures);

    var locs = d3.values(this.getLocations(measures, year));
    // Position scales.
    var x = {}, y = {};
    var measureVals = {};
    var measureLocs = {};
    measures.forEach(function(measure) {
        var value = function(d) { 
            if (d[measure.uri] == null) {
                return null;
            }
            return d[measure.uri][year]; 
        },
        domain = [d3.min(locs, value), d3.max(locs, value)],
        range = [padding / 2, size - padding / 2];
        //console.log(domain);
        //console.log(range);
        if (numericMeasures.contains(measure)) {
            x[measure.uri] = d3.scale.linear().domain(domain).range(range);
            y[measure.uri] = d3.scale.linear().domain(domain).range(range.slice().reverse());
        } else {
            var measureVal = measureVals[measure.uri] = unique(locs.map(value));
            y[measure.uri] = d3.scale.ordinal()
                .domain(measureVal)
                .range(range.slice().reverse());
            x[measure.uri] = d3.scale.ordinal()
                .domain(measureVal)
                .range(range);
            //console.log(measureVal);
            measureLocs[measure.uri] = measureVals[measure.uri].map(function(val) {
                return locs.filter(function (loc) {
                    return val == value(loc);
                });
            });
        }
    });
    
    
    // Brush.
    var brush = d3.svg.brush()
        .on("brushstart", brushstart)
        .on("brush", brush)
        .on("brushend", brushend);

    this.chart.selectAll("svg").remove();

    // Root panel.
    var svg = this.chart.append("svg")
        .attr("width", size * (n + 1.5) + padding+20)
        .attr("height", size * (m + 1) + padding+20);
    
    // X-axis.
    svg.selectAll("g.x.axis")
        .data(xMeasures)
        .enter().append("g")
        .attr("class", "x axis")
        .style("stroke-width",1)
        .attr("transform", function(d, i) {
            return "translate(" + (i+1.5) * size + ",0)";
        })
        .each(function(d,i) { 
            // Axes.
            if (numericMeasures.contains(d)) {
                var axis = d3.svg.axis()
                    .ticks(5)
                    .tickSize(size * (m));
                d3.select(this).call(axis.scale(x[d.uri]).orient("bottom")); 
            } else {
                var vals = measureVals[d.uri];
                var labels = d3.select(this).append("g").selectAll("text")
                    .data(vals)
                    .enter()
                    .append("text")
                    .text(String)
                    .attr("text-anchor", "middle")
                    .attr("y", m*size + padding/2)
                    .attr("x",function(d,i) {
                        var cellSize = (size-padding)/vals.length;
                        return (padding/2 + (i+0.5) * cellSize);
                    });
            }
        });
    
    // Y-axis.
    svg.selectAll("g.y.axis")
        .data(yMeasures)
        .enter().append("g")
        .attr("class", "y axis")
        .style("stroke-width",1)
        .attr("transform",function(d, i) { return "translate("+((n+1.5)*size+padding/4)+"," + i * size + ")"; })
        .each(function(d, i) {
            // Axes.
            if (numericMeasures.contains(d)) {
                var axis = d3.svg.axis()
                    .ticks(5)
                    .tickSize(size * n);
                d3.select(this).call(axis.scale(y[d.uri]).orient("left")); 
            } else {
                var vals = measureVals[d.uri];
                var labels = d3.select(this).append("g").selectAll("text")
                    .data(vals)
                    .enter()
                    .append("text")
                    .text(String)
                    .style('dominant-baseline',"middle")
                    .attr("x", -((n)*size + padding/2))
                    .attr("y",function(d,i) {
                        var cellSize = (size-padding)/vals.length;
                        return (padding/2 + (vals.length-1-i+0.5) * cellSize);
                    });
            }
        });
    
    // Cell and plot.
    var cell = svg.selectAll("g.cell")
        .data(cross(xMeasures, yMeasures))
        .enter().append("g")
        .attr("class", "cell")
        .attr("transform", function(d) { return "translate(" + (d.i+1.5) * size + "," + d.j * size + ")"; })
        .each(plot);
    
    function buildNewInfoBox(infoBox) {
	infoBox.append("h3")
	    .style("text-align","center")
            .text(function(d) {
		return d.label;
            });
	infoBox.append("p")
	    .style("text-align","center")
            .text(function(d) {
		//console.log(d.x);
		return "("+d.partOf[0].label[0]+")";
            });
    }

    var xSortable = svg.append("foreignObject")
        .attr("width", size*(n+2) +padding*2)
        .attr("height", size+padding)
        .attr("x", size*1.5)
        .attr("y", size*yMeasures.length+padding/2)
	.append("xhtml:body").attr('xmlns',"http://www.w3.org/1999/xhtml")
	.append("div")
	.style("width",size*(n+2) +padding*2+"px")
	.style("height","35px")
	.style("list-style-type","none")
	.style("margin","0")
	.style("padding","0");

    var xSel = xSortable.selectAll("div").data(xMeasures)
    var xInfoBox = xSel.enter()
	.append("div")
        .attr("class","ui-widget-content ui-corner-all xInfo")
	.style("float","left")
        .style("width", (size-padding*1.5)+"px")
        //.style("height", size-padding+"px")
	.style("padding","3px")
	.style("margin",padding/2+"px");
    xSel.exit().remove()
    buildNewInfoBox(xInfoBox);
    $(xSortable).sortable({
	placeholder: "ui-state-highlight ui-corner-all placeholder",
	revert: true,
	sort: function (event, ui) {
	    console.log("moving and resetting size");
	    svg.attr("width", size * (n + 1.5) + padding+20);
	}
    });
    //$(xSortable[0]).disableSelection();

    var ySortable = svg.append("foreignObject")
        .attr("height", size*(m+2) +padding*2)
        .attr("width", size+padding)
        .attr("y", padding/2)
        .attr("x", 0)
	.append("xhtml:body").attr('xmlns',"http://www.w3.org/1999/xhtml")
	.append("ul")
	.style("list-style-type","none")
	.style("margin","0")
	.style("padding","0");

    var yInfoBox = ySortable.selectAll("li").data(yMeasures).enter()
	.append("li")
        .attr("class","ui-widget-content ui-corner-all xInfo")
//	.style("display","inline-table")
        .style("width", (size-padding*1.5)+"px")
        .style("height", size-padding+"px")
	.style("padding","3px")
	.style("margin",padding/2+"px");
    buildNewInfoBox(yInfoBox);

    $(ySortable[0]).sortable({
	placeholder: "ui-state-highlight ui-corner-all",
	revert: true
    });
    $(ySortable[0]).disableSelection();

    // var yInfoBox = svg.selectAll("foreignObject.yInfo")
    // 	.data(yMeasures)
    // 	.enter()
    // 	.append("svg:foreignObject")
    // 	.attr("class","yInfo")
    //     .attr("width", size )
    //     .attr("height", size - padding)
    //     .attr("y", function(d,i) {return size*i+padding/2})
    //     .attr("x", 0);
    // buildInfoBox(yInfoBox);

    function plot(p) {
        var cell = d3.select(this);
        
        
        var filteredLocs = locs.filter(function(d,i) {
            //if (i > 100) return false;
            return d[p.x.uri] != null && d[p.y.uri] != null &&
                d[p.x.uri][year] != null && d[p.y.uri][year] != null;
        });
        //console.log(p);
        // Plot frame.
        cell.append("rect")
            .attr("class", "frame")
            .attr("x", padding / 2)
            .attr("y", padding / 2)
            .attr("width", size - padding)
            .attr("height", size - padding);
        if (numericMeasures.contains(p.y)) {
            if (numericMeasures.contains(p.x)) {
                //console.log("Using scatter plot");
                //console.log(filteredLocs.length);
                // Plot dots.
                cell.selectAll("circle")
                    .data(filteredLocs)
                    .enter().append("circle")
                    .attr("class", function(d) { return d.uri; })
                    .attr("cx", function(d) {
                        return x[p.x.uri](d[p.x.uri][year]).toString(); 
                    })
                    .attr("cy", function(d) {
                        return y[p.y.uri](d[p.y.uri][year]).toString(); 
                    })
                    .attr("r", 1.5);
        
                // Plot brush.
                cell.call(brush.x(x[p.x]).y(y[p.y]));
            } else {
                var m = [0, 50, 20, 50], // top right bottom left
                    xValues = measureVals[p.x.uri];
                //console.log(xValues);
                var xLocations = measureLocs[p.x.uri].map(function(val) {
                    return val.filter(function(d) {
                        return filteredLocs.contains(d);
                    })
                });
                //console.log(measureLocs[p.x.uri]);
                var yValues = xLocations.map(function(val) {
                    return val.map(function (d) {
                        return d[p.y.uri][year];
                    });
                });
                var width = (size-padding)/xValues.length;
                var chart = d3.chart.box()
                    .whiskers(iqr(1.5))
                    .tickFormat(null)
                    .width(12)//(size-padding)/xValues.length - m[1] - m[3])
                    .height((size-padding));
                var yScale = y[p.y.uri];
                chart.domain(y[p.y.uri].domain());
                var boxes = cell.selectAll("g").data(yValues).enter().append("g")
                    .attr("class","box")
                    .attr("transform", function(d,i) {
                          var cellSize = (size-padding)/xValues.length;
                          return "translate(" + (padding/2 + (i+0.5) * cellSize - 6) + 
                                            ","+padding/2+")";
                    });
                //console.log(boxes);
                boxes.call(function(d) {if (d != null && d.length > 0) chart(d)});

            }
        } else {
            var yValues = measureVals[p.y.uri];
            //console.log(yValues);
            if (numericMeasures.contains(p.x)) {
                var yLocations = measureLocs[p.y.uri].map(function(val) {
                    return val.filter(function(d) {
                        return filteredLocs.contains(d);
                    })
                });
                //console.log(measureLocs[p.x.uri]);
                var xValues = yLocations.map(function(val) {
                    return val.map(function (d) {
                        return d[p.x.uri][year];
                    });
                });
                var width = (size-padding)/yValues.length;
                var chart = d3.chart.box()
                    .whiskers(iqr(1.5))
                    .tickFormat(null)
                    .width(12)//(size-padding)/xValues.length - m[1] - m[3])
                    .height((size-padding));
                var xScale = x[p.x.uri];
                chart.domain(x[p.x.uri].domain());
                var boxes = cell.append("g")
                    .attr("transform", "rotate(90) translate(0,-"+size+")")
                    .selectAll("g")
                    .data(xValues).enter().append("g")
                    .attr("class","box")
                    .attr("transform", function(d,i) {
                          var cellSize = (size-padding)/yValues.length;
                          return "translate(" + (padding/2 + (yValues.length-1-i+0.5) * cellSize - 6) + 
                                            ","+padding/2+")";
                    });
                //console.log(boxes);
                boxes.call(function(d) {if (d != null && d.length > 0) chart(d)});
            } else {
                var yValues = measureVals[p.y.uri];
                //console.log(yValues);
                var xValues = measureVals[p.x.uri];
                var counts = {};
                xValues.forEach(function(x) {
                    counts[x] = {};
                    yValues.forEach(function(y) {
                        counts[x][y] = 0;
                    });
                });
                filteredLocs.forEach(function(loc) {
                    counts[loc[p.x.uri][year]][loc[p.y.uri][year]] += 1;
                });
                var max = d3.max(d3.values(counts).map(function(d){
                    return d3.max(d3.values(d));
                }));
                var color = d3.scale.linear()
                    .domain([0, max])
                    .range(["white", "red"]);
                //console.log(max);
                var cells = cell.selectAll("g").data(cross(xValues,yValues))
                    .enter()
                    .append("g");
                var xCellSize = (size-padding)/xValues.length;
                var yCellSize = (size-padding)/yValues.length;
                cells.append("rect")
                    .attr("stroke","none")
                    .attr("fill",function(d,i) {
                          return color(counts[d.x][d.y]);
                    })
                    .attr("x",function(d) { return padding/2 + d.i*xCellSize })
                    .attr("y",function(d) { return padding/2 + (yValues.length-1-d.j)*yCellSize })
                    .attr("width",xCellSize)
                    .attr("height",yCellSize);
                cells.append("text")
                    .style('dominant-baseline',"middle")
                    .style('text-anchor',"middle")
                    .style('font-size',12)
                    .attr("x",function(d) { return padding/2 + (0.5+d.i)*xCellSize })
                    .attr("y",function(d) { return padding/2 + (0.5+(yValues.length-1-d.j))*yCellSize })
                    .text(function(d) {
                          return counts[d.x][d.y];
                    })
            }
        }
    }
    
    // Clear the previously-active brush, if any.
    function brushstart(p) {
        if (brush.data !== p) {
            cell.call(brush.clear());
            brush.x(x[p.x]).y(y[p.y]).data = p;
        }
    }
    
    // Highlight the selected circles.
    function brush(p) {
        var e = brush.extent();
        svg.selectAll("circle").attr("class", function(d) {
            return e[0][0] <= d[p.x] && d[p.x] <= e[1][0]
                && e[0][1] <= d[p.y] && d[p.y] <= e[1][1]
                ? d.uri : null;
        });
    }
    
    // If the brush is empty, select all circles.
    function brushend() {
        if (brush.empty()) svg.selectAll("circle").attr("class", function(d) {
            return d.uri;
        });
    }
    
    function cross(a, b) {
        var c = [], n = a.length, m = b.length, i, j;
        for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
        return c;
    }   
}

// Returns a function to compute the interquartile range.
function iqr(k) {
  return function(d, i) {
    var q1 = d.quartiles[0],
        q3 = d.quartiles[2],
        iqr = (q3 - q1) * k,
        i = -1,
        j = d.length;
    while (d[++i] < q1 - iqr);
    while (d[--j] > q3 + iqr);
    return [i, j];
  };
}


function save() {
    var domText = "<html>\n"+$("body").parent().html()+"\n</html>";
    d3.select("#downloadform").style("display","inline");
    d3.select("#downloader").text(domText);
}

$(document).ready(function(){
  $("button").click(save);
});