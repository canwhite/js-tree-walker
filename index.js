const parser = require("@babel/parser");
const { codeFrameColumns } = require('@babel/code-frame');
const chalk = require("chalk");

function getIdentifierValue(node, scope) {
    if (node.type === 'Identifier') {
        return scope.get(node.name);
    } else {
        return evaluate(node, scope);
    }
}

const evaluator = (function(){
    //这里对子节点进行遍历
    const astInterpreters = {
        //这个相当于根节点
        Program(node,scope){
            //program从body拿子节点
            node.body.forEach(item=>{
                evaluate(item,scope);
            })
        },
        VariableDeclaration(node,scope){
            node.declarations.forEach((item)=>{
                evaluate(item, scope);
            })
        },
        VariableDeclarator(node,scope){
            const declareName = evaluate(node.id);
            if(scope.get(declareName)){
                throw Error('duplicate declare variable：' + declareName);
            }else{
                //name=表达式部分
                scope.set(declareName, evaluate(node.init, scope));
            }
        },
        ExpressionStatement(node,scope){
            return evaluate(node.expression, scope);
        },
        BinaryExpression(node,scope){
            const leftValue = getIdentifierValue(node.left, scope);
            const rightValue = getIdentifierValue(node.right, scope);;
            switch(node.operator) {
                case '+':
                    return leftValue + rightValue;
                case '-':
                    return leftValue - rightValue;
                case '*':
                    return leftValue * rightValue;
                case '/':
                    return leftValue / rightValue;
                default: 
                    throw Error('upsupported operator：' + node.operator);
            }
        },
        Identifier(node,scope){
            return node.name;
        },
        NumericLiteral(node,scope){
            return node.value;
        },
        StringLiteral(node,scope){
            return node.value;
        },
     
        MemberExpression(node,scope){
            const obj = scope.get(evaluate(node.object));
            return obj[evaluate(node.property)]
        },
        CallExpression(node, scope) {
            const fn = evaluate(node.callee, scope);
            //处理参数
            //如果是标识符 Identifier的话要从 
            //scope 中取出对应的值，之后调用这个函数，传入参数。
            const args = node.arguments.map(item => {
                if (item.type === 'Identifier') {
                    return scope.get(item.name);
                }
                return evaluate(item, scope);
            });

            //如果是 obj.xxx 的形式也就是调用部分是 
            //MemberExpresion 的话则要绑定 this 为该 obj。

            if(node.callee.type === 'MemberExpression') {
                //console或者其它
                const fn = evaluate(node.callee, scope);
                const obj = evaluate(node.callee.object, scope);
                //要绑定 this 为该 obj。
                return fn.apply(obj, args);
            } else {
                const fn = scope.get(evaluate(node.callee, scope));
                console.log("------");
                return fn.apply(null, args);
            }
        },
        // FunctionExpression 的支持
        /* FunctionExpression(node,scope){
            
            const funcScope = new Scope();
            funcScope.parent = scope;

            node.params.forEach((item, index) => {
                funcScope.set(item.name, args[index]);
            });
            funcScope.set('this', this);
            evaluate(node.body, funcScope);

        },  */

        //添加上数组
        ArrayExpression(node,scope){
            return node.elements.map(item => evaluate(item, scope))
        },
        //添加上对象
        /* ObjectExpression(node,scope){
            const object = {}
            for (const property of node.properties) {
                const kind = property.kind
    
                let key;
                if (property.key.type === 'Literal') {
                    key = evaluate(property.key, scope)
                } else if (property.key.type === 'Identifier') {
                    key = property.key.name
                } else { throw '这里绝对就错了' }
    
                const value = evaluate(property.value, scope)
                if (kind === 'init') {
                    object[key] = value
                } else if (kind === 'set') {
                    Object.defineProperty(object, key, { set: value });
                } else if (kind === 'get') {
                    Object.defineProperty(object, key, { get: value });
                } else { throw Error("到这里绝对是错的") }
            }
            return object
        }, */


        FunctionDeclaration(node, scope) {
            const declareName = evaluate(node.id);
            //重名报错
            if (scope.get(declareName)) {
                throw Error('duplicate declare variable：' + declareName);
            } else {
                //函数会生成一个新的 scope，
                //我们把函数接收到的参数按照声明的 params 的名字，
                //依次设置在 scope 中，this 也设置到作用域中
                scope.set(declareName, function(...args) {
                    const funcScope = new Scope();
                    funcScope.parent = scope;
        
                    node.params.forEach((item, index) => {
                        funcScope.set(item.name, args[index]);
                    });
                    funcScope.set('this', this);
                    return evaluate(node.body, funcScope);
                });
            }
        },
        ReturnStatement(node, scope) {
            return evaluate(node.argument, scope);
        },
        BlockStatement(node, scope) {
            // console.log(node.body.length);
            for (let i = 0; i< node.body.length; i++) {
                if (node.body[i].type === 'ReturnStatement') {
                    return evaluate(node.body[i], scope);
                }
                evaluate(node.body[i], scope);
            }
        },
    }
    //执行方法，递归遍历
    const evaluate = (node,scope)=>{
        try{
            //递归，如果有终止条件的话，再设置终止条件
            return astInterpreters[node.type](node,scope);
        }catch(e){
            if(e && e.message && e.message.indexOf('astInterpreters[node.type] is not a function') != -1){
                console.error('unsupported ast type: ' + node.type);
                console.error(codeFrameColumns(sourceCode,node.loc,{
                    highlightCode:true//高亮显示
                }))
            }else{
                console.error(e.message);
                console.error(codeFrameColumns(sourceCode,node.loc,{
                    highlightCode:true
                }))
            }
        }
    }
    return {
        evaluate
    }
})();

class Scope {
    constructor(parentScope) {
        this.parent = parentScope;
        this.declarations = [];
    }

    set(name, value) {
        this.declarations[name] = value;
    }

    getLocal(name) {
        return this.declarations[name];
    }

    get(name) {
        let res = this.getLocal(name);
        if (res === undefined && this.parent) {
            res = this.parent.get(name);
        }
        return res;
    }

    has(name) {
        return !!this.getLocal(name);
    }
}


const globalScope = new Scope();
//往scope注入全局变量
globalScope.set('console', {
    log: function (...args) {
        console.log(chalk.green(...args));
    },
    error: function (...args) {
        console.log(chalk.red(...args));
    },
    error: function (...args) {
        console.log(chalk.orange(...args));
    },
});

let sourceCode = "";
let run = function(sourceCode){

    sourceCode = sourceCode;
    const ast = parser.parse(sourceCode,{
        sourceType: 'unambiguous'
    });
    evaluator.evaluate(ast.program,globalScope);
}

module.exports={
    run:run    
}

