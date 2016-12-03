const chai = require('chai'); 
const expect = chai.expect;

describe('unit tests', () => {
  describe('test1', () => {
    it('test1', done => {
      expect('test1').to.equal('test1');
      done();
    });
  });
});