// Copies the pure Excel builder out of ../index.html so Node tests can require it.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
fs.writeFileSync(__dirname + '/builder.js', html.match(/<script id="xlsx-builder">([\s\S]*?)<\/script>/)[1]);
