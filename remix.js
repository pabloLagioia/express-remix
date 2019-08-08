class MiddlewareDependencyError extends Error {

  constructor(middleware, dependency, url, method) {
    super(`Middleware '${middleware}' dependency '${dependency}' not met on '${method} ${url}'`);
    this.middleware = middleware;
    this.dependency = dependency;
    this.url = url;
    this.status = 400;
  }

}

class MiddlewareDependsOnError extends Error {

  constructor(middleware, dependency, url, method) {
    super(`Middleware '${middleware}' expects '${dependency}' to be executed before it can be executed for '${method} ${url}'`);
    this.middleware = middleware;
    this.dependency = dependency;
    this.url = url;
    this.status = 500;
  }

}

class ValidationMiddlewareError extends Error {

  constructor(middleware, url, method, message = "") {
    super(`Validation error: '${middleware}' on '${method} ${url}'. ${message}`);
    this.middleware = middleware;
    this.url = url;
    this.status = 400;
  }

}

const getFieldsFromRequest = req => ({ "url": req.originalUrl, "method": req.method, "path": req.path });

const getData = req => Object.assign({}, req.params, req.query, req.body, req.middleware, req.middleware.nameless, getFieldsFromRequest(req), req.headers, req.middlewareExecuted);

const ensureMiddleware = req => {
  if (!req.middleware) {
    req.middleware = {};
  }
  if (!req.middlewareExecuted) {
    req.middlewareExecuted = {};
  }
};

const expandDependencies = dependencies => {

  if (!dependencies) {
    return {};
  }

  if (dependencies.length) {
    return { "requires": dependencies };
  }

  if (dependencies.dependsOn || dependencies.requires) {
    return dependencies;
  }

  return {};

};

const filterMissingRequires = (data, requires) => requires.filter(require => {

  const dep = data[require];

  return dep === undefined || dep === null;

});

/**
 * array containing functions
 */
const filterMissingDependencies = (data, dependsOn = []) => dependsOn.filter(dependencyFunction => !data[dependencyFunction]);

const validateDependencies = (name, data, dependencies) => {

  const dependenciesObject = expandDependencies(dependencies);

  if (dependenciesObject.dependsOn) {
    
    const missingDependencies = filterMissingDependencies(data, dependenciesObject.dependsOn);

    if (missingDependencies.length) {
      throw new MiddlewareDependsOnError(name, missingDependencies[0], data.url, data.method);
    }

  }

  if (dependenciesObject.requires) {
    
    const missingRequires = filterMissingRequires(data, dependenciesObject.requires);

    if (missingRequires.length) {
      throw new MiddlewareDependencyError(name, missingRequires[0], data.url, data.method); //kept same name for backwards compatibility but it should be called MiddlewareRequireError
    }

  }

};

const namedMiddleware = (name, fn, dependencies) => async (req, res, next) => {
  
  ensureMiddleware(req);

  try {

    const data = getData(req);

    validateDependencies(name, data, dependencies);

    const middlewareResponse = await fn(data);
    const previousData = req.middleware[name];

    req.middlewareExecuted[fn] = true;

    if (!previousData) {
      req.middleware[name] = middlewareResponse;
    } else {
      req.middleware[name] = Object.assign(previousData, middlewareResponse);
    }

    next();

  } catch (e) {
    next(e);
  }

};

const middleware = (name, fn, dependencies) => {

  if (typeof name === "string") {
    return namedMiddleware(name, fn, dependencies);
  }

  return namedMiddleware("nameless", name, fn);

}

const respond = (fn, dependencies = []) => async (req, res, next) => {

  ensureMiddleware(req);

  try {

    const data = getData(req);

    validateDependencies("respond", data, dependencies);

    const response = await fn(data);

    res.status(response.status || 200);

    response.headers && Object.keys(response.headers).forEach(header => res.setHeader(header, response.headers[header]));

    res.end(typeof response.body === "object" ? JSON.stringify(response.body) : response.body);

  } catch(e) {
    next(e);
  }

};

const validationMiddleware = (name, fn, message) => (req, res, next) => {
  
  ensureMiddleware(req)

  try {

    const data = getData(req);

    if (!fn(data)) {
      throw new ValidationMiddlewareError(name, req.originalUrl, req.method, message);
    }

    next();

  } catch (e) {
    next(e);
  }

};

const spreadMiddleware = (name, fields) => (req, res, next) => {

  const targetMiddleware = req.middleware[name];

  fields.forEach(fieldName => {
    req.body[fieldName] = targetMiddleware[fieldName];
  });

  next();

};

const conditionalResponse = fn => async (req, res, next) => {

  try {

    const data = getData(req);

    const response = await fn(data);

    if (!response) {
      return next();
    }
      
    res.status(response.status || 200);
    
    response.headers && Object.keys(response.headers).forEach(header => res.setHeader(header, response.headers[header]));
    
    res.end(typeof response.body === "object" ? JSON.stringify(response.body) : response.body);

  } catch (e) {
    next(e);
  }

};

const unwind = name => (req, res, next) => {
  ensureMiddleware(req);
  req.middleware[name] = req[name];
  next();
};

module.exports = {
  middleware,
  namedMiddleware,
  respond,
  spreadMiddleware,
  validationMiddleware,
  conditionalResponse,
  MiddlewareDependencyError,
  MiddlewareDependsOnError,
  ValidationMiddlewareError,
  unwind,
  filterMissingDependencies,
  filterMissingRequires,
  expandDependencies,
  validateDependencies,
  ensureMiddleware,
  getData,
  getFieldsFromRequest
};