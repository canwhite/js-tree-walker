let walker = require("./index")

walker.run(`

    let c = "123";
    function add(a,b){
        return a+b;
    }
    console.log(add(1,2));
    console.log(c);
    let arr = [1,2,3];
    console.log(arr);



    
`)