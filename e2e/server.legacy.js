var express = require('express');
var app = express();

app.use(express.static('static'));

app.get('/redirect1', function(req, res) {
  res.redirect('/redirect2');
});

app.get('/redirect2', function(req, res) {
  res.redirect('/redirect3');
});

app.get('/redirect3', function(req, res) {
  res.redirect('/redirectend');
});

app.get('/redirectend', function(req, res) {
  res.send('End of redirect chain <a href="redirect2">To middle of redirect chain</a>');
});

app.get('/shortened', function(req, res) {
  res.redirect('/graph_no_cycles/page1.html');
});

app.get('/bitly-shortened', function(req, res) {
  res.redirect(301, '/graph_no_cycles/page1.html');
});

app.get('/google-shortened', function(req, res) {
  res.redirect(307, '/graph_no_cycles/page1.html');
});

app.listen(3000, function () {
  console.log('Example app for end to end tests running on port 3000');
});