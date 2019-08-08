# What is this?
It's a library to make it easier to write chainable middleware for express

# Why?
- Assigning things to req doesn't look good
- I'd like to forget about req, res, next and just write my code
- I'd like to reuse the middleware
- I want to easily validate the data
- I just want the data to be there and be able to take it from other middleware
- Middleware are like pipes or building blocks of your endpoint

# Example

```
const { middleware, respond, validationMiddleware, spreadMiddleware } = require("express-remix");

const saveTextMessage = middleware("saveTextMessage", ({from, to, text, recipientType, senderType, inspectionOrderId, labels, userId, storeId, customerId, read}) => Messages.save({
  recipientType, 
  senderType,
  from,
  to,
  text,
  inspectionOrderId,
  labels,
  userId,
  storeId,
  customerId,
  read
}), ["from", "to", "text"]);

...

router.post("/customer/:customerId/text-message", 
  middleware("customer", ({customerId}) => Customers.get(customerId)),
  validationMiddleware("validate customer exists", ({customer}) => customer),
  validationMiddleware("validate customer has phone number", ({customer}) => customer.normalizedMobilePhone),
  middleware("store", ({customer}) => Stores.get(customer.storeId)),
  middleware(({customer, store, text}) => {
    return {
      "recipientType": "customer", 
      "senderType": "store",
      "from": store.interfacePhoneNumber,
      "to": customer.normalizedMobilePhone,
      "customerId": customer._id,
      "storeId": store._id,
      "read": true
    }
  }),
  saveTextMessage,
  ok
);
```

Middleware work as pipelines but the result of the previous middleware execution is stored in the middleware itself.
The library makes it easy to retrieve this results by merging them into a big object so you don't have to worry where you're getting the data from.

## Dependencies

### A middleware can require the response of another middleware:

```
const customerMiddleware = middleware("customer", ({customerId}) => Customers.get(customerId));

const middlewareThatDependsOnCustomerMiddleware = middleware(({customer}) => console.log(`Here's the customer ${customer}`), {
  "requires": ["customer"]
});
```

In this case, if customer is `null` or `undefined` `middlewareThatDependsOnCustomerMiddleware` will throw a `MiddlewareDependencyError`

Note: You can also pass in an array as a dependency which will be used as `requires` (for backwards compatibility)

```
const customerMiddleware = middleware("customer", ({customerId}) => Customers.get(customerId));

const middlewareThatDependsOnCustomerMiddleware = middleware(({customer}) => console.log(`Here's the customer ${customer}`), ["customer"]);
```

The above code will work the same as the previous example

### A middleware can expect another middleware to be executed before:
```
const customerMiddleware = middleware("customer", ({customerId}) => Customers.get(customerId));

const middlewareThatDependsOnCustomerMiddleware = middleware(({customer}) => console.log(`Here's the customer ${customer}`), {
  "dependsOn": [customerMiddleware]
});
```
In this case, if customer was not executed `middlewareThatDependsOnCustomerMiddleware` will throw a `MiddlewareDependensOnError`

You can combine both `requires` and `dependsOn` as follows:

```
const userMiddleware = middleware("user", ({userId}) => Users.get(userId));
const customerMiddleware = middleware("customer", ({customerId}) => Customers.get(customerId));

const middlewareThatDependsOnCustomerMiddleware = middleware(({customer}) => console.log(`Here's the customer ${customer}`), {
  "dependsOn": [customerMiddleware],
  "requires": ["user"]
});
```

All dependencies must be met. Also, all requires must be not `null` or `undefined`.
You can combine middleware to change the dependencies.

```
const login = () => {};

const getUserById = middleware("user", ({ userId }) => Users.get(userId));
const getUserByEmail = middleware("user", ({ email }) => Users.getByEmail(email));
​
const loginIfUserExistsByEmail = middleware("user", login, {
  "dependsOn": [getUserByEmail]
});
​
const loginIfUserExistByEmailAndId = middleware("user", login, {
  "dependsOn": [getUserByEmail, getUserById],
});
```

## Named middleware 
`middleware(name, fn, dependencyArray);`

## Unnamed middleware
`middleware(fn, dependencyArray);`

## Response middleware:
`respond(fn, dependencyArray);`

Example:

```
const sendCustomerJson = respond({customer} => {
  return {
    "headers": { "Content-Type": "application/json" },
    "body": JSON.stringify(customer)
  }
});
```