let acorn = require("acorn");


console.log(acorn.parse("a = m || 0").body);