class MiddlewareDependencyError extends Error {

  constructor(middelwareName, dependency, url, method) {
    super(`Middleware '${middelwareName}' dependency '${dependency}' not met on '${method} ${url}'`);
    this.middelwareName = middelwareName;
    this.dependency = dependency;
    this.url = url;
    this.status = 400;
  }

}

class ValidationMiddlewareError extends Error {

  constructor(middelwareName, url, method, message = "") {
    super(`Validation error: '${middelwareName}' on '${method} ${url}'. ${message}`);
    this.middelwareName = middelwareName;
    this.url = url;
    this.status = 400;
  }

}

const getFieldsFromRequest = req => ({"url": req.originalUrl, "method": req.method, "path": req.path});
const getData = req => Object.assign({}, req.params, req.query, req.body, req.middlewares, req.middlewares.nameless, getFieldsFromRequest(req));
const ensureMiddlewares = req => {
  if (!req.middlewares) {
    req.middlewares = {};
  }
};
const areDependenciesNotMet = (data, dependencies) => dependencies.some(dependency => {

  let dep = data[dependency];

  return dep === undefined || dep === null

});

const namedMiddleware = (name, fn, dependencies = []) => async (req, res, next) => {
  
  ensureMiddlewares(req);

  try {

    const data = getData(req);

    if (areDependenciesNotMet(data, dependencies)) {
      throw new MiddlewareDependencyError(name, dependency, req.originalUrl, req.method);
    }

    const middlewareResponse = await fn(data);

    req.middlewares[name] = middlewareResponse;

    next();

  } catch (e) {
    next(e);
  }

};

const middleware = (name, fn, dependencies, exports) => {

  if (typeof name === "string") {
    return namedMiddleware(name, fn, dependencies);
  }

  return namedMiddleware("nameless", name, fn);

}

const respond = (fn, dependencies = []) => async (req, res, next) => {

  ensureMiddlewares(req);

  try {

    const data = getData(req);

    if (areDependenciesNotMet(data, dependencies)) {
      throw new MiddlewareDependencyError("respond", dependency, req.originalUrl, req.method);
    }

    const response = await fn(data);

    res.status(response.status || 200);

    response.headers && Object.keys(response.headers).forEach(header => res.setHeader(header, response.headers[header]));

    res.end(typeof response.body === "object" ? JSON.stringify(response.body) : response.body);

  } catch(e) {
    next(e);
  }

};

const validationMiddleware = (name, fn, message) => (req, res, next) => {
  
  ensureMiddlewares(req)

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

  const targetMiddleware = req.middlewares[name];

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

module.exports = {
  middleware, respond, spreadMiddleware, validationMiddleware, conditionalResponse, MiddlewareDependencyError, ValidationMiddlewareError
}