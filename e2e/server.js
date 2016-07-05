var express = require('express');
var app = express();

app.use(express.static('static'));

app.listen(3000, function () {
  console.log('Example app for end to end tests running on port 3000');
});