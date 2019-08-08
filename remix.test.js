const { expect } = require("chai");
const sinon = require("sinon");

const {
  expandDependencies,
  validateDependencies,
  filterMissingDependencies,
  filterMissingRequires,
  ensureMiddleware,
  namedMiddleware,
  MiddlewareDependsOnError,
  MiddlewareDependencyError,
  getData
} = require("./remix");

describe("express-remix", () => {

  describe("expandDependencies", () => {

    it("should return an empty object", () => expect(expandDependencies()).to.deep.equal({}));
    it("should return an object with dependsOn", () => expect(expandDependencies({ "dependsOn": [1,2, 3]})).to.deep.equal({ "dependsOn": [1, 2, 3]}));
    it("should return an object with dependsOn and requires", () => expect(expandDependencies({ "requires": [4, 5], "dependsOn": [1,2, 3]})).to.deep.equal({ "dependsOn": [1, 2, 3], "requires": [4 ,5]}));
    it("should return an object with requires", () => expect(expandDependencies({ "requires": [4, 5] })).to.deep.equal({ "requires": [4 ,5]}));

  });

  describe("filterMissingDependencies", () => {

    it("should return an empty array if all dependencies are met", () => {

      const fn1 = () => 1234;
      const fn2 = () => 5432;
      
      expect(filterMissingDependencies({ [fn1]: true, [fn2]: true }, [fn1, fn2]).length).to.equal(0);
      
    });
    
    it("should return an array with the dependencies that are not met", () => {
      
      const fn1 = () => 1234;
      const fn2 = () => 5432;

      expect(filterMissingDependencies({ [fn1]: true }, [fn1, fn2]).length).to.equal(1);
      expect(filterMissingDependencies({ [fn1]: true }, [fn1, fn2])).to.deep.equal([fn2]);

    });

  });

  describe("filterMissingRequires", () => {

    it("should return an empty array if all requirements are met", () => {
      expect(filterMissingRequires({}, [])).to.deep.equal([]);
      expect(filterMissingRequires({ "someField": 123}, ["someField"])).to.deep.equal([]);
      expect(filterMissingRequires({ "someField": 123, "anotherField": {}}, ["someField", "anotherField"])).to.deep.equal([]);
      expect(filterMissingRequires({ "someField": 0, "anotherField": ""}, ["someField", "anotherField"])).to.deep.equal([]);
    });
    
    it("should return an array with the requires that are missing", () => {
      expect(filterMissingRequires({}, ["someField", "anotherField"])).to.deep.equal(["someField", "anotherField"]);
      expect(filterMissingRequires({}, ["someField"])).to.deep.equal(["someField"]);
      expect(filterMissingRequires({"anotherField": 1234}, ["someField", "anotherField"])).to.deep.equal(["someField"]);
      expect(filterMissingRequires({"anotherField": undefined}, ["anotherField"])).to.deep.equal(["anotherField"]);
      expect(filterMissingRequires({"anotherField": null}, ["anotherField"])).to.deep.equal(["anotherField"]);
    });

  });

  describe("validateDependencies", () => {

    it("should validate dependencies as an array", () => {

      expect(() => {
        validateDependencies("test", {}, ["someField"]);
      }).to.throw();

      expect(() => {
        validateDependencies("test", {"someField": 123}, ["someField"]);
      }).not.to.throw();

    });

    it("should validate dependencies as object", () => {

      expect(() => {
        validateDependencies("test", {}, {
          "requires": ["someField"]
        });
      }).to.throw();

      expect(() => {
        validateDependencies("test", {"someField": 123}, {
          "requires": ["someField"]
        });
      }).not.to.throw();

      const fn1 = () => {};

      expect(() => {
        validateDependencies("test", {}, {
          "dependsOn": [fn1]
        });
      }).to.throw();

      expect(() => {
        validateDependencies("test", { [fn1]: true }, {
          "dependsOn": [fn1]
        });
      }).not.to.throw();

    });

  });

  describe("ensureMiddleware", () => {

    it("should add middleware and middlewareExecuted to object", () => {

      const req = {
        "someField": "remains untouched"
      };

      ensureMiddleware(req);

      expect(req).to.deep.equal({ "middleware": {}, "middlewareExecuted": {}, "someField": "remains untouched" });

    });

  });

  describe("namedMiddleware", () => {

    it("should throw error if dependency is missing", () => {

      const dependency = sinon.spy();
      const fnToExecute = sinon.spy();
      const next = sinon.spy();

      const middleware = namedMiddleware("test", fnToExecute, {
        "dependsOn": [dependency]
      });

      middleware({}, {}, next);

      expect(next.called).to.equal(true);
      expect(next.getCall(0).args[0] instanceof MiddlewareDependsOnError).to.equal(true);

    });

    it("should throw error if required field is missing", () => {

      const fnToExecute = sinon.spy();
      const next = sinon.spy();

      const middleware = namedMiddleware("test", fnToExecute, {
        "requires": ["someValue"]
      });

      middleware({}, {}, next);

      expect(next.called).to.equal(true);
      expect(next.getCall(0).args[0] instanceof MiddlewareDependencyError).to.equal(true);

    });

    it("should not throw error if dependencies are met", async () => {

      const firstFn = function() {};
      const fnToExecute = sinon.spy();
      const next = sinon.spy();

      const dependency = namedMiddleware("dependency", firstFn);

      const middleware = namedMiddleware("test", fnToExecute, {
        "dependsOn": [dependency]
      });

      const req = {
        "originalUrl": "http://somewhere.com",
        "method": "POST"
      };

      await dependency(req, {}, next);
      await middleware(req, {}, next);

      expect(next.called).to.equal(true);
      expect(next.getCall(0).args.length).to.equal(0);

    });

  });

  describe("getData", () => {

    it("should", () => {

      const req = {
        "params": { "userId": "12345" },
        "query": { "page": 1, "size": 20 },
        "body": { "someField": "someValue" },
        "middleware": {
          "middlewareNameResult": 1
        },
        "middlewareExecuted": {
          "someMiddelwareName": true
        },
        "originalUrl": "http://app.autoserve1.com",
        "method": "POST",
        "path": "",
        "headers": {}
      };

      const data = getData(req);

      expect(data.userId).to.equal("12345");
      expect(data.page).to.equal(1);
      expect(data.size).to.equal(20);
      expect(data.someField).to.equal("someValue");
      expect(data.middlewareNameResult).to.equal(1);
      expect(data.someMiddelwareName).to.equal(true);
      expect(data.url).to.equal("http://app.autoserve1.com");
      expect(data.method).to.equal("POST");

    });

  });

});