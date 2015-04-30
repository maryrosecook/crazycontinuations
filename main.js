var peg = require("pegjs");
var fs = require("fs");
var _ = require("underscore");

var pegParse = peg.buildParser(fs.readFileSync(__dirname + "/grammar.pegjs", "utf8"),
                               { cache: true }).parse;

function Scope(scope, parent) {
  this.scope = scope;
  this.parent = parent;
};

Scope.prototype = {
  get: function(identifier) {
    if (identifier in this.scope) {
      return this.scope[identifier];
    } else if (this.parent !== undefined) {
      return this.parent.get(identifier);
    }
  },

  setBinding: function(k, v) {
    this.scope[k] = v;
  }
};

function createScope(scope, parent) {
  return new Scope(scope, parent);
};

function parse(codeStr) {
  return pegParse(codeStr);
};

var initialEnv = function() {
  return {
    add: function() {
      return Array.prototype.slice.apply(arguments)
        .reduce(function(a, x) { return a + x });
    },

    callcc: "callcc",

    print: function() {
      console.log.apply(null, arguments);
    }
  };
};

function Continuation(f) {
  this.f = f;
};

function interpretInvocation(ast, env) {
  var exprs = [];
  var operator = interpret(ast.c[0], env);
  if (operator instanceof Function) {
    var exprs = ast.c.slice(1)
        .map(function(x) { return interpret(x, env); });
    var result = operator.apply(null, exprs);
    return operator.continuation ? "abort" : result;
  } else if (operator === "callcc") {
    return "callcc";
  }
};

function interpretDo(ast, env) {
  var expr;
  for (var i = 0; i < ast.c.length; i++) {
    expr = interpret(ast.c[i], env);
    if (expr === "callcc") {
      var f = interpret(ast.c[i].c[1], env);
      var k = function() {
        return interpretDo({ t: "do",
                             c: ast.c.slice(i + 1)},
                           env);
      };

      k.continuation = true;
      expr = f(k);

      if (expr === "abort") {
        return;
      }
    } else if (expr === "abort") {
      return expr;
    }
  }

  return expr;
};

function interpretLambdaDef(ast, env) {
  return function () {
    var lambdaArguments = arguments;
    var lambdaParameters = _.pluck(ast.c[0], "c");
    var lambdaScope = createScope(
      _.object(lambdaParameters, lambdaArguments), env);

    return interpret(ast.c[1], lambdaScope);
  };
};

function interpret(ast, env) {
  if (env === undefined) {
    return interpret(ast, createScope(initialEnv()));
  } else if (ast === undefined) {
    return;
  } else if (ast.t === "invocation") {
    return interpretInvocation(ast, env);
  } else if (ast.t === "lambda") {
    return interpretLambdaDef(ast, env);
  } else if (ast.t === "do") {
    return interpretDo(ast, env);
  } else if (ast.t === "number") {
    return ast.c;
  } else if (ast.t === "label") {
    return env.get(ast.c);
  } else {
    throw "unexpected ast node " + ast.t
  }
};

// console.log(interpret(parse("(add 2 1 2)")));

// console.log(interpret(parse("({ ?x (add 1 2) x } 3)")));

// console.log(interpret(parse("(print 2 1 2)")));

console.log(interpret(parse('({(print 1) (callcc { ?k (print 2) (k) (print 3) }) (print 4) })')));

console.log(interpret(parse('({ (print 0) ({(print 1) (callcc { ?k (print 2) (k) (print 3) }) (print 4) }) (print 5) })')));

console.log(interpret(parse('({ (print 0) ({(print 1) (callcc { ?k (print 2) ({ (print 25) (k) (print 26) }) (print 3) }) (print 4) }) (print 5) })')));



// ({
//   (callcc { ?x

//   })
// })
