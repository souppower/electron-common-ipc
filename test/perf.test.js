const chai = require('chai');
const assert = chai.assert;

describe('map travel', () => {
    const size = 10000;
    const map = new Map();
    before(() => {
        for (let i = 0; i < size; ++i) {
            map.set(i.toString(), i.toString());
        }
    });

    it(`forEach`, () => {
        console.time('forEach');
        map.forEach((value, key) => {
            const j = Number(value);
            j;
            key;
        });
        console.timeEnd('forEach');
    });

    it(`for of`, () => {
        console.time('for of');
        for (let [key, value] of map) {
            const j = Number(value);
            j;
            key;
        }
        console.timeEnd('for of');
    });
});
