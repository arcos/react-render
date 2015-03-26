#!/usr/bin/env node

var path = require('path');
var resolve = require('resolve');
var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
require('node-jsx').install({extension: '.jsx'});

var argv = require('yargs')
  .usage('Usage: $0 [--port NUM]')
  .describe('port', 'The port to listen to')
  .describe('debug', 'Print stack traces on error').alias('debug', 'd')
  .help('h').alias('h', 'help')
  .argv;

var app = express();
app.use(bodyParser.json());
app.use(morgan('combined'));

var cache = {};

var Component = function Component(pathToSource) {
  this.pathToSource = pathToSource;
  this.pathToReact = resolve.sync('react', {
    basedir: path.dirname(pathToSource)
  });
  this.component = require(this.pathToSource);
  // Detect bad JS file
  if (!this.component || !('displayName' in this.component)) {
    throw new Error('Not a React component: ' + this.pathToSource);
  }
};

Component.prototype.render = function render(props, toStaticMarkup, callback) {
  var React = require(this.pathToReact);
  var element = React.createElement(this.component, props);
  if (toStaticMarkup) {
    callback(React.renderToStaticMarkup(element));
  } else {
    callback(React.renderToString(element));
  }
};

app.post('/render', function service(request, response) {
  var toStaticMarkup = request.body.to_static_markup || false;
  var pathToSource = request.body.path_to_source;
  var props = request.body.props;

  if (!pathToSource) {
    return response.status(400).send('path_to_source required');
  }

  if (!(pathToSource in cache)) {
    console.log('Loading new component', pathToSource);
    component = new Component(pathToSource);
    cache[pathToSource] = component;
  }
  component = cache[pathToSource];

  component.render(props, toStaticMarkup, function(output) {
    response.send(output);
  });
});

app.use(function errorHandler(err, request, response, next) {
  console.log(err.stack);
  response.status(500);
  if (argv.debug) {
    response.send(err.stack);
  } else {
    response.send("An error occurred during rendering");
  }
});

var server = app.listen(argv.port || 63578, 'localhost', function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Started server at http://%s:%s', host, port);
});

module.exports = app;
