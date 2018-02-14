# What is this?
It's a library to make it easier to write chainable middlewares for express

# Why?
- Assigning things to req doesn't look good
- I'd like to forget about req, res, next and just write my code
- I'd like to reuse the middlewares somewhere else
- I want to easily validate the data
- I just want the data to be there and be able to take it from other middlewares

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

Middlewares work as pipelines but the result of the previous middleware execution is stored in the middleware itself.
The library makes it easy to retrieve this results by merging them into a big object so you don't have to worry where you're getting the data from.
A middleware can depend on another middleware:

```
const miMiddleware = middleware("customer", ({customerId}) => Customers.get(customerId));
const middlewareThatDependsOnCustomerMiddleware = middleware(({customer}) => console.log(`Here's the customer ${customer}`), ["customer"]);
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