

process.nextTick(() => {
    console.log("Hello, World!");
});
setTimeout(() => {
    console.log(Promise.resolve("ddd"));
}, 0);
console.log(Math.min(-1, 5));
console.log(Math.max(-1, -5));