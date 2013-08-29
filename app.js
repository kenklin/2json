// Node express program: app.js
//	Translates web csv files to json.  Eventually implement http://tools.ietf.org/html/rfc4180#section-2
//
// To setup on AWS EC2 see:
// 1) http://iconof.com/blog/how-to-install-setup-node-js-on-amazon-aws-ec2-complete-guide/
// 2) https://gist.github.com/kentbrew/776580 
//		sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to 8080

var $ = require('jquery');
var express = require('express');
var app = express();
var cache = {};	// <req.query>: <retobj>

var PATH = '/2json/api';
var PORT = 8080;
var CRLF = '\r\n';
var COMMA = ',';

// http://stackoverflow.com/questions/13656300/jquery-getjson-doesnt-respond-but-direct-access-does
var allowCrossDomain = function(req, res, next) {	// Allow (CORS) cross-domain requests
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}
app.configure(function() {
  app.use(allowCrossDomain);
})

function parse_header(ctx) {
  ctx.header.names = ctx.lines.shift().split(COMMA);
}

function parse_field(ctx, fields, i) {
  var json = '"';
  json += (ctx.header.names != null && i < ctx.header.names.length)
    ? ctx.header.names[i]
    : i;
  json += '":';

  var quote = ctx.header.quote != null && i < ctx.header.quote.length && ctx.header.quote[i];
  if (!quote && isNaN(fields[i]))
    quote = true;
  json += (quote)
    ? '"' + fields[i] + '"'
    : fields[i];
  return json;
}

function parse_record(ctx) {
  var json = '{';
  var fields = ctx.lines.shift().split(COMMA);
  if (fields != null && fields.length > 0) {
    json += parse_field(ctx, fields, 0);
    for (var i = 1; i < fields.length; i++) {
      json += ',';
      json += parse_field(ctx, fields, i);
    }
  }
  json += '}';
  return json;
}

function parse_file(ctx) {
  if (ctx.header.names != null)
    parse_header(ctx);

  var json = '[';
  json += parse_record(ctx);
  while (ctx.lines.length > 0) {
    json += ',';
    json += parse_record(ctx);
  }
  json += ']';
  return json;
}

function csv2json(ctx) {
  return $.parseJSON(parse_file(ctx));
}

app.get(PATH, function(req, res) {
  var url = req.query.url != null
    ? req.query.url
    : 'https://raw.github.com/CityOfPhiladelphia/ppa-data/master/red-light-cameras/red-light-camera-locations.csv';
  var hasheader = req.query.header != null
    ? +req.query.header
    : 0;
  var cachekey = JSON.stringify(req.query);
 
  var retobj = {
    meta: {
      query: cachekey,
      cached: false
    },
    data: null	// Array of objects representing CSV
  };
  if (cache[cachekey] != null) {
    console.log("get('" + cachekey + "') cached");
    res.json(cache[cachekey]);
  } else {
    $.get(url, function(data) {
      try {
        var ctx = {
          header: {
            names: hasheader > 0 ? [] : null,
            quote: []
    	  },
          lines: data.split(CRLF)
        };
        if (ctx.lines[ctx.lines.length - 1] == '')
          ctx.lines.pop();

        retobj.meta.cached = false;
        retobj.data = csv2json(ctx);
        res.json(retobj);
        console.log("get('" + cachekey + "') success");

        retobj.meta.cached = true;
        cache[cachekey] = retobj;
      } catch (err) {
        console.log("get('" + cachekey + "') Error: " + err.message);
      }
    })
    .fail(function(jqXJR, textStatus, errorThrown) {
      console.log("get('" + key + "') failed: " + textStatus);
    })
  }
})

app.listen(PORT);
console.log('Listening on port ' + PORT);