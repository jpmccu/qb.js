function getSubject(e, subject) {
    var aboutAttr = e.attr("about");
    if (aboutAttr) {
	subject = aboutAttr;
    }
    return subject;
}

function getPredicate(e, predicate, type) {
    var rel = e.attr("rel");
    if (rel) {
	predicate = rel;
	return [predicate, "uri"];
    }
    var property = e.attr("property");
    if (property) {
	predicate = property;
	return [predicate, "literal"];
    }
    return [predicate,type];
}

function getObject(e, type) {
    var href = e.attr("href");
    if(href) {
	return href;
    }
    var content = e.attr("content");
    if(content) {
	return content;
    }
    var resource = e.attr("resource");
    if(resource) {
	return resource;
    } else if (type == "literal") {
	var text = $(e).text();
	if (text && text.length > 0)
            return text;
	return null;
    } else return null;
}

function parseRDFa(element, subject, predicate, type, result) {
    if (!element) element = document;
    if (!subject) subject = "#";
    if (!result) result = {};
    if (!predicate) predicate = null;
    if (!type) type = null;
    var RDF_type = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    element = $(element);
    var types = element.attr("typeof");
    var newSubject = getSubject(element, subject);
    predicate = getPredicate(element, predicate, type);
    type = predicate[1];
    predicate = predicate[0];
    var object = getObject(element, type);
    if ((predicate && object) || types) {
	var resource = result[newSubject];
	if (!resource) {
            result[newSubject] = resource = {};
	}
	if (types) {
            var cls = {
		type: "uri",
		value: types,
            };
            if (!resource[RDF_type])
		resource[RDF_type] = []
            resource[RDF_type].push(cls);
	}
	if (predicate && object) {
            var o = {
		type: type,
		value: object,
            };
            if (!resource[predicate])
		resource[predicate] = [];
            resource[predicate].push(o);
	}
    }
    element.children().each(function(d) {
	var newPredicate = predicate;
	//if (newSubject != subject)
	//    newPredicate = null
	parseRDFa(this,newSubject,predicate, type, result);
    });
    return result;
}